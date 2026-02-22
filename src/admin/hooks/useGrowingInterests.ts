import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface GrowingInterestOption {
  id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GrowingInterestInsert = Pick<GrowingInterestOption, 'label' | 'value'> &
  Partial<Pick<GrowingInterestOption, 'sort_order' | 'is_active'>>;

export type GrowingInterestUpdate = Partial<
  Pick<GrowingInterestOption, 'label' | 'value' | 'sort_order' | 'is_active'>
>;

export const useGrowingInterests = () => {
  const [interests, setInterests] = useState<GrowingInterestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInterests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('growing_interest_options')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setInterests(data || []);
    } catch (err) {
      console.error('Error fetching growing interests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch growing interests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const createInterest = useCallback(async (input: GrowingInterestInsert) => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('growing_interest_options')
        .insert(input)
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchInterests();
      return { success: true as const, data };
    } catch (err: any) {
      const msg = err.message || 'Failed to create growing interest';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, [fetchInterests]);

  const updateInterest = useCallback(async (id: string, updates: GrowingInterestUpdate) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('growing_interest_options')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchInterests();
      return { success: true as const };
    } catch (err: any) {
      const msg = err.message || 'Failed to update growing interest';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, [fetchInterests]);

  const deleteInterest = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('growing_interest_options')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setInterests(prev => prev.filter(i => i.id !== id));
      return { success: true as const };
    } catch (err: any) {
      const msg = err.message || 'Failed to delete growing interest';
      setError(msg);
      return { success: false as const, error: msg };
    }
  }, []);

  return {
    interests,
    loading,
    error,
    refetch: fetchInterests,
    createInterest,
    updateInterest,
    deleteInterest,
  };
};
