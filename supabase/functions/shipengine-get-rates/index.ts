import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface Address {
  name?: string
  company_name?: string
  phone?: string
  address_line1: string
  address_line2?: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code?: string
}

interface PackageDetails {
  weight: {
    value: number
    unit: 'pound' | 'ounce' | 'gram' | 'kilogram'
  }
  dimensions?: {
    length: number
    width: number
    height: number
    unit: 'inch' | 'centimeter'
  }
}

interface RateRequest {
  ship_to: Address
  packages?: PackageDetails[]
  order_items?: Array<{
    quantity: number
    weight_per_item?: number  // pounds, default 0.5
  }>
}

interface ShippingRate {
  rate_id: string
  carrier_id: string
  carrier_code: string
  carrier_friendly_name: string
  service_code: string
  service_type: string
  shipping_amount: number
  currency: string
  delivery_days: number | null
  estimated_delivery_date: string | null
  carrier_delivery_days: string | null
  guaranteed_service: boolean
}

interface RatesResponse {
  success: boolean
  rates: ShippingRate[]
  ship_from: Address
  ship_to: Address
  zone_info?: {
    status: 'allowed' | 'blocked' | 'conditional'
    message?: string
    conditions?: any
  }
  package_breakdown?: {
    total_packages: number
    packages: Array<{
      name: string
      dimensions: PackageDetails['dimensions']
      weight: PackageDetails['weight']
      item_count: number
    }>
    summary: string
  }
  carrier_errors?: Array<{
    carrier_id: string
    carrier_friendly_name: string
    message: string
  }>
}

interface ShippingZone {
  id: string
  state_code: string
  state_name: string
  status: 'allowed' | 'blocked' | 'conditional'
  conditions: {
    required_service?: string
    blocked_months?: number[]
    min_order_value?: number
    max_transit_days?: number
  } | null
  customer_message: string | null
}

interface ShippingZoneRule {
  id: string
  name: string
  rule_type: 'seasonal_block' | 'service_requirement' | 'transit_limit' | 'surcharge'
  priority: number
  conditions: {
    states?: string[]
    months?: number[]
    max_transit_days?: number
    categories?: string[]
    min_order_value?: number
  }
  actions: {
    block?: boolean
    block_message?: string
    required_services?: string[]
    surcharge_amount?: number
    surcharge_percent?: number
  }
  effective_start: string | null
  effective_end: string | null
  is_active: boolean
}

