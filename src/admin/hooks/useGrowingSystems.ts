import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface GrowingSystem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GrowingSystemInsert = Pick<GrowingSystem, 'name' | 'slug'> &
  Partial<Pick<GrowingSystem, 'description' | 'logo_url' | 'website_url' | 'sort_order' | 'is_active'>>;

export type GrowingSystemUpdate = Partial<
  Pick<GrowingSystem, 'name' | 'slug' | 'description' | 'logo_url' | 'website_url' | 'sort_order' | 'is_active'>
>;

export const useGrowingSystems = () => {
  const [systems, setSystems] = useState<GrowingSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('growing_systems')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setSystems(data || []);
    } catch (err) {
      console.error('Error fetching growing systems:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch growing systems');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  const createSystem = useCallback(async (input: GrowingSystemInsert) => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('growing_systems')
        .insert(input)
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchSystems();
      return { success: true as const, data };
    } catch (err: any) {
      const msg = err.message || 'Failed to create growing system';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, [fetchSystems]);

  const updateSystem = useCallback(async (id: string, updates: GrowingSystemUpdate) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('growing_systems')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchSystems();
      return { success: true as const };
    } catch (err: any) {
      const msg = err.message || 'Failed to update growing system';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, [fetchSystems]);

  const deleteSystem = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('growing_systems')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSystems(prev => prev.filter(s => s.id !== id));
      return { success: true as const };
    } catch (err: any) {
      const msg = err.message || 'Failed to delete growing system';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, []);

  return {
    systems,
    loading,
    error,
    refetch: fetchSystems,
    createSystem,
    updateSystem,
    deleteSystem,
  };
};
