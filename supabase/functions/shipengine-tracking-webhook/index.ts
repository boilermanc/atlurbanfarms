import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import {
  sendShippingEmail,
  getEmailTemplateForTrackingStatus,
  shouldSendTrackingEmail,
  formatDateForEmail,
} from '../_shared/shipping-emails.ts'

/**
 * ShipEngine Tracking Webhook
 * Receives tracking updates from ShipEngine and updates the database
 *
 * Webhook payload structure:
 * {
 *   "resource_url": "https://api.shipengine.com/v1/tracking/...",
 *   "resource_type": "API_TRACK",
 *   "data": {
 *     "tracking_number": "...",
 *     "status_code": "...",
 *     "status_description": "...",
 *     "carrier_status_code": "...",
 *     "carrier_status_description": "...",
 *     "ship_date": "...",
 *     "estimated_delivery_date": "...",
 *     "actual_delivery_date": "...",
 *     "events": [...]
 *   }
 * }
 */

interface TrackingEvent {
  occurred_at: string
  status_code: string
  description: string
  city_locality?: string
  state_province?: string
  country_code?: string
  carrier_status_code?: string
  carrier_status_description?: string
  latitude?: number
  longitude?: number
  signer?: string
}

interface WebhookPayload {
  resource_url: string
  resource_type: string
  data: {
    tracking_number: string
    status_code: string
    status_description: string
    carrier_code?: string
    carrier_status_code?: string
    carrier_status_description?: string
    ship_date?: string
    estimated_delivery_date?: string
    actual_delivery_date?: string
    exception_description?: string
    events?: TrackingEvent[]
  }
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse webhook payload
    const payload: WebhookPayload = await req.json()
    console.log('Received tracking webhook:', JSON.stringify(payload, null, 2))

    // Validate payload
    if (!payload.data || !payload.data.tracking_number) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload: missing tracking_number' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const trackingData = payload.data

    // Find shipment by tracking number
    const { data: shipment, error: shipmentError } = await supabaseClient
      .from('shipments')
      .select('id, order_id, tracking_status, carrier_code')
      .eq('tracking_number', trackingData.tracking_number)
      .single()

    if (shipmentError || !shipment) {
      console.warn('Shipment not found for tracking number:', trackingData.tracking_number)
      // Return 200 to acknowledge receipt even if shipment not found
      // (might be a test webhook or tracking number from another system)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook received, shipment not found in database'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update shipment with latest tracking info
    const shipmentUpdate: Record<string, any> = {
      tracking_status: trackingData.status_code,
      tracking_status_description: trackingData.status_description,
      last_tracking_update: new Date().toISOString()
    }

    if (trackingData.estimated_delivery_date) {
      shipmentUpdate.estimated_delivery_date = trackingData.estimated_delivery_date
    }

    if (trackingData.actual_delivery_date) {
      shipmentUpdate.actual_delivery_date = trackingData.actual_delivery_date
    }

    // Update shipment status based on tracking status
    const statusCode = trackingData.status_code
    if (statusCode === 'DE') {
      shipmentUpdate.status = 'delivered'
    } else if (statusCode === 'IT' || statusCode === 'OT') {
      shipmentUpdate.status = 'in_transit'
    } else if (statusCode === 'EX') {
      shipmentUpdate.status = 'exception'
    } else if (statusCode === 'CA') {
      shipmentUpdate.status = 'cancelled'
    }

    const { error: updateError } = await supabaseClient
      .from('shipments')
      .update(shipmentUpdate)
      .eq('id', shipment.id)

    if (updateError) {
      console.error('Failed to update shipment:', updateError)
    }

    // Insert new tracking events
    if (trackingData.events && trackingData.events.length > 0) {
      // Get existing event timestamps to avoid duplicates
      const { data: existingEvents } = await supabaseClient
        .from('tracking_events')
        .select('occurred_at')
        .eq('shipment_id', shipment.id)

      const existingTimestamps = new Set(
        (existingEvents || []).map(e => new Date(e.occurred_at).toISOString())
      )

      // Filter out duplicate events
      const newEvents = trackingData.events.filter(
        event => !existingTimestamps.has(new Date(event.occurred_at).toISOString())
      )

      if (newEvents.length > 0) {
        const eventsToInsert = newEvents.map(event => ({
          shipment_id: shipment.id,
          occurred_at: event.occurred_at,
          status_code: event.status_code,
          description: event.description || event.carrier_status_description || '',
          city_locality: event.city_locality || null,
          state_province: event.state_province || null,
          country_code: event.country_code || null,
          raw_event: event
        }))

        const { error: insertError } = await supabaseClient
          .from('tracking_events')
          .insert(eventsToInsert)

        if (insertError) {
          console.error('Failed to insert tracking events:', insertError)
        } else {
          console.log(`Inserted ${eventsToInsert.length} new tracking events`)
        }
      }
    }

    // Optionally update order status if delivered
    if (trackingData.status_code === 'DE' && shipment.order_id) {
      const { error: orderError } = await supabaseClient
        .from('orders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.order_id)
        .in('status', ['processing', 'on_hold'])

      if (orderError) {
        console.error('Failed to update order status:', orderError)
      }
    }

    // Send tracking status email notification
    const previousStatus = shipment.tracking_status
    const newStatus = trackingData.status_code

    if (shipment.order_id && shouldSendTrackingEmail(newStatus, previousStatus)) {
      const emailTemplate = getEmailTemplateForTrackingStatus(newStatus)

      if (emailTemplate) {
        try {
          // Get current location from latest event
          const latestEvent = trackingData.events?.[0]
          let currentLocation = ''
          if (latestEvent?.city_locality && latestEvent?.state_province) {
            currentLocation = `${latestEvent.city_locality}, ${latestEvent.state_province}`
          } else if (latestEvent?.description) {
            currentLocation = latestEvent.description
          }

          const emailResult = await sendShippingEmail(
            supabaseClient,
            emailTemplate,
            shipment.order_id,
            {
              tracking_number: trackingData.tracking_number,
              carrier_code: shipment.carrier_code || trackingData.carrier_code,
              current_location: currentLocation,
              estimated_delivery: formatDateForEmail(trackingData.estimated_delivery_date),
              delivery_date: trackingData.actual_delivery_date
                ? new Date(trackingData.actual_delivery_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : undefined,
            }
          )

          if (emailResult.success) {
            console.log(`Tracking status email sent: ${emailTemplate}`)
          } else {
            console.warn(`Failed to send tracking status email: ${emailResult.error}`)
          }
        } catch (emailError) {
          // Don't fail the webhook if email fails
          console.error('Error sending tracking status email:', emailError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tracking update processed',
        shipment_id: shipment.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Tracking webhook error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to process tracking webhook'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