interface ShippingPackageConfig {
  id: string
  name: string
  length: number
  width: number
  height: number
  empty_weight: number
  min_quantity: number
  max_quantity: number
  is_default: boolean
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
 * The admin ShippingSettingsTab saves ship-from address as individual fields
 * under the 'business' category rather than as a JSON object.
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

/**
 * Get shipping zone for a state
 */
async function getShippingZone(supabaseClient: any, stateCode: string): Promise<ShippingZone | null> {
  const { data, error } = await supabaseClient
    .from('shipping_zones')
    .select('*')
    .eq('state_code', stateCode.toUpperCase())
    .single()

  if (error || !data) {
    // Default to allowed if zone not found
    return null
  }

  return data
}

/**
 * Get active shipping rules that apply to a state
 */
async function getApplicableRules(supabaseClient: any, stateCode: string): Promise<ShippingZoneRule[]> {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12

  const { data, error } = await supabaseClient
    .from('shipping_zone_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (error || !data) {
    return []
  }

  // Filter rules that apply to this state and current date/month
  return data.filter((rule: ShippingZoneRule) => {
    // Check if rule applies to this state
    if (rule.conditions.states && rule.conditions.states.length > 0) {
      if (!rule.conditions.states.includes(stateCode.toUpperCase())) {
        return false
      }
    }

    // Check effective dates
    if (rule.effective_start) {
      if (new Date(rule.effective_start) > now) return false
    }
    if (rule.effective_end) {
      if (new Date(rule.effective_end) < now) return false
    }

    // Check if current month is in blocked months
    if (rule.conditions.months && rule.conditions.months.length > 0) {
      if (!rule.conditions.months.includes(currentMonth)) {
        return false
      }
    }

    return true
  })
}

/**
 * Check shipping zone restrictions
 */
interface ZoneCheckResult {
  allowed: boolean
  status: 'allowed' | 'blocked' | 'conditional'
  message?: string
  conditions?: any
  surcharge_amount?: number
  surcharge_percent?: number
  max_transit_days?: number
  required_services?: string[]
}

async function checkShippingZone(
  supabaseClient: any,
  stateCode: string
): Promise<ZoneCheckResult> {
  const zone = await getShippingZone(supabaseClient, stateCode)
  const rules = await getApplicableRules(supabaseClient, stateCode)

  const currentMonth = new Date().getMonth() + 1

  // Default result
  let result: ZoneCheckResult = {
    allowed: true,
    status: 'allowed'
  }

  // Check zone status
  if (zone) {
    result.status = zone.status

    if (zone.status === 'blocked') {
      return {
        allowed: false,
        status: 'blocked',
        message: zone.customer_message || `We cannot ship to ${zone.state_name} at this time.`
      }
    }

    if (zone.status === 'conditional' && zone.conditions) {
      result.conditions = zone.conditions
      result.message = zone.customer_message || undefined

      // Check blocked months
      if (zone.conditions.blocked_months?.includes(currentMonth)) {
        return {
          allowed: false,
          status: 'blocked',
          message: zone.customer_message || `Shipping to ${zone.state_name} is temporarily suspended.`
        }
      }

      // Pass along conditions for rate filtering
      if (zone.conditions.max_transit_days) {
        result.max_transit_days = zone.conditions.max_transit_days
      }
      if (zone.conditions.required_service) {
        result.required_services = [zone.conditions.required_service]
      }
    }
  }

  // Apply rules (in priority order)
  for (const rule of rules) {
    if (rule.actions.block) {
      return {
        allowed: false,
        status: 'blocked',
        message: rule.actions.block_message || 'Shipping to this location is not available at this time.'
      }
    }

    // Collect conditions from rules
    if (rule.actions.required_services?.length) {
      result.required_services = [
        ...(result.required_services || []),
        ...rule.actions.required_services
      ]
    }

    if (rule.conditions.max_transit_days) {
      result.max_transit_days = Math.min(
        result.max_transit_days || 999,
        rule.conditions.max_transit_days
      )
    }

    if (rule.actions.surcharge_amount) {
      result.surcharge_amount = (result.surcharge_amount || 0) + rule.actions.surcharge_amount
    }

    if (rule.actions.surcharge_percent) {
      result.surcharge_percent = (result.surcharge_percent || 0) + rule.actions.surcharge_percent
    }
  }

  return result
}

/**
 * Get enabled carrier IDs.
 * First checks carrier_configurations table for synced carriers with ShipEngine carrier IDs.
 * Falls back to fetching all active carriers from ShipEngine API if none configured in DB.
 */
async function getCarrierIds(supabaseClient: any, apiKey: string, mode?: string): Promise<string[]> {
  const isSandbox = mode === 'sandbox'

  // In sandbox mode, skip DB carriers (they contain production carrier IDs)
  // and go straight to ShipEngine API discovery with the sandbox key
  if (!isSandbox) {
    // Try DB-configured carriers first
    const { data: dbCarriers, error: dbError } = await supabaseClient
      .from('carrier_configurations')
      .select('carrier_name, api_credentials, is_enabled')
      .eq('is_enabled', true)

    if (!dbError && dbCarriers && dbCarriers.length > 0) {
      const dbIds = dbCarriers
        .filter((c: any) => c.api_credentials?.shipengine_carrier_id)
        .map((c: any) => c.api_credentials.shipengine_carrier_id as string)

      if (dbIds.length > 0) {
        console.log(`Using ${dbIds.length} carrier(s) from carrier_configurations:`,
          dbCarriers
            .filter((c: any) => c.is_enabled && c.api_credentials?.shipengine_carrier_id)
            .map((c: any) => `${c.carrier_name} (${c.api_credentials.shipengine_carrier_id})`)
        )
        return dbIds
      }
    }
  }

  // Fallback (or sandbox mode): fetch all active carriers from ShipEngine API
  console.log(isSandbox
    ? 'Sandbox mode: discovering carriers from ShipEngine API (skipping DB carrier IDs)'
    : 'No enabled carriers in carrier_configurations with ShipEngine IDs, falling back to ShipEngine API discovery'
  )
  const response = await fetch('https://api.shipengine.com/v1/carriers', {
    method: 'GET',
    headers: {
      'API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    console.error('Failed to fetch carriers:', await response.text())
    return []
  }

  const data = await response.json()
  const carriers = (data.carriers || []).filter((c: any) => !c.disabled)
  console.log(`ShipEngine API returned ${carriers.length} active carrier(s):`,
    carriers.map((c: any) => `${c.friendly_name || c.carrier_code} (${c.carrier_id})`)
  )
  return carriers.map((c: any) => c.carrier_id)
}

/**
 * Get shipping package configurations from database
 */
async function getShippingPackageConfigs(supabaseClient: any): Promise<ShippingPackageConfig[]> {
  const { data, error } = await supabaseClient
    .from('shipping_packages')
    .select('*')
    .eq('is_active', true)
    .order('min_quantity', { ascending: true })

  if (error || !data) {
    console.error('Error fetching shipping packages:', error)
    return []
  }

  // Coerce DB values to numbers — Supabase decimal/numeric columns can return strings
  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    length: Number(row.length),
    width: Number(row.width),
    height: Number(row.height),
    empty_weight: Number(row.empty_weight),
    min_quantity: Number(row.min_quantity),
    max_quantity: Number(row.max_quantity),
    is_default: !!row.is_default,
  }))
}

