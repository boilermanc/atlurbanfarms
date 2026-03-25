import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'
import { generateTrackingUrl } from '../_shared/shipping-emails.ts'

// Standard weight per seedling based on WooCommerce historical data
const SEEDLING_WEIGHT_OZ = 1.92
const SEEDLING_WEIGHT_LBS = SEEDLING_WEIGHT_OZ / 16  // ~0.12 lbs

interface CreateLabelRequest {
  order_id: string
  service_code: string
  rate_id?: string
  package_weight_lbs?: number
  package_length?: number
  package_width?: number
  package_height?: number
  packages?: Array<{
    weight: { value: number; unit: string }
    dimensions?: { length: number; width: number; height: number; unit: string }
  }>
}

interface ShipEngineLabelResponse {
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

const VALID_SERVICE_CODES = ['ups_ground', 'ups_2nd_day_air', 'ups_3_day_select']
const UPS_CARRIER_ID = 'se-4751564'

/**
 * Get shipping config settings from config_settings table
 */
async function getShippingSettings(supabaseClient: any, keys: string[]): Promise<Record<string, any>> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'shipping')
    .in('key', keys)

  if (error || !data) return {}

  const settings: Record<string, any> = {}
  for (const row of data) {
    settings[row.key] = parseValue(row.value, row.data_type)
  }
  return settings
}

/**
 * Get business config settings (ship-from address fields) from config_settings table.
 */
async function getBusinessSettings(supabaseClient: any): Promise<Record<string, any>> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'business')
    .like('key', 'ship_from_%')

  if (error || !data) return {}

  const settings: Record<string, any> = {}
  for (const row of data) {
    settings[row.key] = parseValue(row.value, row.data_type)
  }
  return settings
}

function parseValue(value: any, dataType: string): any {
  if (value === null || value === undefined) return value
  switch (dataType) {
    case 'number':
      return typeof value === 'number' ? value : parseFloat(value)
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true'
    case 'json':
      if (typeof value === 'object') return value
      try { return JSON.parse(value) } catch { return value }
    default:
      if (typeof value === 'string' && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        try { return JSON.parse(value) } catch { return value }
      }
      return value
  }
}

function normalizeCountry(country: string | null | undefined): string {
  if (!country || country.toLowerCase().includes('united states') || country === 'US') {
    return 'US'
  }
  if (country.length === 2) return country.toUpperCase()
  return 'US'
}

