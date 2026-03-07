import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface VoidLabelRequest {
  label_id: string
  order_id: string
}

function errorResponse(code: string, message: string, status = 200) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- Admin auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('UNAUTHORIZED', 'Authorization required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Invalid or expired token', 401)
    }

    const { data: adminRole } = await supabaseClient
      .from('admin_user_roles')
      .select('id')
      .eq('customer_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return errorResponse('FORBIDDEN', 'Admin access required', 403)
    }

    // --- Validate request body ---
    const { label_id, order_id }: VoidLabelRequest = await req.json()

    if (!label_id) {
      return errorResponse('INVALID_REQUEST', 'label_id is required')
    }
    if (!order_id) {
      return errorResponse('INVALID_REQUEST', 'order_id is required')
    }

    // --- Load ShipEngine API key ---
    const integrationSettings = await getIntegrationSettings(supabaseClient, [
      'shipengine_api_key'
    ])

    if (!integrationSettings.shipengine_api_key) {
      return errorResponse('MISSING_API_KEY', 'ShipEngine API key is not configured')
    }

    // --- Call ShipEngine void endpoint ---
    console.log(`[void-label] Voiding label ${label_id} for order ${order_id}`)

    const voidResponse = await fetch(`https://api.shipengine.com/v1/labels/${label_id}/void`, {
      method: 'PUT',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json',
      },
    })

    if (!voidResponse.ok) {
      const errorBody = await voidResponse.text()
      console.error('[void-label] ShipEngine error:', voidResponse.status, errorBody)

      let errorMessage = `ShipEngine returned ${voidResponse.status}`
      try {
        const parsed = JSON.parse(errorBody)
        const seErrors = parsed.errors || []
        if (seErrors.length > 0) {
          errorMessage = seErrors.map((e: any) => e.message).join('; ')
        }
      } catch { /* use default message */ }

      return errorResponse('VOID_FAILED', errorMessage)
    }

    const voidData = await voidResponse.json()
    console.log('[void-label] ShipEngine response:', JSON.stringify(voidData))

    if (voidData.approved === false) {
      return errorResponse('VOID_REJECTED', 'ShipEngine rejected the void request. The label may have already been used.')
    }

    // --- Update shipments table ---
    const { error: shipmentError } = await supabaseClient
      .from('shipments')
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        status: 'voided',
        updated_at: new Date().toISOString(),
      })
      .eq('label_id', label_id)

    if (shipmentError) {
      console.error('[void-label] Error updating shipment:', shipmentError)
    }

    // --- Reset order shipping state ---
    const { error: orderError } = await supabaseClient
      .from('orders')
      .update({
        tracking_number: null,
        tracking_url: null,
        status: 'processing',
        shipped_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (orderError) {
      console.error('[void-label] Error updating order:', orderError)
    }

    console.log(`[void-label] Label ${label_id} voided successfully`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[void-label] Unexpected error:', error)
    return errorResponse('INTERNAL_ERROR', error.message || 'Failed to void label', 500)
  }
})