/**
 * Calculate packages needed for an order based on item quantities
 */
interface CalculatedPackageInfo {
  packages: PackageDetails[]
  breakdown: Array<{
    name: string
    dimensions: PackageDetails['dimensions']
    weight: PackageDetails['weight']
    item_count: number
  }>
  summary: string
}

function calculateOrderPackages(
  totalQuantity: number,
  weightPerItem: number,
  packageConfigs: ShippingPackageConfig[]
): CalculatedPackageInfo {
  if (packageConfigs.length === 0 || totalQuantity <= 0) {
    return {
      packages: [],
      breakdown: [],
      summary: 'No package configuration available'
    }
  }

  const sortedConfigs = [...packageConfigs].sort((a, b) => b.max_quantity - a.max_quantity)
  const largest = sortedConfigs[0]
  const packages: PackageDetails[] = []
  const breakdown: CalculatedPackageInfo['breakdown'] = []
  let remaining = totalQuantity

  const findPackage = (qty: number): ShippingPackageConfig => {
    // Find ALL configs where qty falls within [min, max] range
    const fits = packageConfigs.filter(p => qty >= p.min_quantity && qty <= p.max_quantity)
    if (fits.length > 0) {
      // Prefer the best fit: smallest max_quantity that still contains qty
      // This prevents a Small Box (1-999) from matching when Large Box (13-24) is more appropriate
      fits.sort((a, b) => a.max_quantity - b.max_quantity)
      const bestFit = fits.find(p => p.max_quantity >= qty) || fits[fits.length - 1]
      return bestFit
    }

    // If quantity is larger than any package, use largest
    if (qty > largest.max_quantity) return largest

    // Find smallest package that can fit
    const fitting = [...sortedConfigs].reverse().find(p => qty <= p.max_quantity)
    return fitting || packageConfigs.find(p => p.is_default) || largest
  }

  while (remaining > 0) {
    const pkg = findPackage(remaining)
    const itemsInPackage = Math.min(remaining, pkg.max_quantity)
    const totalWeight = Number(pkg.empty_weight) + (itemsInPackage * weightPerItem)

    packages.push({
      weight: {
        value: Math.round(totalWeight * 100) / 100,
        unit: 'pound'
      },
      dimensions: {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        unit: 'inch'
      }
    })

    breakdown.push({
      name: pkg.name,
      dimensions: {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        unit: 'inch'
      },
      weight: {
        value: Math.round(totalWeight * 100) / 100,
        unit: 'pound'
      },
      item_count: itemsInPackage
    })

    remaining -= itemsInPackage
  }

  // Generate summary (always include item count for transparency)
  const totalItems = breakdown.reduce((sum, b) => sum + b.item_count, 0)
  let summary: string
  if (packages.length === 1) {
    summary = `Ships in: 1 ${breakdown[0].name} (${totalItems} items)`
  } else {
    const counts = breakdown.reduce((acc, p) => {
      acc[p.name] = (acc[p.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const parts = Object.entries(counts)
      .map(([name, count]) => count > 1 ? `${count} ${name}` : name)

    summary = `Ships in: ${packages.length} packages (${parts.join(' + ')}) — ${totalItems} items`
  }

  console.log('[calculateOrderPackages] Result:', JSON.stringify({
    totalQuantity,
    weightPerItem,
    configCount: packageConfigs.length,
    configs: packageConfigs.map(c => `${c.name}(${c.min_quantity}-${c.max_quantity})`),
    result: breakdown.map(b => `${b.name}:${b.item_count}`),
    summary
  }))

  return { packages, breakdown, summary }
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

    // Get ShipEngine API key from integration settings
    const integrationSettings = await getIntegrationSettings(supabaseClient, [
      'shipstation_enabled',
      'shipengine_api_key'
    ])

    if (!integrationSettings.shipstation_enabled) {
      console.error('INTEGRATION_DISABLED: shipstation_enabled is not true in integrations settings')
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTEGRATION_DISABLED',
            message: 'ShipEngine integration is not enabled. Enable it in Admin > Settings > Integrations.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!integrationSettings.shipengine_api_key) {
      console.error('MISSING_API_KEY: shipengine_api_key not found in integrations settings')
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'ShipEngine API key is not configured. Set it in Admin > Settings > Integrations.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get shipping config settings (includes composite JSON keys and individual field keys)
    const shippingSettings = await getShippingSettings(supabaseClient, [
      'warehouse_address',
      'default_package',
      'default_package_length',
      'default_package_width',
      'default_package_height',
      'default_package_weight',
      'shipping_rate_markup_type',
      'shipping_rate_markup_percent',
      'shipping_rate_markup_dollars',
      'forced_service_default',
      'forced_service_overrides',
      'allowed_service_codes'
    ])

    // Try composite JSON key first, then fall back to individual business category fields
    let warehouseAddress = shippingSettings.warehouse_address
    if (!warehouseAddress || !warehouseAddress.address_line1) {
      console.log('warehouse_address JSON not found in shipping settings, trying individual business fields...')
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
        console.log('Composed warehouse address from business fields:', JSON.stringify(warehouseAddress))
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
      console.log('Composed default package from individual fields:', JSON.stringify(defaultPackage))
    }

    const markupType = shippingSettings.shipping_rate_markup_type || 'percentage'
    const markupPercent = shippingSettings.shipping_rate_markup_percent || 0
    const markupDollars = shippingSettings.shipping_rate_markup_dollars || 0

    // Detect sandbox mode from API key prefix
    const isSandbox = (integrationSettings.shipengine_api_key as string).startsWith('TEST_')
    const apiKeyPreview = (integrationSettings.shipengine_api_key as string).slice(0, 8) + '...'

    console.log('[shipengine-get-rates] Config:', JSON.stringify({
      mode: integrationSettings.shipengine_mode || 'unknown',
      isSandbox,
      apiKeyPrefix: apiKeyPreview,
      hasWarehouseAddress: !!warehouseAddress?.address_line1,
      warehouseCity: warehouseAddress?.city_locality || 'NOT SET',
      warehouseState: warehouseAddress?.state_province || 'NOT SET',
      warehouseZip: warehouseAddress?.postal_code || 'NOT SET',
      defaultPackageDims: defaultPackage ? `${defaultPackage.dimensions?.length}x${defaultPackage.dimensions?.width}x${defaultPackage.dimensions?.height}` : 'NOT SET',
      defaultPackageWeight: defaultPackage?.weight?.value || 'NOT SET',
      markupType,
      markupPercent,
      markupDollars,
    }))

    if (isSandbox) {
      console.warn('[shipengine-get-rates] SANDBOX MODE: Using TEST_ API key — rates are estimated retail, not negotiated.')
    }

    if (!warehouseAddress || !warehouseAddress.address_line1) {
      console.error('MISSING_CONFIG: No warehouse address found in shipping.warehouse_address or business.ship_from_* fields')
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Warehouse address is not configured. Please configure shipping settings in Admin > Settings > Shipping.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { ship_to, packages, order_items }: RateRequest = await req.json()

    if (!ship_to || !ship_to.address_line1 || !ship_to.city_locality ||
        !ship_to.state_province || !ship_to.postal_code) {
      console.error('INVALID_REQUEST: Missing ship_to fields:', JSON.stringify(ship_to))
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'ship_to address is required with address_line1, city_locality, state_province, and postal_code'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check shipping zone restrictions
    const zoneCheck = await checkShippingZone(supabaseClient, ship_to.state_province)

    if (!zoneCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'ZONE_BLOCKED',
            message: zoneCheck.message || 'Shipping to this location is not available.'
          },
          zone_info: {
            status: zoneCheck.status,
            message: zoneCheck.message
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get enabled carrier IDs (from DB first, then ShipEngine API fallback)
    const carrierIds = await getCarrierIds(supabaseClient, integrationSettings.shipengine_api_key, integrationSettings.shipengine_mode)

    if (carrierIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NO_CARRIERS',
            message: 'No active carriers found. Sync carriers in Admin > Shipping > Carriers, or check ShipEngine account.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate packages based on order items or use provided/default packages
    let packageList: PackageDetails[]
    let packageBreakdown: CalculatedPackageInfo | null = null

    if (packages && packages.length > 0) {
      // Use manually provided packages
      packageList = packages
    } else if (order_items && order_items.length > 0) {
      // Calculate packages based on order items using shipping_packages config
      const packageConfigs = await getShippingPackageConfigs(supabaseClient)
      const totalQuantity = order_items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      const avgWeight = order_items.length > 0
        ? order_items.reduce((sum, item) => sum + (Number(item.weight_per_item) || 0.5), 0) / order_items.length
        : 0.5

      console.log('[shipengine-get-rates] Package calculation input:', JSON.stringify({
        order_items_count: order_items.length,
        order_items_quantities: order_items.map((item: any) => ({ qty: item.quantity, type: typeof item.quantity })),
        totalQuantity,
        avgWeight,
        packageConfigs_count: packageConfigs.length,
        packageConfigs: packageConfigs.map(c => ({ name: c.name, min: c.min_quantity, max: c.max_quantity }))
      }))

      if (packageConfigs.length > 0) {
        packageBreakdown = calculateOrderPackages(totalQuantity, avgWeight, packageConfigs)
        packageList = packageBreakdown.packages
      } else {
        console.warn('[shipengine-get-rates] No active package configs found, using default package')
        packageList = [defaultPackage]
      }
    } else {
      packageList = [defaultPackage]
    }

    // Ensure we have at least one package
    if (packageList.length === 0) {
      packageList = [defaultPackage]
    }

    // Build ShipEngine rate request
    const rateRequest = {
      rate_options: {
        carrier_ids: carrierIds
      },
      shipment: {
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
          name: ship_to.name || '',
          company_name: ship_to.company_name || '',
          phone: ship_to.phone || '',
          address_line1: ship_to.address_line1,
          address_line2: ship_to.address_line2 || '',
          city_locality: ship_to.city_locality,
          state_province: ship_to.state_province,
          postal_code: ship_to.postal_code,
          country_code: ship_to.country_code || 'US'
        },
        packages: packageList.map(pkg => ({
          weight: pkg.weight,
          dimensions: pkg.dimensions
        }))
      }
    }

    // Call ShipEngine rates API
    console.log('[shipengine-get-rates] Request to ShipEngine:', JSON.stringify({
      carrier_ids: carrierIds,
      ship_from: `${rateRequest.shipment.ship_from.city_locality}, ${rateRequest.shipment.ship_from.state_province} ${rateRequest.shipment.ship_from.postal_code}`,
      ship_to: `${rateRequest.shipment.ship_to.city_locality}, ${rateRequest.shipment.ship_to.state_province} ${rateRequest.shipment.ship_to.postal_code}`,
      packages: rateRequest.shipment.packages.map((p: any) => ({
        weight: p.weight,
        dims: p.dimensions ? `${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}` : 'none'
      }))
    }))

    const shipEngineResponse = await fetch('https://api.shipengine.com/v1/rates', {
      method: 'POST',
      headers: {
        'API-Key': integrationSettings.shipengine_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rateRequest)
    })

    if (!shipEngineResponse.ok) {
      const errorBody = await shipEngineResponse.text()
      console.error(`[shipengine-get-rates] ShipEngine API ERROR ${shipEngineResponse.status}:`, errorBody)
      console.error('[shipengine-get-rates] Full request payload:', JSON.stringify(rateRequest))

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPENGINE_ERROR',
            message: `ShipEngine API error: ${shipEngineResponse.status}`,
            details: errorBody
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const rateResponse = await shipEngineResponse.json()

    // Capture carrier-level errors for debugging
    const carrierErrors: RatesResponse['carrier_errors'] = []
    if (rateResponse.rate_response?.errors?.length > 0) {
      for (const e of rateResponse.rate_response.errors) {
        console.warn('Rate calculation warning:', e.carrier_friendly_name || e.carrier_id, '-', e.message)
        carrierErrors.push({
          carrier_id: e.carrier_id || 'unknown',
          carrier_friendly_name: e.carrier_friendly_name || 'Unknown Carrier',
          message: e.message || 'Unknown error'
        })
      }
    }

    // Transform rates to our format, applying zone restrictions
    let rates: ShippingRate[] = (rateResponse.rate_response?.rates || [])
      .filter((rate: any) => rate.shipping_amount?.amount != null)
      .filter((rate: any) => {
        // Filter by max transit days if zone requires it
        if (zoneCheck.max_transit_days && rate.delivery_days) {
          if (rate.delivery_days > zoneCheck.max_transit_days) {
            return false
          }
        }
        return true
      })
      .map((rate: any) => {
        // Apply markup based on configured type
        let amount = rate.shipping_amount.amount
        if (markupType === 'fixed' && markupDollars > 0) {
          // Fixed dollar amount markup
          amount = amount + markupDollars
        } else if (markupType === 'percentage' && markupPercent > 0) {
          // Percentage markup
          amount = amount * (1 + markupPercent / 100)
        }

        // Apply zone surcharges
        if (zoneCheck.surcharge_amount) {
          amount = amount + zoneCheck.surcharge_amount
        }
        if (zoneCheck.surcharge_percent) {
          amount = amount * (1 + zoneCheck.surcharge_percent / 100)
        }

        amount = Math.round(amount * 100) / 100 // Round to 2 decimal places

        return {
          rate_id: rate.rate_id,
          carrier_id: rate.carrier_id,
          carrier_code: rate.carrier_code,
          carrier_friendly_name: rate.carrier_friendly_name,
          service_code: rate.service_code,
          service_type: rate.service_type,
          shipping_amount: amount,
          currency: rate.shipping_amount.currency || 'USD',
          delivery_days: rate.delivery_days || null,
          estimated_delivery_date: rate.estimated_delivery_date || null,
          carrier_delivery_days: rate.carrier_delivery_days || null,
          guaranteed_service: rate.guaranteed_service || false
        }
      })
      // Sort by price (cheapest first)
      .sort((a: ShippingRate, b: ShippingRate) => a.shipping_amount - b.shipping_amount)

    // Filter by allowed service codes from config (e.g. ups_ground, ups_2nd_day_air, ups_3_day_select)
    const allowedServiceCodes: string[] | undefined = shippingSettings.allowed_service_codes
    if (allowedServiceCodes && Array.isArray(allowedServiceCodes) && allowedServiceCodes.length > 0) {
      const beforeCount = rates.length
      rates = rates.filter(rate => allowedServiceCodes.includes(rate.service_code))
      console.log(`Filtered rates by allowed_service_codes: ${beforeCount} → ${rates.length} (allowed: ${allowedServiceCodes.join(', ')})`)
    }

    // If zone requires specific services, filter or mark rates
    if (zoneCheck.required_services?.length && rates.length > 0) {
      const priorityServices = ['priority', 'express', 'expedited', '2_day', '1_day', 'overnight']
      const requiredServiceTypes = zoneCheck.required_services.map(s => s.toLowerCase())

      // Check if any required service is a priority/speed requirement
      const needsFastService = requiredServiceTypes.some(s =>
        priorityServices.some(p => s.includes(p) || p.includes(s))
      )

      if (needsFastService) {
        // Filter to only show faster services (priority, express, etc.)
        const fastRates = rates.filter(rate => {
          const serviceType = rate.service_type.toLowerCase()
          const serviceCode = rate.service_code.toLowerCase()
          return priorityServices.some(p =>
            serviceType.includes(p) || serviceCode.includes(p)
          ) || rate.delivery_days && rate.delivery_days <= 3
        })

        // If we found fast rates, use those; otherwise keep all rates but warn
        if (fastRates.length > 0) {
          rates = fastRates
        }
      }
    }

    // Forced service assignment: filter to a single service based on destination state
    const forcedDefault = shippingSettings.forced_service_default
    if (forcedDefault && rates.length > 0) {
      const overrides = shippingSettings.forced_service_overrides || { service_code: '', states: [] }
      const destState = (ship_to.state_province || '').toUpperCase()
      const forcedCode = (Array.isArray(overrides.states) && overrides.states.includes(destState) && overrides.service_code)
        ? overrides.service_code
        : forcedDefault

      console.log(`Forced service: ${forcedCode} for state ${destState}`)
      const forcedRates = rates.filter(r => r.service_code === forcedCode)
      if (forcedRates.length > 0) {
        rates = forcedRates
      } else {
        console.warn(`Forced service code "${forcedCode}" not found in rates, showing all rates as fallback`)
      }
    }

    // Build markup info for transparency
    const markupInfo = (markupType === 'fixed' && markupDollars > 0)
      ? { type: 'fixed' as const, amount: markupDollars }
      : (markupType === 'percentage' && markupPercent > 0)
        ? { type: 'percentage' as const, percent: markupPercent }
        : null

    console.log(`[shipengine-get-rates] Success: ${rates.length} rate(s) returned`, rates.map(r =>
      `${r.carrier_friendly_name} ${r.service_code} $${r.shipping_amount} (${r.delivery_days ?? '?'} days)`
    ))
    if (carrierErrors.length > 0) {
      console.warn(`[shipengine-get-rates] ${carrierErrors.length} carrier error(s):`, carrierErrors.map(e =>
        `${e.carrier_friendly_name}: ${e.message}`
      ))
    }

    const response: RatesResponse & {
      carrier_ids_used?: string[]
      is_sandbox?: boolean
      markup_applied?: { type: 'fixed'; amount: number } | { type: 'percentage'; percent: number } | null
    } = {
      success: true,
      rates,
      ship_from: warehouseAddress,
      ship_to,
      zone_info: zoneCheck.status !== 'allowed' ? {
        status: zoneCheck.status,
        message: zoneCheck.message,
        conditions: zoneCheck.conditions
      } : undefined,
      package_breakdown: packageBreakdown ? {
        total_packages: packageBreakdown.packages.length,
        packages: packageBreakdown.breakdown,
        summary: packageBreakdown.summary
      } : undefined,
      carrier_errors: carrierErrors.length > 0 ? carrierErrors : undefined,
      carrier_ids_used: carrierIds,
      is_sandbox: isSandbox || undefined,
      markup_applied: markupInfo,
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[shipengine-get-rates] UNHANDLED ERROR:', error.message || error)
    console.error('[shipengine-get-rates] Stack:', error.stack || 'no stack')
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get shipping rates'
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
