import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface ConfigSetting {
  id: string;
  category: string;
  key: string;
  value: any; // jsonb column — can be string, boolean, number, object
  data_type: 'string' | 'number' | 'boolean' | 'json' | null;
  value_type: string | null; // fallback type hint column
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type SettingsMap = Record<string, Record<string, any>>;

/**
 * Fetch all settings grouped by category
 */
export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('config_settings')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (fetchError) throw fetchError;

      // Group settings by category
      const grouped: SettingsMap = {};
      (data || []).forEach((setting: ConfigSetting) => {
        if (!grouped[setting.category]) {
          grouped[setting.category] = {};
        }
        const effectiveType = setting.data_type || setting.value_type || 'string';
        grouped[setting.category][setting.key] = parseValue(setting.value, effectiveType as ConfigSetting['data_type']);
      });

      setSettings(grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refetch: fetchSettings };
}

/**
 * Fetch a single setting by category and key
 */
export function useSetting(category: string, key: string) {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSetting = useCallback(async () => {
    if (!category || !key) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('config_settings')
        .select('*')
        .eq('category', category)
        .eq('key', key)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setValue(parseValue(data.value, data.data_type));
      } else {
        setValue(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch setting');
    } finally {
      setLoading(false);
    }
  }, [category, key]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  return { value, loading, error, refetch: fetchSetting };
}

/**
 * Update a setting by category and key
 */
export function useUpdateSetting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSetting = useCallback(async (
    category: string,
    key: string,
    value: any,
    dataType: ConfigSetting['data_type'] = 'string',
    description?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const stringValue = stringifyValue(value, dataType);

      // Upsert the setting
      const { error: upsertError } = await supabase
        .from('config_settings')
        .upsert(
          {
            category,
            key,
            value: stringValue,
            data_type: dataType,
            description: description || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'category,key',
          }
        );

      if (upsertError) throw upsertError;
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateSetting, loading, error };
}

/**
 * Bulk update multiple settings at once
 */
export function useBulkUpdateSettings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkUpdate = useCallback(async (
    category: string,
    settings: Record<string, { value: any; dataType: ConfigSetting['data_type']; description?: string }>
  ) => {
    console.log('🟢 useBulkUpdateSettings called with category:', category);
    setLoading(true);
    setError(null);
    try {
      const records = Object.entries(settings).map(([key, config]) => ({
        category,
        key,
        value: stringifyValue(config.value, config.dataType),
        data_type: config.dataType,
        description: config.description || null,
        updated_at: new Date().toISOString(),
      }));

      console.log('🟢 Records to upsert:', records);
      console.log('🟢 Calling supabase.from("config_settings").upsert()...');

      const { data, error: upsertError } = await supabase
        .from('config_settings')
        .upsert(records, { onConflict: 'category,key' })
        .select();

      console.log('🟢 Supabase response - data:', data);
      console.log('🟢 Supabase response - error:', upsertError);

      if (upsertError) throw upsertError;
      return true;
    } catch (err: any) {
      console.error('🔴 useBulkUpdateSettings error:', err);
      setError(err.message || 'Failed to update settings');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { bulkUpdate, loading, error };
}

// Helper functions

/**
 * Parse a value from the config_settings jsonb column.
 *
 * The `value` column is jsonb, so the Supabase client auto-parses it:
 *   jsonb true        → JS boolean true
 *   jsonb "true"      → JS string "true"
 *   jsonb "\"sk_...\"" → JS string '"sk_..."' (double-encoded)
 *   jsonb 42          → JS number 42
 *
 * This function normalises all variants into the expected JS type.
 */
function parseValue(value: any, dataType: ConfigSetting['data_type']): any {
  if (value === null || value === undefined) return value;

  // If value is already the target JS type, return directly
  if (dataType === 'boolean' && typeof value === 'boolean') return value;
  if (dataType === 'number' && typeof value === 'number') return value;
  if (dataType === 'json' && typeof value === 'object') return value;

  // Convert to string for further processing
  let strValue = String(value);

  // Strip double-encoding: "\"actual value\"" → "actual value"
  if (strValue.length >= 2 && strValue.startsWith('"') && strValue.endsWith('"')) {
    try {
      const unwrapped = JSON.parse(strValue);
      if (typeof unwrapped === 'string') {
        strValue = unwrapped;
      }
    } catch {
      // Not valid JSON — keep as-is
    }
  }

  switch (dataType) {
    case 'number':
      return parseFloat(strValue) || 0;
    case 'boolean':
      return strValue === 'true' || strValue === '1';
    case 'json':
      try {
        return JSON.parse(strValue);
      } catch {
        return strValue;
      }
    default:
      return strValue;
  }
}

function stringifyValue(value: any, dataType: ConfigSetting['data_type']): string {
  switch (dataType) {
    case 'json':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    default:
      return String(value);
  }
}
