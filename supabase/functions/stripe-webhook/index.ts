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
        const piId = paymentIntent.id

        // Check if the order was already created (by the client after payment success)
        const { data: existingOrder } = await supabaseClient
          .from('orders')
          .select('id, payment_status, status')
          .eq('stripe_payment_intent_id', piId)
          .maybeSingle()

        if (existingOrder) {
          // Order exists (client created it) — ensure it's marked as paid
          if (existingOrder.payment_status !== 'paid') {
            await supabaseClient
              .from('orders')
              .update({
                payment_status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingOrder.id)
          }
          if (['pending_payment', 'failed'].includes(existingOrder.status)) {
            await supabaseClient
              .from('orders')
              .update({ status: 'processing' })
              .eq('id', existingOrder.id)
          }
          console.log(`Webhook: Order ${existingOrder.id} already exists for PI ${piId}, ensured paid status`)
          break
        }

        // No order yet — check pending_orders for backup creation
        const { data: pendingOrder } = await supabaseClient
          .from('pending_orders')
          .select('*')
          .eq('stripe_payment_intent_id', piId)
          .maybeSingle()

        if (pendingOrder && pendingOrder.status === 'pending') {
          // Browser closed after payment — create order from stored data
          console.log(`Webhook: Creating order from pending_orders for PI ${piId}`)

          const orderData = {
            ...(pendingOrder.order_data as Record<string, unknown>),
            payment_status: 'paid',
            stripe_payment_intent_id: piId
          }
          const orderItems = pendingOrder.order_items as Record<string, unknown>[]

          // Call the RPC to create order with inventory check
          const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
            'create_order_with_inventory_check',
            {
              p_order_data: orderData,
              p_order_items: orderItems
            }
          )

          if (rpcError) {
            console.error('Webhook: RPC error creating order:', rpcError)
            // Mark pending order as failed
            await supabaseClient
              .from('pending_orders')
              .update({ status: 'failed', completed_at: new Date().toISOString() })
              .eq('id', pendingOrder.id)
            break
          }

          if (!rpcResult.success && rpcResult.error === 'insufficient_stock') {
            // Payment already taken — force order creation with skip_inventory_check
            console.warn(`Webhook: Insufficient stock for PI ${piId}, forcing order creation`)
            const forceOrderData = {
              ...orderData,
              skip_inventory_check: true,
              internal_notes: `STOCK WARNING: Insufficient stock at order time after payment. Original error: ${rpcResult.message}. Manual review required.`
            }
            const { data: forceResult, error: forceError } = await supabaseClient.rpc(
              'create_order_with_inventory_check',
              {
                p_order_data: forceOrderData,
                p_order_items: orderItems
              }
            )

            if (forceError || !forceResult?.success) {
              console.error('Webhook: Failed to force-create order:', forceError || forceResult)
              await supabaseClient
                .from('pending_orders')
                .update({ status: 'failed', completed_at: new Date().toISOString() })
                .eq('id', pendingOrder.id)
              break
            }

            // Update pending_orders with the created order
            await supabaseClient
              .from('pending_orders')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                completed_order_id: forceResult.order_id
              })
              .eq('id', pendingOrder.id)

            console.log(`Webhook: Force-created order ${forceResult.order_number} for PI ${piId} (stock warning)`)
            break
          }

          if (rpcResult.success) {
            // Update pending_orders
            await supabaseClient
              .from('pending_orders')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                completed_order_id: rpcResult.order_id
              })
              .eq('id', pendingOrder.id)

            // Record promotion usage if applicable
            const od = pendingOrder.order_data as Record<string, unknown>
            const promoId = od.promotion_id as string | null
            const discountAmt = od.discount_amount as number | null
            if (promoId && discountAmt && discountAmt > 0) {
              await supabaseClient
                .from('promotion_usage')
                .insert({
                  promotion_id: promoId,
                  order_id: rpcResult.order_id,
                  customer_id: pendingOrder.customer_id || null,
                  customer_email: pendingOrder.customer_email,
                  discount_amount: discountAmt
                })
              await supabaseClient.rpc('increment_promotion_usage', {
                p_promotion_id: promoId,
                p_discount_amount: discountAmt
              })
            }

            console.log(`Webhook: Created order ${rpcResult.order_number} from pending_orders for PI ${piId}`)
          }
        } else if (pendingOrder && pendingOrder.status === 'completed' && pendingOrder.completed_order_id) {
          // Already completed by another path — ensure order is marked as paid
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('id', pendingOrder.completed_order_id)
          await supabaseClient
            .from('orders')
            .update({ status: 'processing' })
            .eq('id', pendingOrder.completed_order_id)
            .in('status', ['pending_payment', 'failed'])
          console.log(`Webhook: Pending order already completed for PI ${piId}`)
        } else {
          // Legacy fallback: check metadata.orderId for backward compatibility
          const legacyOrderId = paymentIntent.metadata?.orderId
          if (legacyOrderId) {
            const { error } = await supabaseClient
              .from('orders')
              .update({
                payment_status: 'paid',
                stripe_payment_intent_id: piId,
                updated_at: new Date().toISOString()
              })
              .eq('id', legacyOrderId)

            if (!error) {
              await supabaseClient
                .from('orders')
                .update({ status: 'processing' })
                .eq('id', legacyOrderId)
                .in('status', ['pending_payment', 'failed'])
              console.log(`Webhook: Legacy order ${legacyOrderId} marked as paid`)
            } else {
              console.error('Webhook: Failed to update legacy order:', error)
            }
          } else {
            console.warn(`Webhook: No order or pending_order found for PI ${piId}`)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as unknown as StripePaymentIntent
        const piId = paymentIntent.id

        // Mark pending_orders as failed if exists
        await supabaseClient
          .from('pending_orders')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', piId)
          .eq('status', 'pending')

        // Legacy: update existing order if created before payment (old flow)
        const legacyOrderId = paymentIntent.metadata?.orderId
        if (legacyOrderId) {
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'failed',
              stripe_payment_intent_id: piId,
              updated_at: new Date().toISOString()
            })
            .eq('id', legacyOrderId)

          if (!error) {
            await supabaseClient
              .from('orders')
              .update({ status: 'failed' })
              .eq('id', legacyOrderId)
              .in('status', ['pending_payment', 'processing'])
            console.log(`Order ${legacyOrderId} payment failed`)
          } else {
            console.error('Failed to update order:', error)
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
