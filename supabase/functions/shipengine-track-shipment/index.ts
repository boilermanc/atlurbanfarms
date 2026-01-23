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
  carrier_code: string
  status_code: string
  status_description: string
  estimated_delivery_date: string | null
  actual_delivery_date: string | null
  ship_date: string | null
  events: TrackingEvent[]
  error?: {
    code: string
    message: string
  }
}

interface TrackingRequest {
  tracking_number?: string
  carrier_code?: string
  shipment_id?: string
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Create Supabase client with service role
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
          error: {
            code: 'INTEGRATION_DISABLED',
            message: 'ShipEngine integration is not enabled'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!integrationSettings.shipengine_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'ShipEngine API key is not configured'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
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
    } else {
      const body: TrackingRequest = await req.json()
      trackingNumber = body.tracking_number || null
      carrierCode = body.carrier_code || null
      shipmentId = body.shipment_id || null
    }

    // If shipment_id provided, look up tracking info from database
    if (shipmentId && (!trackingNumber || !carrierCode)) {
      const { data: shipment, error: shipmentError } = await supabaseClient
        .from('shipments')
        .select('tracking_number, carrier_code')
        .eq('id', shipmentId)
        .single()

      if (shipmentError || !shipment) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'SHIPMENT_NOT_FOUND',
              message: 'Shipment not found'
            }
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      trackingNumber = shipment.tracking_number
      carrierCode = shipment.carrier_code
    }

    if (!trackingNumber || !carrierCode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'tracking_number and carrier_code are required, or provide shipment_id'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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
      console.error('ShipEngine tracking API error:', errorBody)

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPENGINE_ERROR',
            message: `Failed to get tracking info: ${shipEngineResponse.status}`,
            details: errorBody
          }
        }),
        {
          status: shipEngineResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const trackingData = await shipEngineResponse.json()

    // Transform events to our format
    const events: TrackingEvent[] = (trackingData.events || []).map((event: any) => ({
      occurred_at: event.occurred_at,
      status_code: event.status_code,
      description: event.description,
      city_locality: event.city_locality || null,
      state_province: event.state_province || null,
      country_code: event.country_code || null,
      carrier_status_code: event.carrier_status_code || null,
      carrier_status_description: event.carrier_status_description || null
    }))

    // Sort events by date, newest first
    events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

    const response: TrackingResponse = {
      success: true,
      tracking_number: trackingNumber,
      carrier_code: carrierCode,
      status_code: trackingData.status_code || 'UN',
      status_description: trackingData.status_description || 'Unknown',
      estimated_delivery_date: trackingData.estimated_delivery_date || null,
      actual_delivery_date: trackingData.actual_delivery_date || null,
      ship_date: trackingData.ship_date || null,
      events
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Track shipment error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get tracking info'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