function errorResponse(code: string, message: string, status = 200, details?: any) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, ...(details ? { details } : {}) } }),
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

    const { data: customer } = await supabaseClient
      .from('customers')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!customer || customer.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Admin access required', 403)
    }

    // --- Validate request body ---
    const body: CreateLabelRequest = await req.json()
    const { order_id, service_code, package_weight_lbs } = body

    if (!order_id) {
      return errorResponse('INVALID_REQUEST', 'order_id is required')
    }
    if (!service_code) {
      return errorResponse('INVALID_REQUEST', 'service_code is required')
    }
    if (!VALID_SERVICE_CODES.includes(service_code)) {
      return errorResponse('INVALID_REQUEST', `Invalid service_code. Must be one of: ${VALID_SERVICE_CODES.join(', ')}`)
    }
    const hasPackagesArray = Array.isArray(body.packages) && body.packages.length > 0

    // --- Load config ---
    const integrationSettings = await getIntegrationSettings(supabaseClient, [
      'shipengine_api_key'
    ])

    if (!integrationSettings.shipengine_api_key) {
      return errorResponse('MISSING_API_KEY', 'ShipEngine API key is not configured')
    }

    // --- Check for existing label ---
    const { data: existingShipment } = await supabaseClient
      .from('shipments')
      .select('*')
      .eq('order_id', order_id)
      .eq('voided', false)
      .single()

    if (existingShipment?.label_id) {
      return errorResponse('LABEL_EXISTS', 'A label already exists for this order. Void it first to create a new one.', 200, {
        existing_shipment: existingShipment
      })
    }

    // --- Load order ---
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return errorResponse('ORDER_NOT_FOUND', 'Order not found', 404)
    }

    // --- Guard: pickup orders without a shipping address ---
    if (order.is_pickup && !order.shipping_address_line1) {
      return errorResponse(
        'MISSING_SHIPPING_ADDRESS',
        "This is a pickup order with no shipping address on file. Update the order's shipping address before creating a label.",
        400
      )
    }

    // --- Load warehouse address ---
    const shippingSettings = await getShippingSettings(supabaseClient, ['warehouse_address'])

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

    if (!warehouseAddress || !warehouseAddress.address_line1) {
      return errorResponse('MISSING_CONFIG', 'Warehouse address is not configured. Set it in Admin > Settings > Shipping.')
    }

    // --- Build ship_to from order's shipping address fields ---
    // Always use the order's own shipping columns (never shipping_address_normalized,
    // which may contain a pickup location address for pickup orders).
    const shipTo = {
      name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
      phone: order.shipping_phone || '',
      address_line1: order.shipping_address_line1,
      address_line2: order.shipping_address_line2 || '',
      city_locality: order.shipping_city,
      state_province: order.shipping_state,
      postal_code: order.shipping_zip,
      country_code: normalizeCountry(order.shipping_country),
    }

    if (!shipTo.address_line1) {
      return errorResponse('INVALID_ADDRESS', 'Order is missing a shipping address')
    }

    // --- Dynamic package calculation from order items ---
    let finalPackages: Array<{ weight: { value: number; unit: string }; dimensions?: { length: number; width: number; height: number; unit: string } }>

    if (hasPackagesArray) {
      finalPackages = body.packages!
    } else {
      // Query order items for total seedling quantity
      const { data: orderItems } = await supabaseClient
        .from('order_items')
        .select('quantity')
        .eq('order_id', order_id)

      const totalQuantity = (orderItems || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0)

      // Find the right package from shipping_packages by quantity range
      const { data: packageConfigs } = await supabaseClient
        .from('shipping_packages')
        .select('name, length, width, height, empty_weight, min_quantity, max_quantity')
        .eq('is_active', true)
        .order('min_quantity', { ascending: true })

      let selectedPkg: any = null
      if (packageConfigs && packageConfigs.length > 0) {
        // Find best-fit package where quantity falls within [min, max]
        const fits = packageConfigs.filter((p: any) =>
          totalQuantity >= Number(p.min_quantity) && totalQuantity <= Number(p.max_quantity)
        )
        if (fits.length > 0) {
          // Prefer smallest max_quantity that still fits
          fits.sort((a: any, b: any) => Number(a.max_quantity) - Number(b.max_quantity))
          selectedPkg = fits[0]
        }
        // If quantity exceeds all packages, use the largest
        if (!selectedPkg) {
          selectedPkg = packageConfigs[packageConfigs.length - 1]
        }
      }

      if (selectedPkg) {
        const emptyWeight = Number(selectedPkg.empty_weight)
        const calculatedWeight = emptyWeight + (totalQuantity * SEEDLING_WEIGHT_LBS)
        // Allow manual override via package_weight_lbs
        const finalWeight = (package_weight_lbs && package_weight_lbs > 0) ? package_weight_lbs : calculatedWeight

        finalPackages = [{
          weight: { value: Math.round(finalWeight * 100) / 100, unit: 'pound' },
          dimensions: {
            length: Number(selectedPkg.length),
            width: Number(selectedPkg.width),
            height: Number(selectedPkg.height),
            unit: 'inch'
          }
        }]
        console.log(`[create-label] Dynamic package: ${selectedPkg.name} for ${totalQuantity} seedlings, ` +
          `calculated: ${Math.round(calculatedWeight * 100) / 100}lbs, final: ${Math.round(finalWeight * 100) / 100}lbs`)
      } else {
        // Fallback: use manual weight or error
        const fallbackWeight = package_weight_lbs || 1
        finalPackages = [{
          weight: { value: fallbackWeight, unit: 'pound' },
          dimensions: { length: 12, width: 10, height: 6, unit: 'inch' }
        }]
        console.warn(`[create-label] No shipping_packages config found, using fallback: ${fallbackWeight}lbs`)
      }
    }

    // --- Call ShipEngine to create label ---
    const totalWeight = finalPackages.reduce((sum, p) => sum + p.weight.value, 0)
    console.log(`[create-label] Creating label for order ${order.order_number || order_id}: ${service_code}, ${totalWeight}lbs, rate_id=${body.rate_id || 'none'}`)

    // Prefer rate_id when available (from rate shopping). This is especially
    // important for multi-package (MPS) shipments where the inline shipment
    // approach can fail with UPS "XML Shipping System is unavailable" errors.
    let labelRequestBody: Record<string, any>

    if (body.rate_id) {
      labelRequestBody = {
        rate_id: body.rate_id,
        label_format: 'pdf',
        label_layout: '4x6',
      }
      console.log(`[create-label] Using rate_id: ${body.rate_id}`)
    } else {
      labelRequestBody = {
        shipment: {
          carrier_id: UPS_CARRIER_ID,
          service_code,
          ship_from: {
            name: warehouseAddress.name || 'ATL Urban Farms',
            company_name: warehouseAddress.company_name || 'ATL Urban Farms',
            phone: warehouseAddress.phone || '',
            address_line1: warehouseAddress.address_line1,
            address_line2: warehouseAddress.address_line2 || '',
            city_locality: warehouseAddress.city_locality,
            state_province: warehouseAddress.state_province,
            postal_code: warehouseAddress.postal_code,
            country_code: warehouseAddress.country_code || 'US',
          },
          ship_to: {
            name: shipTo.name,
            phone: shipTo.phone,
            address_line1: shipTo.address_line1,
            address_line2: shipTo.address_line2,
            city_locality: shipTo.city_locality,
            state_province: shipTo.state_province,
            postal_code: shipTo.postal_code,
            country_code: shipTo.country_code,
            address_residential_indicator: 'yes',
          },
          packages: finalPackages,
        },
        label_format: 'pdf',
        label_layout: '4x6',
      }
    }

    const labelResponse = await fetch('https://api.shipengine.com/v1/labels', {
      method: 'POST',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(labelRequestBody),
    })

    if (!labelResponse.ok) {
      const errorBody = await labelResponse.text()
      console.error('[create-label] ShipEngine error:', labelResponse.status, errorBody)

      let errorMessage = `ShipEngine returned ${labelResponse.status}`
      if (labelResponse.status === 401) {
        errorMessage = 'Invalid ShipEngine API key'
      } else if (labelResponse.status === 429) {
        errorMessage = 'ShipEngine rate limit exceeded. Try again in a moment.'
      } else {
        try {
          const parsed = JSON.parse(errorBody)
          const seErrors = parsed.errors || []
          if (seErrors.length > 0) {
            errorMessage = seErrors.map((e: any) => e.message).join('; ')
          }
        } catch { /* use default message */ }
      }

      return errorResponse('LABEL_CREATION_FAILED', errorMessage, 200, { shipengine_status: labelResponse.status })
    }

    const labelData: ShipEngineLabelResponse = await labelResponse.json()
    console.log(`[create-label] Label created: ${labelData.label_id}, tracking: ${labelData.tracking_number}`)

    // --- Write shipment record ---
    const trackingUrl = generateTrackingUrl(labelData.tracking_number, 'ups')

    const { error: shipmentError } = await supabaseClient
      .from('shipments')
      .upsert({
        order_id,
        label_id: labelData.label_id,
        tracking_number: labelData.tracking_number,
        carrier_id: UPS_CARRIER_ID,
        carrier_code: 'ups',
        service_code,
        label_url: labelData.label_download?.pdf || labelData.label_download?.href,
        label_format: 'pdf',
        shipment_cost: labelData.shipment_cost?.amount,
        status: 'label_created',
        voided: false,
        voided_at: null,
        // Schedule shipping notification email for 24 hours from now
        shipping_email_send_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        shipping_email_sent_at: null,
      }, { onConflict: 'order_id' })

    if (shipmentError) {
      console.error('[create-label] Error saving shipment record:', shipmentError)
    }

    // --- Update order status ---
    const { error: orderUpdateError } = await supabaseClient
      .from('orders')
      .update({
        tracking_number: labelData.tracking_number,
        tracking_url: trackingUrl,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (orderUpdateError) {
      console.error('[create-label] Error updating order:', orderUpdateError)
    }

    console.log(`[create-label] Shipping notification email scheduled for ~24h from now`)

    // --- Return result ---
    return new Response(
      JSON.stringify({
        success: true,
        label_id: labelData.label_id,
        label_url: labelData.label_download?.pdf || labelData.label_download?.href,
        tracking_number: labelData.tracking_number,
        tracking_url: trackingUrl,
        shipment_cost: labelData.shipment_cost?.amount,
        carrier_code: 'ups',
        service_code,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[create-label] Unexpected error:', error)
    return errorResponse('INTERNAL_ERROR', error.message || 'Failed to create label', 500)
  }
})
