import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

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

    // ─── 1. Fetch Supabase orders that have a Stripe payment intent ───────────
    let ordersQuery = supabaseClient
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

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate + 'T00:00:00.000Z')
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte('created_at', endDate + 'T23:59:59.999Z')
    }

    const { data: ordersData, error: ordersError } = await ordersQuery
    if (ordersError) {
      throw new Error(`Orders query failed: ${ordersError.message}`)
    }

    // Build lookup map: stripe_payment_intent_id -> enriched order
    const ordersByPI: Record<string, any> = {}
    for (const order of (ordersData || [])) {
      if (!order.stripe_payment_intent_id) continue

      // Tally seedlings vs. products (bundles) line totals
      let seedlings = 0
      let products = 0
      for (const item of (order.order_items || [])) {
        const pt = item.product?.product_type
        if (pt === 'bundle') {
          products += Number(item.line_total) || 0
        } else {
          seedlings += Number(item.line_total) || 0
        }
      }

      // Sum successful refunds
      const refundTotal = (order.order_refunds || [])
        .filter((r: any) => r.status !== 'failed')
        .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0)

      // Fall back to shipping name when billing name is absent
      const billingFirst = order.billing_first_name || order.shipping_first_name || null
      const billingLast = order.billing_last_name || order.shipping_last_name || null

      ordersByPI[order.stripe_payment_intent_id] = {
        ...order,
        billing_first_name: billingFirst,
        billing_last_name: billingLast,
        refund_total: refundTotal,
        seedlings,
        products,
      }
    }

    // ─── 2. Fetch Stripe payouts ──────────────────────────────────────────────
    const payoutParams = new URLSearchParams({ limit: '100' })
    if (startDate) {
      payoutParams.set('arrival_date[gte]', String(Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)))
    }
    if (endDate) {
      payoutParams.set('arrival_date[lte]', String(Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)))
    }

    const payoutsResp = await fetch(`https://api.stripe.com/v1/payouts?${payoutParams}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!payoutsResp.ok) {
      const errText = await payoutsResp.text()
      throw new Error(`Stripe payouts error: ${payoutsResp.status} ${errText}`)
    }
    const payoutsJson = await payoutsResp.json()
    const payouts: any[] = payoutsJson.data || []

    // ─── 3. For each payout, fetch charges + refunds and build report rows ────
    const rows: any[] = []

    for (const payout of payouts) {
      const payoutDate = new Date(payout.arrival_date * 1000).toISOString().split('T')[0]
      const payoutTotal = payout.amount / 100

      const charges = await fetchBalanceTxns(stripeKey, payout.id, 'charge')
      const refunds = await fetchBalanceTxns(stripeKey, payout.id, 'refund')

      for (const txn of [...charges, ...refunds]) {
        // Extract payment_intent ID from the expanded source object
        let piId: string | null = null
        if (txn.source) {
          if (typeof txn.source.payment_intent === 'string') {
            piId = txn.source.payment_intent
          } else if (typeof txn.source.payment_intent === 'object' && txn.source.payment_intent?.id) {
            piId = txn.source.payment_intent.id
          }
        }

        const order = piId ? ordersByPI[piId] : null

        rows.push({
          payout_id: payout.id,
          payout_date: payoutDate,
          payout_total: payoutTotal,
          stripe_txn_id: txn.id,
          stripe_gross: txn.amount / 100,
          stripe_net: txn.net / 100,
          stripe_fee: txn.fee / 100,
          txn_type: txn.type,
          order_status: order?.status ?? 'UNMATCHED',
          order_number: order?.order_number ?? null,
          order_date: order?.created_at ?? null,
          order_total: order != null ? Number(order.total) : null,
          tax: order != null ? Number(order.tax) : null,
          shipping: order != null ? Number(order.shipping_cost) : null,
          discount: order != null ? Number(order.discount_amount) : null,
          gift_card: order != null ? Number(order.gift_card_amount) : null,
          refund_total: order != null ? order.refund_total : null,
          seedlings: order != null ? order.seedlings : null,
          products: order != null ? order.products : null,
          billing_first_name: order?.billing_first_name ?? null,
          billing_last_name: order?.billing_last_name ?? null,
        })
      }
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

// Paginate through all balance transactions of a given type for a payout
async function fetchBalanceTxns(stripeKey: string, payoutId: string, type: string): Promise<any[]> {
  const results: any[] = []
  let hasMore = true
  let startingAfter: string | null = null

  while (hasMore) {
    const params = new URLSearchParams({
      payout: payoutId,
      type,
      limit: '100',
    })
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
