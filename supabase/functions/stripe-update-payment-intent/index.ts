import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'
import { updatePaymentIntentOrderNumber } from '../_shared/stripe.ts'

interface UpdateRequest {
  orderId: string
  paymentIntentId: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { orderId, paymentIntentId }: UpdateRequest = await req.json()

    if (!orderId || !paymentIntentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orderId and paymentIntentId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authorization boundary: confirm this PI actually belongs to the order.
    // Prevents arbitrary callers from rewriting descriptions on PIs they don't own.
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('order_number, stripe_payment_intent_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.stripe_payment_intent_id !== paymentIntentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'PaymentIntent does not match order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const settings = await getIntegrationSettings(supabaseClient, ['stripe_secret_key'])
    if (!settings.stripe_secret_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await updatePaymentIntentOrderNumber(settings.stripe_secret_key, paymentIntentId, order.order_number)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('stripe-update-payment-intent error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to update PaymentIntent' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
