import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { getIntegrationSettings } from '../_shared/settings.ts'

serve(async (req) => {
  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Stripe settings from database
    const settings = await getIntegrationSettings(supabaseClient, [
      'stripe_secret_key',
      'stripe_webhook_secret'
    ])

    if (!settings.stripe_secret_key || !settings.stripe_webhook_secret) {
      console.error('Stripe webhook settings not configured')
      return new Response('Webhook not configured', { status: 500 })
    }

    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get the raw body for signature verification
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        settings.stripe_webhook_secret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Update payment status
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)

          if (error) {
            console.error('Failed to update order:', error)
          } else {
            await supabaseClient
              .from('orders')
              .update({ status: 'processing' })
              .eq('id', orderId)
              .in('status', ['pending_payment', 'failed'])

            console.log(`Order ${orderId} marked as paid`)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'failed',
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)

          if (error) {
            console.error('Failed to update order:', error)
          } else {
            await supabaseClient
              .from('orders')
              .update({ status: 'failed' })
              .eq('id', orderId)
              .in('status', ['pending_payment', 'processing'])

            console.log(`Order ${orderId} payment failed`)
          }
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string

        if (paymentIntentId) {
          // Find order by payment intent ID and update status
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'refunded',
              updated_at: new Date().toISOString()
            })
            .eq('stripe_payment_intent_id', paymentIntentId)

          if (error) {
            console.error('Failed to update refunded order:', error)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Log webhook event
    const { error: logError } = await supabaseClient
      .from('webhook_logs')
      .insert({
        source: 'stripe',
        event_type: event.type,
        payload: event.data.object,
        status: 'processed',
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Failed to log webhook:', logError)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(`Webhook Error: ${error.message}`, { status: 500 })
  }
})
