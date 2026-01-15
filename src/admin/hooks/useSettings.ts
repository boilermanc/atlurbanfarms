import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface ConfigSetting {
  id: string;
  category: string;
  key: string;
  value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
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
        grouped[setting.category][setting.key] = parseValue(setting.value, setting.data_type);
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
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No rows returned - setting doesn't exist yet
          setValue(null);
        } else {
          throw fetchError;
        }
      } else {
        setValue(parseValue(data.value, data.data_type));
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

      const { error: upsertError } = await supabase
        .from('config_settings')
        .upsert(records, { onConflict: 'category,key' });

      if (upsertError) throw upsertError;
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { bulkUpdate, loading, error };
}

// Helper functions
function parseValue(value: string, dataType: ConfigSetting['data_type']): any {
  switch (dataType) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value === 'true';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
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
