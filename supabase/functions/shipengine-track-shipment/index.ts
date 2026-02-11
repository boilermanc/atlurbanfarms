import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface TrackingEvent {
  occurred_at: string
  status_code: string
  description: string
  city_locality: string | null
  state_province: string | null
  country_code: string | null
  carrier_status_code: string | null
  carrier_status_description: string | null
}

interface TrackingResponse {
  success: boolean
  tracking_number: string
  status: string
  status_description: string
  estimated_delivery: string | null
  actual_delivery: string | null
  events: TrackingEvent[]
}

interface TrackingRequest {
  tracking_number?: string
  carrier_code?: string
  shipment_id?: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get ShipEngine API key
    const integrationSettings = await getIntegrationSettings(supabaseClient, [
      'shipstation_enabled',
      'shipengine_api_key'
    ])

    if (!integrationSettings.shipstation_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INTEGRATION_DISABLED', message: 'ShipEngine integration is not enabled' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!integrationSettings.shipengine_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_API_KEY', message: 'ShipEngine API key is not configured' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request - support both GET query params and POST body
    let trackingNumber: string | null = null
    let carrierCode: string | null = null
    let shipmentId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      trackingNumber = url.searchParams.get('tracking_number')
      carrierCode = url.searchParams.get('carrier_code')
      shipmentId = url.searchParams.get('shipment_id')
    } else if (req.method === 'POST') {
      const body: TrackingRequest = await req.json()
      trackingNumber = body.tracking_number || null
      carrierCode = body.carrier_code || null
      shipmentId = body.shipment_id || null
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST' }
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If shipment_id provided, look up tracking info from database
    let resolvedShipmentId: string | null = shipmentId || null
    if (shipmentId && (!trackingNumber || !carrierCode)) {
      const { data: shipment, error: shipmentError } = await supabaseClient
        .from('shipments')
        .select('id, tracking_number, carrier_code')
        .eq('id', shipmentId)
        .single()

      if (shipmentError || !shipment) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'SHIPMENT_NOT_FOUND', message: `Shipment ${shipmentId} not found` }
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      trackingNumber = shipment.tracking_number
      carrierCode = shipment.carrier_code
      resolvedShipmentId = shipment.id
    }

    if (!trackingNumber || !carrierCode) {
      const message = resolvedShipmentId
        ? 'Shipment found but no tracking number has been assigned yet. Create a shipping label first.'
        : 'tracking_number and carrier_code are required, or provide shipment_id'
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: resolvedShipmentId ? 'NO_TRACKING_INFO' : 'INVALID_REQUEST', message }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine caller identity for write authorization
    // Tracking lookups are public (read-only), but DB writes require auth
    let callerUserId: string | null = null
    let callerIsAdmin = false
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseClient.auth.getUser(token)
      if (user) {
        callerUserId = user.id
        const { data: adminRole } = await supabaseClient
          .from('admin_user_roles')
          .select('id')
          .eq('customer_id', user.id)
          .eq('is_active', true)
          .single()
        callerIsAdmin = !!adminRole
      }
    }

    // Call ShipEngine tracking API
    const trackingUrl = `https://api.shipengine.com/v1/tracking?carrier_code=${encodeURIComponent(carrierCode)}&tracking_number=${encodeURIComponent(trackingNumber)}`

    const shipEngineResponse = await fetch(trackingUrl, {
      method: 'GET',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json'
      }
    })

    if (!shipEngineResponse.ok) {
      const errorBody = await shipEngineResponse.text()
      console.error('ShipEngine tracking API error:', shipEngineResponse.status, errorBody)
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPENGINE_ERROR',
            message: `ShipEngine returned ${shipEngineResponse.status}: ${errorBody}`
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const trackingData = await shipEngineResponse.json()

    // If we don't have a shipment_id yet, try to find shipment by tracking_number
    if (!resolvedShipmentId) {
      const { data: shipment } = await supabaseClient
        .from('shipments')
        .select('id')
        .eq('tracking_number', trackingNumber)
        .single()

      if (shipment) {
        resolvedShipmentId = shipment.id
      }
    }

    // Only write to DB if caller is authenticated (admin or order owner)
    let canWrite = callerIsAdmin
    if (!canWrite && callerUserId && resolvedShipmentId) {
      // Check if the caller owns the order associated with this shipment
      const { data: shipmentOrder } = await supabaseClient
        .from('shipments')
        .select('order_id, orders!inner(customer_id)')
        .eq('id', resolvedShipmentId)
        .single()

      if (shipmentOrder?.orders?.customer_id === callerUserId) {
        canWrite = true
      }
    }

    // Update shipments table with latest tracking status
    if (resolvedShipmentId && canWrite) {
      const shipmentUpdate: Record<string, any> = {
        tracking_status: trackingData.status_code,
        tracking_status_description: trackingData.status_description,
        last_tracking_update: new Date().toISOString(),
      }

      if (trackingData.estimated_delivery_date) {
        shipmentUpdate.estimated_delivery_date = trackingData.estimated_delivery_date
      }
      if (trackingData.actual_delivery_date) {
        shipmentUpdate.actual_delivery_date = trackingData.actual_delivery_date
      }

      // Mirror status mapping from tracking webhook
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
        .eq('id', resolvedShipmentId)

      if (updateError) {
        console.error('Failed to update shipment:', updateError)
      }

      // Upsert tracking events (dedup by occurred_at + shipment_id)
      if (trackingData.events && trackingData.events.length > 0) {
        const { data: existingEvents } = await supabaseClient
          .from('tracking_events')
          .select('occurred_at')
          .eq('shipment_id', resolvedShipmentId)

        const existingTimestamps = new Set(
          (existingEvents || []).map((e: any) => new Date(e.occurred_at).toISOString())
        )

        const newEvents = trackingData.events.filter(
          (event: any) => !existingTimestamps.has(new Date(event.occurred_at).toISOString())
        )

        if (newEvents.length > 0) {
          const eventsToInsert = newEvents.map((event: any) => ({
            shipment_id: resolvedShipmentId,
            occurred_at: event.occurred_at,
            status_code: event.status_code,
            description: event.description || event.carrier_status_description || '',
            city_locality: event.city_locality || null,
            state_province: event.state_province || null,
            country_code: event.country_code || null,
            raw_event: event,
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
    }

    // Build response
    const events: TrackingEvent[] = (trackingData.events || []).map((event: any) => ({
      occurred_at: event.occurred_at,
      status_code: event.status_code,
      description: event.description,
      city_locality: event.city_locality || null,
      state_province: event.state_province || null,
      country_code: event.country_code || null,
      carrier_status_code: event.carrier_status_code || null,
      carrier_status_description: event.carrier_status_description || null,
    }))

    // Sort events newest first
    events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

    const response: TrackingResponse = {
      success: true,
      tracking_number: trackingNumber,
      status: trackingData.status_code || 'UN',
      status_description: trackingData.status_description || 'Unknown',
      estimated_delivery: trackingData.estimated_delivery_date || null,
      actual_delivery: trackingData.actual_delivery_date || null,
      events,
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Track shipment error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to track shipment' }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
