import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'

export interface IntegrationSettings {
  stripe_enabled?: boolean
  stripe_publishable_key?: string
  stripe_secret_key?: string
  stripe_webhook_secret?: string
  resend_enabled?: boolean
  resend_api_key?: string
  resend_from_email?: string
  resend_from_name?: string
  shipstation_enabled?: boolean
  shipengine_api_key?: string
  shipengine_mode?: 'sandbox' | 'production'
  shipengine_api_key_production?: string
  shipengine_api_key_sandbox?: string
  shipstation_store_id?: string
  trellis_enabled?: boolean
  trellis_api_endpoint?: string
  trellis_api_key?: string
  gemini_enabled?: boolean
  gemini_api_key?: string
}

/** Keys needed to resolve the active ShipEngine API key based on mode */
const SHIPENGINE_MODE_KEYS = [
  'shipengine_mode',
  'shipengine_api_key_production',
  'shipengine_api_key_sandbox',
  'shipengine_api_key', // legacy fallback
]

/**
 * Fetch a single integration setting from config_settings table
 */
export async function getIntegrationSetting(
  supabaseClient: SupabaseClient,
  key: string
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('value, data_type')
    .eq('category', 'integrations')
    .eq('key', key)
    .single()

  if (error || !data) {
    return null
  }

  return parseValue(data.value, data.data_type)
}

/**
 * Fetch multiple integration settings at once.
 *
 * ShipEngine mode resolution: when `shipengine_api_key` is requested, this
 * also fetches the mode toggle and both environment-specific keys, then
 * returns the correct key as `shipengine_api_key` transparently.
 */
export async function getIntegrationSettings(
  supabaseClient: SupabaseClient,
  keys: string[]
): Promise<Record<string, any>> {
  // If shipengine_api_key is requested, also fetch mode-related keys
  const needsShipEngineResolve = keys.includes('shipengine_api_key')
  const fetchKeys = needsShipEngineResolve
    ? [...new Set([...keys, ...SHIPENGINE_MODE_KEYS])]
    : keys

  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'integrations')
    .in('key', fetchKeys)

  if (error || !data) {
    return {}
  }

  const settings: Record<string, any> = {}
  for (const row of data) {
    settings[row.key] = parseValue(row.value, row.data_type)
  }

  // Resolve the active ShipEngine API key based on mode
  if (needsShipEngineResolve) {
    const mode = settings.shipengine_mode || 'sandbox'
    const productionKey = settings.shipengine_api_key_production
    const sandboxKey = settings.shipengine_api_key_sandbox
    const legacyKey = settings.shipengine_api_key

    let resolvedKey: string | undefined
    if (mode === 'production' && productionKey) {
      resolvedKey = productionKey
    } else if (mode === 'sandbox' && sandboxKey) {
      resolvedKey = sandboxKey
    }

    // Fallback: if the mode-specific key is empty, try the other or legacy
    if (!resolvedKey) {
      resolvedKey = productionKey || sandboxKey || legacyKey
    }

    if (resolvedKey) {
      settings.shipengine_api_key = resolvedKey
    }

    // Always include the active mode so callers can check
    settings.shipengine_mode = mode
  }

  return settings
}

/**
 * Fetch all integration settings
 */
export async function getAllIntegrationSettings(
  supabaseClient: SupabaseClient
): Promise<IntegrationSettings> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'integrations')

  if (error || !data) {
    return {}
  }

  const settings: IntegrationSettings = {}
  for (const row of data) {
    (settings as any)[row.key] = parseValue(row.value, row.data_type)
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
