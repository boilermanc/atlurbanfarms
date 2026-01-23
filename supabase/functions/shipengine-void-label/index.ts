import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface VoidLabelRequest {
  label_id: string
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

    // Get ShipEngine API key from settings
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

    // Parse request body
    const { label_id }: VoidLabelRequest = await req.json()

    if (!label_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'label_id is required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if shipment exists in our database
    const { data: shipment, error: shipmentError } = await supabaseClient
      .from('shipments')
      .select('*')
      .eq('label_id', label_id)
      .single()

    if (shipmentError || !shipment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPMENT_NOT_FOUND',
            message: 'Shipment not found in database'
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if already voided
    if (shipment.voided) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'ALREADY_VOIDED',
            message: 'Label has already been voided'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call ShipEngine void label API
    const voidResponse = await fetch(`https://api.shipengine.com/v1/labels/${label_id}/void`, {
      method: 'PUT',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json'
      }
    })

    if (!voidResponse.ok) {
      const errorBody = await voidResponse.text()
      console.error('ShipEngine void label error:', errorBody)

      // Check if label was already voided at ShipEngine
      if (voidResponse.status === 400 || voidResponse.status === 404) {
        // Still update our database
        await supabaseClient
          .from('shipments')
          .update({
            voided: true,
            voided_at: new Date().toISOString(),
            status: 'voided'
          })
          .eq('label_id', label_id)

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Label marked as voided (may have already been voided at carrier)',
            approved: true
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VOID_FAILED',
            message: `Failed to void label: ${voidResponse.status}`,
            details: errorBody
          }
        }),
        {
          status: voidResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const voidData = await voidResponse.json()

    // Update shipment record in database
    const { error: updateError } = await supabaseClient
      .from('shipments')
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        status: 'voided'
      })
      .eq('label_id', label_id)

    if (updateError) {
      console.error('Error updating shipment:', updateError)
    }

    // Remove tracking number from order
    if (shipment.order_id) {
      await supabaseClient
        .from('orders')
        .update({
          tracking_number: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.order_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        approved: voidData.approved,
        message: voidData.approved ? 'Label voided successfully' : 'Void request submitted'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Void label error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to void label'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
