import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface RefundItem {
  order_item_id: string
  quantity: number
  amount: number
  description?: string
}

interface RefundRequestBody {
  order_id: string
  amount_cents: number
  reason?: string
  items?: RefundItem[]
  admin_user_id?: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const {
      order_id,
      amount_cents,
      reason,
      items = [],
      admin_user_id,
    }: RefundRequestBody = await req.json()

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!amount_cents || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: 'amount_cents must be greater than zero' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const settings = await getIntegrationSettings(supabaseClient, [
      'stripe_enabled',
      'stripe_secret_key'
    ])

    if (!settings.stripe_enabled) {
      return new Response(JSON.stringify({ error: 'Stripe is not enabled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!settings.stripe_secret_key) {
      return new Response(JSON.stringify({ error: 'Stripe secret key is not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, order_number, total, status, payment_status, refunded_total, stripe_payment_intent_id')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error('Order lookup failed', orderError)
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!order.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'Order does not have a Stripe payment intent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const totalCents = Math.round(Number(order.total || 0) * 100)
    const alreadyRefundedCents = Math.round(Number(order.refunded_total || 0) * 100)
    const amountToRefund = Math.round(amount_cents)
    const remainingCents = totalCents - alreadyRefundedCents

    if (remainingCents <= 0) {
      return new Response(JSON.stringify({ error: 'Order is already fully refunded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (amountToRefund > remainingCents) {
      return new Response(JSON.stringify({ error: 'Refund amount exceeds remaining balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: amountToRefund,
      reason: 'requested_by_customer',
      metadata: {
        order_id,
        order_number: order.order_number ?? '',
        admin_user_id: admin_user_id ?? '',
        refund_reason: reason ?? '',
      }
    })

    const newRefundedTotalCents = alreadyRefundedCents + amountToRefund
    const fullyRefunded = newRefundedTotalCents >= totalCents
    const newOrderStatus = fullyRefunded ? 'refunded' : order.status
    const paymentStatus = fullyRefunded ? 'refunded' : 'partial'

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountToRefund / 100)

    const serializedMetadata = refund.metadata
      ? JSON.parse(JSON.stringify(refund.metadata))
      : null

    const { error: refundInsertError } = await supabaseClient
      .from('order_refunds')
      .insert({
        order_id,
        amount: amountToRefund / 100,
        reason: reason || null,
        items: items.length > 0 ? items : null,
        stripe_refund_id: refund.id,
        status: refund.status,
        created_by: admin_user_id || null,
        metadata: serializedMetadata,
      })

    if (refundInsertError) {
      console.error('Failed to log refund', refundInsertError)
    }

    const orderUpdatePayload: Record<string, any> = {
      payment_status: paymentStatus,
      refunded_total: newRefundedTotalCents / 100,
      updated_at: new Date().toISOString(),
    }

    if (fullyRefunded) {
      orderUpdatePayload.status = 'refunded'
    }

    const { error: orderUpdateError } = await supabaseClient
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', order_id)

    if (orderUpdateError) {
      console.error('Failed to update order with refund totals', orderUpdateError)
    }

    const noteParts = [`Refunded ${formattedAmount}`]
    if (reason) {
      noteParts.push(`Reason: ${reason}`)
    }

    const { error: historyError } = await supabaseClient
      .from('order_status_history')
      .insert({
        order_id,
        status: fullyRefunded ? 'refunded' : order.status,
        note: noteParts.join(' - '),
        changed_by: admin_user_id || null,
      })

    if (historyError) {
      console.error('Failed to append order history for refund', historyError)
    }

    return new Response(JSON.stringify({
      refund_id: refund.id,
      order_status: newOrderStatus,
      payment_status: paymentStatus,
      refunded_total: newRefundedTotalCents / 100,
      stripe_status: refund.status,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Stripe refund error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Failed to process refund' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
