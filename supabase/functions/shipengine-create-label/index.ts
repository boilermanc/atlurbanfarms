import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'
import { sendShippingEmail, getCarrierDisplayName, generateTrackingUrl } from '../_shared/shipping-emails.ts'

interface CreateLabelRequest {
  order_id: string
}

interface ShipEngineLabel {
  label_id: string
  tracking_number: string
  label_download: {
    pdf: string
    png: string
    zpl: string
    href: string
  }
  shipment_cost: {
    amount: number
    currency: string
  }
  carrier_id: string
  carrier_code: string
  service_code: string
}

/**
 * Get shipping config settings from config_settings table
 */
async function getShippingSettings(supabaseClient: any, keys: string[]): Promise<Record<string, any>> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'shipping')
    .in('key', keys)

  if (error || !data) {
    return {}
  }

  const settings: Record<string, any> = {}
  for (const row of data) {
    settings[row.key] = parseValue(row.value, row.data_type)
  }
  return settings
}

/**
 * Get business config settings (ship-from address fields) from config_settings table.
 * Fallback for when warehouse_address JSON object is not saved.
 */
async function getBusinessSettings(supabaseClient: any): Promise<Record<string, any>> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'business')
    .like('key', 'ship_from_%')

  if (error || !data) {
    return {}
  }

  const settings: Record<string, any> = {}
  for (const row of data) {
    settings[row.key] = parseValue(row.value, row.data_type)
  }
  return settings
}

