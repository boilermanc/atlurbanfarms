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
  shipstation_api_key?: string
  shipstation_api_secret?: string
  shipstation_store_id?: string
  trellis_enabled?: boolean
  trellis_api_endpoint?: string
  trellis_api_key?: string
  gemini_enabled?: boolean
  gemini_api_key?: string
}

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
 * Fetch multiple integration settings at once
 */
export async function getIntegrationSettings(
  supabaseClient: SupabaseClient,
  keys: string[]
): Promise<Record<string, any>> {
  const { data, error } = await supabaseClient
    .from('config_settings')
    .select('key, value, data_type')
    .eq('category', 'integrations')
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
