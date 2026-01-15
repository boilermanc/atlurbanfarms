import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface FeatureFlag {
  id: string;
  flag_key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: 'emergency' | 'commerce' | 'fulfillment' | 'notifications' | 'general' | 'experimental';
  is_emergency: boolean;
  updated_at: string;
  created_at: string;
}

export type FeatureFlagsByCategory = Record<string, FeatureFlag[]>;

/**
 * Fetch all feature flags grouped by category
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsByCategory, setFlagsByCategory] = useState<FeatureFlagsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('feature_flags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      const flagsData = (data || []) as FeatureFlag[];
      setFlags(flagsData);

      // Group flags by category
      const grouped: FeatureFlagsByCategory = {};
      flagsData.forEach((flag) => {
        const category = flag.is_emergency ? 'emergency' : flag.category;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(flag);
      });

      setFlagsByCategory(grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return { flags, flagsByCategory, loading, error, refetch: fetchFlags };
}

/**
 * Get emergency flags only
 */
export function useEmergencyFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('is_emergency', true)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setFlags((data || []) as FeatureFlag[]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch emergency flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return { flags, loading, error, refetch: fetchFlags };
}

/**
 * Toggle a feature flag
 */
export function useToggleFeatureFlag() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFlag = useCallback(async (
    flagId: string,
    enabled: boolean,
    reason?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Update the flag
      const { error: updateError } = await supabase
        .from('feature_flags')
        .update({
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flagId);

      if (updateError) throw updateError;

      // Log to audit trail if a reason is provided
      if (reason) {
        await supabase.from('audit_logs').insert({
          action: enabled ? 'feature_flag_enabled' : 'feature_flag_disabled',
          entity_type: 'feature_flag',
          entity_id: flagId,
          details: { reason },
          created_at: new Date().toISOString(),
        });
      }

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to toggle feature flag');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { toggleFlag, loading, error };
}

/**
 * Check if a specific feature is enabled
 */
export function useFeatureFlag(flagKey: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlag = useCallback(async () => {
    if (!flagKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('flag_key', flagKey)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Flag doesn't exist - default to false
          setEnabled(false);
        } else {
          throw fetchError;
        }
      } else {
        setEnabled(data.enabled);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch feature flag');
    } finally {
      setLoading(false);
    }
  }, [flagKey]);

  useEffect(() => {
    fetchFlag();
  }, [fetchFlag]);

  return { enabled, loading, error, refetch: fetchFlag };
}