function parseValue(value: string, dataType: string): any {
  switch (dataType) {
    case 'number':
      return parseFloat(value)
    case 'boolean':
      return value === 'true'
    case 'json':
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    default:
      return value
  }
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

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization required' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: adminRole } = await supabaseClient
      .from('admin_user_roles')
      .select('id')
      .eq('customer_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
    const { order_id }: CreateLabelRequest = await req.json()

    if (!order_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'order_id is required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if a label already exists for this order
    const { data: existingShipment } = await supabaseClient
      .from('shipments')
      .select('*')
      .eq('order_id', order_id)
      .eq('voided', false)
      .single()

    if (existingShipment && existingShipment.label_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'LABEL_EXISTS',
            message: 'A label already exists for this order',
            existing_shipment: existingShipment
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Load order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found'
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get shipping config (includes composite JSON keys and individual field keys)
    const shippingSettings = await getShippingSettings(supabaseClient, [
      'warehouse_address',
      'default_package',
      'default_package_length',
      'default_package_width',
      'default_package_height',
      'default_package_weight',
    ])

    // Try composite JSON key first, then fall back to individual business category fields
    let warehouseAddress = shippingSettings.warehouse_address
    if (!warehouseAddress || !warehouseAddress.address_line1) {
      const businessSettings = await getBusinessSettings(supabaseClient)
      if (businessSettings.ship_from_address_line1) {
        warehouseAddress = {
          name: 'ATL Urban Farms',
          company_name: 'ATL Urban Farms',
          address_line1: businessSettings.ship_from_address_line1,
          address_line2: businessSettings.ship_from_address_line2 || '',
          city_locality: businessSettings.ship_from_city || '',
          state_province: businessSettings.ship_from_state || '',
          postal_code: businessSettings.ship_from_zip || '',
          country_code: businessSettings.ship_from_country || 'US',
        }
      }
    }

    // Try composite JSON key first, then fall back to individual shipping dimension fields
    let defaultPackage = shippingSettings.default_package
    if (!defaultPackage || !defaultPackage.weight) {
      const pkgLength = shippingSettings.default_package_length || 12
      const pkgWidth = shippingSettings.default_package_width || 9
      const pkgHeight = shippingSettings.default_package_height || 6
      const pkgWeight = shippingSettings.default_package_weight || 1
      defaultPackage = {
        weight: { value: pkgWeight, unit: 'pound' },
        dimensions: { length: pkgLength, width: pkgWidth, height: pkgHeight, unit: 'inch' },
      }
    }

    if (!warehouseAddress || !warehouseAddress.address_line1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Warehouse address is not configured. Please configure in Admin > Settings > Shipping.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let labelResponse: Response
    let labelData: ShipEngineLabel

    // If order has a rate_id, use it to create the label
    if (order.shipping_rate_id) {
      labelResponse = await fetch('https://api.shipengine.com/v1/labels', {
        method: 'POST',
        headers: {
          'API-Key': integrationSettings.shipengine_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rate_id: order.shipping_rate_id,
          label_format: 'pdf',
          label_layout: '4x6'
        })
      })
    } else {
      // Build shipment from order data
      const shipTo = order.shipping_address_normalized || {
        name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
        phone: order.shipping_phone || '',
        address_line1: order.shipping_address_line1,
        address_line2: order.shipping_address_line2 || '',
        city_locality: order.shipping_city,
        state_province: order.shipping_state,
        postal_code: order.shipping_zip,
        country_code: order.shipping_country || 'US'
      }

      // Get carrier info - prefer stored carrier or fetch first available
      let carrierId = order.shipping_carrier_id
      let serviceCode = order.shipping_service_code

      if (!carrierId) {
        // Fetch carriers and use the first one
        const carriersResponse = await fetch('https://api.shipengine.com/v1/carriers', {
          method: 'GET',
          headers: {
            'API-Key': integrationSettings.shipengine_api_key,
            'Content-Type': 'application/json'
          }
        })

        if (carriersResponse.ok) {
          const carriersData = await carriersResponse.json()
          const activeCarrier = carriersData.carriers?.find((c: any) => !c.disabled)
          if (activeCarrier) {
            carrierId = activeCarrier.carrier_id
            // Use a default service code
            serviceCode = serviceCode || 'usps_priority_mail'
          }
        }
      }

      if (!carrierId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'NO_CARRIER',
              message: 'No carrier available for label creation'
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      labelResponse = await fetch('https://api.shipengine.com/v1/labels', {
        method: 'POST',
        headers: {
          'API-Key': integrationSettings.shipengine_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shipment: {
            carrier_id: carrierId,
            service_code: serviceCode || 'usps_priority_mail',
            ship_from: {
              name: warehouseAddress.name || 'ATL Urban Farms',
              company_name: warehouseAddress.company_name || 'ATL Urban Farms',
              phone: warehouseAddress.phone || '',
              address_line1: warehouseAddress.address_line1,
              address_line2: warehouseAddress.address_line2 || '',
              city_locality: warehouseAddress.city_locality,
              state_province: warehouseAddress.state_province,
              postal_code: warehouseAddress.postal_code,
              country_code: warehouseAddress.country_code || 'US'
            },
            ship_to: {
              name: shipTo.name || `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
              phone: shipTo.phone || order.shipping_phone || '',
              address_line1: shipTo.address_line1 || order.shipping_address_line1,
              address_line2: shipTo.address_line2 || order.shipping_address_line2 || '',
              city_locality: shipTo.city_locality || order.shipping_city,
              state_province: shipTo.state_province || order.shipping_state,
              postal_code: shipTo.postal_code || order.shipping_zip,
              country_code: shipTo.country_code || order.shipping_country || 'US'
            },
            packages: [defaultPackage || {
              weight: { value: 2, unit: 'pound' },
              dimensions: { length: 10, width: 8, height: 6, unit: 'inch' }
            }]
          },
          label_format: 'pdf',
          label_layout: '4x6'
        })
      })
    }

    if (!labelResponse.ok) {
      const errorBody = await labelResponse.text()
      console.error('ShipEngine label creation error:', errorBody)

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'LABEL_CREATION_FAILED',
            message: `Failed to create label: ${labelResponse.status}`,
            details: errorBody
          }
        }),
        {
          status: labelResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    labelData = await labelResponse.json()

    // Store shipment record in database
    const shipmentData = {
      order_id: order_id,
      label_id: labelData.label_id,
      tracking_number: labelData.tracking_number,
      carrier_id: labelData.carrier_id,
      carrier_code: labelData.carrier_code,
      service_code: labelData.service_code,
      label_url: labelData.label_download?.pdf || labelData.label_download?.href,
      label_format: 'pdf',
      shipment_cost: labelData.shipment_cost?.amount,
      status: 'label_created'
    }

    const { data: shipment, error: shipmentError } = await supabaseClient
      .from('shipments')
      .upsert(shipmentData, { onConflict: 'order_id' })
      .select()
      .single()

    if (shipmentError) {
      console.error('Error saving shipment:', shipmentError)
      // Don't fail the request, label was created successfully
    }

    // Update order with tracking info (status stays 'processing' until carrier picks up)
    const trackingUrl = generateTrackingUrl(labelData.tracking_number, labelData.carrier_code)
    await supabaseClient
      .from('orders')
      .update({
        tracking_number: labelData.tracking_number,
        tracking_url: trackingUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    // Send shipping notification email
    try {
      const emailResult = await sendShippingEmail(
        supabaseClient,
        'shipping_label_created',
        order_id,
        {
          tracking_number: labelData.tracking_number,
          carrier_code: labelData.carrier_code,
          carrier: getCarrierDisplayName(labelData.carrier_code),
          tracking_url: generateTrackingUrl(labelData.tracking_number, labelData.carrier_code),
        }
      )

      if (emailResult.success) {
        console.log('Shipping notification email sent successfully')
      } else {
        console.warn('Failed to send shipping notification email:', emailResult.error)
      }
    } catch (emailError) {
      // Don't fail the label creation if email fails
      console.error('Error sending shipping notification email:', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        label: {
          label_id: labelData.label_id,
          tracking_number: labelData.tracking_number,
          label_url: labelData.label_download?.pdf || labelData.label_download?.href,
          label_png_url: labelData.label_download?.png,
          shipment_cost: labelData.shipment_cost?.amount,
          carrier_id: labelData.carrier_id,
          carrier_code: labelData.carrier_code,
          service_code: labelData.service_code
        },
        shipment
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Create label error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to create label'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
