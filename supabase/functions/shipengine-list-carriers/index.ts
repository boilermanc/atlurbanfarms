import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

/**
 * Lists all carriers configured in the ShipEngine account.
 * Used by admin UI to discover and sync carrier IDs to carrier_configurations table.
 *
 * Optional body: { sync: true } to also upsert discovered carriers into carrier_configurations.
 */
serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const integrationSettings = await getIntegrationSettings(supabaseClient, [
      'shipstation_enabled',
      'shipengine_api_key'
    ])

    if (!integrationSettings.shipengine_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'ShipEngine API key is not configured. Set it in Admin > Settings > Integrations.'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch carriers from ShipEngine
    const response = await fetch('https://api.shipengine.com/v1/carriers', {
      method: 'GET',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('ShipEngine carriers API error:', response.status, errorBody)
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPENGINE_ERROR',
            message: `Failed to fetch carriers: ${response.status}`
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const carriers = (data.carriers || []).map((c: any) => ({
      carrier_id: c.carrier_id,
      carrier_code: c.carrier_code,
      friendly_name: c.friendly_name || c.carrier_code,
      nickname: c.nickname || null,
      account_number: c.account_number || null,
      is_primary: c.primary ?? false,
      disabled: c.disabled ?? false,
      has_multi_package: c.has_multi_package_supporting_services ?? false,
      services: (c.services || []).map((s: any) => ({
        carrier_id: s.carrier_id,
        carrier_code: s.carrier_code,
        service_code: s.service_code,
        name: s.name,
        domestic: s.domestic,
        international: s.international,
      })),
    }))

    // Parse request body for sync option
    let shouldSync = false
    try {
      const body = await req.json()
      shouldSync = body?.sync === true
    } catch {
      // No body or invalid JSON — that's fine, just list carriers
    }

    let syncResults: any[] = []

    if (shouldSync) {
      // Upsert each carrier into carrier_configurations
      for (const carrier of carriers) {
        // Build a carrier_code that distinguishes sources (e.g., "ups" vs "ups_shipstation")
        // ShipEngine returns carriers with nicknames from ShipStation like "ShipStation - UPS"
        const isShipStation = (carrier.nickname || carrier.friendly_name || '')
          .toLowerCase().includes('shipstation')
        const carrierCode = isShipStation
          ? `${carrier.carrier_code}_shipstation`
          : carrier.carrier_code

        const carrierName = carrier.nickname || carrier.friendly_name || carrier.carrier_code

        const { error: upsertError } = await supabaseClient
          .from('carrier_configurations')
          .upsert({
            carrier_code: carrierCode,
            carrier_name: carrierName,
            is_enabled: !carrier.disabled,
            is_sandbox: false,
            api_credentials: {
              shipengine_carrier_id: carrier.carrier_id,
              account_number: carrier.account_number,
              source: isShipStation ? 'shipstation' : 'direct',
            },
            allowed_service_codes: carrier.services
              .filter((s: any) => s.domestic)
              .map((s: any) => s.service_code),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'carrier_code',
          })

        syncResults.push({
          carrier_code: carrierCode,
          carrier_name: carrierName,
          carrier_id: carrier.carrier_id,
          synced: !upsertError,
          error: upsertError?.message || null,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        carriers,
        total: carriers.length,
        active: carriers.filter((c: any) => !c.disabled).length,
        ...(shouldSync ? { sync_results: syncResults } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('List carriers error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to list carriers'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
