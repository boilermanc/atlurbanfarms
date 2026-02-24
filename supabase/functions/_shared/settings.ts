import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'

export interface IntegrationSettings {
  stripe_enabled?: boolean
  stripe_mode?: 'test' | 'live'
  stripe_publishable_key?: string
  stripe_publishable_key_live?: string
  stripe_publishable_key_test?: string
  stripe_secret_key?: string
  stripe_secret_key_live?: string
  stripe_secret_key_test?: string
  stripe_webhook_secret?: string
  stripe_webhook_secret_live?: string
  stripe_webhook_secret_test?: string
  smtp_enabled?: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  smtp_from_email?: string
  smtp_from_name?: string
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

/** Keys needed to resolve active Stripe keys based on mode */
const STRIPE_MODE_KEYS = [
  'stripe_mode',
  'stripe_secret_key_live',
  'stripe_secret_key_test',
  'stripe_secret_key', // legacy fallback
  'stripe_publishable_key_live',
  'stripe_publishable_key_test',
  'stripe_publishable_key', // legacy fallback
  'stripe_webhook_secret_live',
  'stripe_webhook_secret_test',
  'stripe_webhook_secret', // legacy fallback
]

/** Stripe keys that trigger mode resolution when requested */
const STRIPE_RESOLVABLE_KEYS = [
  'stripe_secret_key',
  'stripe_publishable_key',
  'stripe_webhook_secret',
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
  // If any Stripe resolvable key is requested, also fetch mode-related keys
  const needsStripeResolve = keys.some(k => STRIPE_RESOLVABLE_KEYS.includes(k))

  let fetchKeys = keys
  if (needsShipEngineResolve) {
    fetchKeys = [...new Set([...fetchKeys, ...SHIPENGINE_MODE_KEYS])]
  }
  if (needsStripeResolve) {
    fetchKeys = [...new Set([...fetchKeys, ...STRIPE_MODE_KEYS])]
  }

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

  // Resolve the active Stripe keys based on mode
  if (needsStripeResolve) {
    const mode = settings.stripe_mode || 'test'

    // Resolve each Stripe key type
    const keyPairs = [
      { name: 'stripe_secret_key', live: settings.stripe_secret_key_live, test: settings.stripe_secret_key_test },
      { name: 'stripe_publishable_key', live: settings.stripe_publishable_key_live, test: settings.stripe_publishable_key_test },
      { name: 'stripe_webhook_secret', live: settings.stripe_webhook_secret_live, test: settings.stripe_webhook_secret_test },
    ]

    for (const pair of keyPairs) {
      const legacyKey = settings[pair.name]
      let resolvedKey: string | undefined

      if (mode === 'live' && pair.live) {
        resolvedKey = pair.live
      } else if (mode === 'test' && pair.test) {
        resolvedKey = pair.test
      }

      // Fallback: if mode-specific key is empty, try the other or legacy
      if (!resolvedKey) {
        resolvedKey = pair.live || pair.test || legacyKey
      }

      if (resolvedKey) {
        settings[pair.name] = resolvedKey
      }
    }

    // Always include the active mode so callers can check
    settings.stripe_mode = mode
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

/**
 * Fetch branding + business settings from config_settings and map them
 * to the variable names used by email templates.
 *
 * This is the single source of truth for brand colors in emails.
 */
export async function getBrandingSettings(
  supabaseClient: SupabaseClient
): Promise<Record<string, string>> {
  // Fetch branding settings
  const { data: brandingData, error: brandingError } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'branding')

  if (brandingError) {
    console.error('Failed to fetch branding settings:', brandingError)
  }

  // Fetch business settings for name/email/phone/address
  const { data: businessData, error: businessError } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'business')
    .in('key', ['company_name', 'support_email', 'support_phone', 'business_address'])

  if (businessError) {
    console.error('Failed to fetch business settings:', businessError)
  }

  const raw: Record<string, string> = {}
  for (const row of [...(brandingData || []), ...(businessData || [])]) {
    raw[row.key] = String(parseValue(row.value, row.data_type) ?? '')
  }

  // Map to email template variable names
  const companyName = raw.company_name || 'ATL Urban Farms'
  return {
    primary_color: raw.primary_brand_color || '#10b981',
    secondary_color: raw.secondary_brand_color || '#047857',
    logo_url: raw.logo_url || '',
    business_name: companyName,
    business_email: raw.support_email || 'hello@atlurbanfarms.com',
    business_phone: raw.support_phone || '',
    business_address: raw.business_address || 'Atlanta, GA',
    footer_text: `\u00a9 ${new Date().getFullYear()} ${companyName}. All rights reserved.`,
    facebook_url: raw.social_facebook || '',
    instagram_url: raw.social_instagram || '',
    current_year: new Date().getFullYear().toString(),
  }
}

function parseValue(value: any, dataType: string): any {
  // JSONB column: Supabase client may return native JS types (boolean, number)
  // or JSON-encoded strings depending on how the value was stored.
  if (value === null || value === undefined) return value

  switch (dataType) {
    case 'number':
      return typeof value === 'number' ? value : parseFloat(value)
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true'
    case 'json':
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    default:
      // Strip double-encoding: '"smtp.gmail.com"' → 'smtp.gmail.com'
      if (typeof value === 'string' && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
  }
}
