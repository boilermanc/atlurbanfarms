import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// Orders on or after this date exist in the modern `orders` table with a PI.
// Orders before this date are in `legacy_orders` (WooCommerce) — no PI stored.
const LAUNCH_DATE = '2026-03-04'
const LAUNCH_UNIX = Math.floor(new Date(LAUNCH_DATE + 'T00:00:00Z').getTime() / 1000)

// ─── PI extraction helpers ────────────────────────────────────────────────────

/**
 * Try to extract a payment_intent ID and/or a charge ID from a balance txn.
 * Called after expanding data.source.
 */
function extractIds(txn: any): { piId: string | null; chargeId: string | null } {
  const source = txn.source
  if (!source) return { piId: null, chargeId: null }

  if (typeof source === 'object') {
    // payment_intent field present on both Charge and Refund objects
    if (source.payment_intent) {
      const pi = typeof source.payment_intent === 'string'
        ? source.payment_intent
        : (source.payment_intent?.id ?? null)
      if (pi) return { piId: pi, chargeId: null }
    }
    // Refund object: .charge is the charge that was refunded
    if (source.charge) {
      const ch = typeof source.charge === 'string' ? source.charge : (source.charge?.id ?? null)
      if (ch?.startsWith('ch_')) return { piId: null, chargeId: ch }
    }
    // Charge object where expand resolved the id to an object
    if (source.id?.startsWith('ch_')) return { piId: null, chargeId: source.id }
  }

  if (typeof source === 'string') {
    if (source.startsWith('pi_')) return { piId: source, chargeId: null }
    if (source.startsWith('ch_')) return { piId: null, chargeId: source }
  }

  return { piId: null, chargeId: null }
}

// ─── Stripe fetch helpers ─────────────────────────────────────────────────────

