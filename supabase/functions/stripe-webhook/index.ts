import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface StripePaymentIntent {
  id: string
  metadata?: Record<string, string>
}

interface StripeCharge {
  payment_intent: string | null
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time string comparison to prevent timing attacks */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verify Stripe webhook signature using Web Crypto API.
 * Replicates what stripe.webhooks.constructEventAsync does.
 */
async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSec = 300
): Promise<StripeEvent> {
  // Parse the signature header: t=timestamp,v1=sig1,v1=sig2,...
  const parts = signatureHeader.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3))

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe signature header format')
  }

  // Check timestamp tolerance
  const ts = parseInt(timestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > toleranceSec) {
    throw new Error('Stripe webhook timestamp outside tolerance')
  }

  // Compute expected signature: HMAC-SHA256(secret, "timestamp.body")
  const signedPayload = `${timestamp}.${body}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  )
  const expectedSig = bytesToHex(signatureBytes)

  // Check if any of the v1 signatures match
  const verified = signatures.some(sig => secureCompare(sig, expectedSig))
  if (!verified) {
    throw new Error('Stripe webhook signature verification failed')
  }

  return JSON.parse(body) as StripeEvent
}

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

    // Get the raw body for signature verification
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    // Verify webhook signature
    let event: StripeEvent
    try {
      event = await verifyStripeSignature(
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
        const paymentIntent = event.data.object as unknown as StripePaymentIntent
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
        const paymentIntent = event.data.object as unknown as StripePaymentIntent
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
        const charge = event.data.object as unknown as StripeCharge
        const paymentIntentId = charge.payment_intent

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