/** Paginate all balance transactions for a payout+type with expand. */
async function fetchBalanceTxns(stripeKey: string, payoutId: string, type: string): Promise<any[]> {
  const results: any[] = []
  let hasMore = true
  let startingAfter: string | null = null

  while (hasMore) {
    const params = new URLSearchParams({ payout: payoutId, type, limit: '100' })
    params.append('expand[]', 'data.source')
    if (startingAfter) params.set('starting_after', startingAfter)

    const resp = await fetch(`https://api.stripe.com/v1/balance_transactions?${params}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`Stripe balance_transactions error (${type}): ${resp.status} ${errText}`)
    }
    const data = await resp.json()
    results.push(...(data.data || []))
    hasMore = data.has_more ?? false
    if (hasMore && data.data?.length > 0) {
      startingAfter = data.data[data.data.length - 1].id
    } else {
      hasMore = false
    }
  }

  return results
}

/** Fetch a single charge from Stripe and return its payment_intent ID (if any). */
async function fetchChargePi(stripeKey: string, chargeId: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://api.stripe.com/v1/charges/${chargeId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!resp.ok) return null
    const charge = await resp.json()
    return typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  } catch {
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    const startDate = url.searchParams.get('start_date') // YYYY-MM-DD
    const endDate = url.searchParams.get('end_date')     // YYYY-MM-DD

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'MISSING_STRIPE_KEY', message: 'STRIPE_SECRET_KEY is not configured.' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ─── 1. Load all modern orders into a PI lookup map ──────────────────────
    // No date filter — we need to match any order that could appear in the payout.
    const { data: ordersData, error: ordersError } = await supabaseClient
      .from('orders')
      .select(`
        id, order_number, status, created_at, total, tax,
        shipping_cost, discount_amount, gift_card_amount,
        billing_first_name, billing_last_name,
        shipping_first_name, shipping_last_name,
        stripe_payment_intent_id,
        order_items (
          line_total,
          product:products(product_type)
        ),
        order_refunds (
          amount, stripe_refund_id, status
        )
      `)
      .not('stripe_payment_intent_id', 'is', null)

    if (ordersError) throw new Error(`Orders query failed: ${ordersError.message}`)

    const ordersByPI: Record<string, any> = {}
    for (const order of (ordersData || [])) {
      if (!order.stripe_payment_intent_id) continue

      let seedlings = 0
      let products = 0
      for (const item of (order.order_items || [])) {
        if (item.product?.product_type === 'bundle') {
          products += Number(item.line_total) || 0
        } else {
          seedlings += Number(item.line_total) || 0
        }
      }

      const refundTotal = (order.order_refunds || [])
        .filter((r: any) => r.status !== 'failed')
        .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0)

      ordersByPI[order.stripe_payment_intent_id] = {
        ...order,
        billing_first_name: order.billing_first_name || order.shipping_first_name || null,
        billing_last_name: order.billing_last_name || order.shipping_last_name || null,
        refund_total: refundTotal,
        seedlings,
        products,
      }
    }

    // ─── 2. Fetch Stripe payouts by arrival_date ──────────────────────────────
    const payoutParams = new URLSearchParams({ limit: '100' })
    if (startDate) {
      payoutParams.set('arrival_date[gte]',
        String(Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)))
    }
    if (endDate) {
      payoutParams.set('arrival_date[lte]',
        String(Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)))
    }

    const payoutsResp = await fetch(`https://api.stripe.com/v1/payouts?${payoutParams}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!payoutsResp.ok) {
      const errText = await payoutsResp.text()
      throw new Error(`Stripe payouts error: ${payoutsResp.status} ${errText}`)
    }
    const payouts: any[] = (await payoutsResp.json()).data || []

    // ─── 3. Collect all txns across all payouts ───────────────────────────────
    type TxnRecord = { txn: any; payout: any }
    const allTxnRecords: TxnRecord[] = []

    for (const payout of payouts) {
      const charges = await fetchBalanceTxns(stripeKey, payout.id, 'charge')
      const refunds = await fetchBalanceTxns(stripeKey, payout.id, 'refund')
      for (const txn of [...charges, ...refunds]) {
        allTxnRecords.push({ txn, payout })
      }
    }

    // ─── 4. First pass: extract PI (or collect unresolved charge IDs) ─────────
    // piId per txn (null if not yet resolved)
    const txnPiIds: (string | null)[] = []
    const txnChargeIds: (string | null)[] = []
    const unresolvedChargeIds = new Set<string>()

    for (const { txn } of allTxnRecords) {
      const { piId, chargeId } = extractIds(txn)
      txnPiIds.push(piId)
      txnChargeIds.push(chargeId)
      if (!piId && chargeId) unresolvedChargeIds.add(chargeId)
    }

    // ─── 5. Batch-fetch unresolved charges from Stripe ────────────────────────
    const chargeToPI: Record<string, string | null> = {}
    for (const chId of unresolvedChargeIds) {
      chargeToPI[chId] = await fetchChargePi(stripeKey, chId)
    }

    // ─── 6. Build final rows ──────────────────────────────────────────────────
    const rows: any[] = []

    for (let i = 0; i < allTxnRecords.length; i++) {
      const { txn, payout } = allTxnRecords[i]
      const payoutDate = new Date(payout.arrival_date * 1000).toISOString().split('T')[0]
      const payoutTotal = payout.amount / 100

      // Resolve final PI id
      let piId = txnPiIds[i]
      if (!piId && txnChargeIds[i]) {
        piId = chargeToPI[txnChargeIds[i]!] ?? null
      }

      const order = piId ? ordersByPI[piId] : null

      let orderStatus: string
      let note: string | null = null
      let legacyOrderData: any = null

      if (order) {
        orderStatus = order.status
      } else {
        // ── Try woo_stripe_lookup first (exact PI match) ──────────────────────
        let wooMatch: any = null
        if (piId) {
          const { data } = await supabaseClient
            .from('woo_stripe_lookup')
            .select('*')
            .eq('stripe_intent_id', piId)
            .maybeSingle()
          wooMatch = data
        }

        if (wooMatch) {
          orderStatus = 'WOO_MATCHED'
          legacyOrderData = wooMatch
        } else {
          // Is this a pre-launch transaction?
          const isPreLaunch = txn.created < LAUNCH_UNIX

          if (isPreLaunch) {
            // Try fuzzy match in legacy_orders by total + date
            const txnAmountDollars = Math.abs(txn.amount / 100)
            const dateMinus3 = new Date(txn.created * 1000 - 3 * 86400 * 1000).toISOString().split('T')[0]
            const datePlus1 = new Date(txn.created * 1000 + 1 * 86400 * 1000).toISOString().split('T')[0]

            const { data: fuzzyMatch } = await supabaseClient
              .from('legacy_orders')
              .select('woo_order_id, billing_first_name, billing_last_name, total, order_date')
              .eq('total', txnAmountDollars)
              .gte('order_date', dateMinus3)
              .lte('order_date', datePlus1)
              .or('payment_method.eq.Credit Card,payment_method.is.null')
              .limit(1)
              .maybeSingle()

            if (fuzzyMatch) {
              orderStatus = 'LEGACY_FUZZY'
              note = `Fuzzy match: WooCommerce order #${fuzzyMatch.woo_order_id} — verify manually`
              legacyOrderData = fuzzyMatch
            } else {
              orderStatus = 'NO_LEGACY_MATCH'
              note = `Pre-launch order (before ${LAUNCH_DATE}) — no PI stored in legacy orders`
            }
          } else {
            orderStatus = 'UNMATCHED'
          }
        }
      }

      rows.push({
        payout_id: payout.id,
        payout_date: payoutDate,
        payout_total: payoutTotal,
        stripe_txn_id: txn.id,
        stripe_gross: txn.amount / 100,
        stripe_net: txn.net / 100,
        stripe_fee: txn.fee / 100,
        txn_type: txn.type,
        order_status: orderStatus,
        order_number: order?.order_number
          ?? (legacyOrderData?.woo_order_id ? `WC-${legacyOrderData.woo_order_id}` : null),
        order_date: order?.created_at ?? legacyOrderData?.order_date ?? null,
        order_total: order != null
          ? Number(order.total)
          : (legacyOrderData?.total != null ? Number(legacyOrderData.total) : null),
        tax: order != null ? Number(order.tax) : (legacyOrderData?.tax != null ? Number(legacyOrderData.tax) : null),
        shipping: order != null ? Number(order.shipping_cost) : (legacyOrderData?.shipping != null ? Number(legacyOrderData.shipping) : null),
        discount: order != null ? Number(order.discount_amount) : null,
        gift_card: order != null ? Number(order.gift_card_amount) : null,
        refund_total: order != null ? order.refund_total : null,
        seedlings: order != null ? order.seedlings : 0,
        products: order != null ? order.products : 0,
        billing_first_name: order?.billing_first_name ?? legacyOrderData?.billing_first_name ?? null,
        billing_last_name: order?.billing_last_name ?? legacyOrderData?.billing_last_name ?? null,
        note: note ?? null,
      })
    }

    return new Response(
      JSON.stringify({ success: true, rows }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Stripe reconciliation error:', error)
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
