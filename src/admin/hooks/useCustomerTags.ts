import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CustomerTag } from '../types/customer';

export function useCustomerTags() {
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('customer_tags')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer tags');
      console.error('Error fetching customer tags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(async (
    name: string,
    color: CustomerTag['color'],
    description?: string
  ) => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('customer_tags')
        .insert({ name, color, description: description || null })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchTags();
      return { success: true, data };
    } catch (err: any) {
      setError(err.message || 'Failed to create tag');
      return { success: false, error: err.message };
    }
  }, [fetchTags]);

  const updateTag = useCallback(async (
    id: string,
    updates: Partial<Pick<CustomerTag, 'name' | 'color' | 'description'>>
  ) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('customer_tags')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchTags();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update tag');
      return { success: false, error: err.message };
    }
  }, [fetchTags]);

  const deleteTag = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('customer_tags')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setTags(prev => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to delete tag');
      return { success: false, error: err.message };
    }
  }, []);

  return {
    tags,
    loading,
    error,
    refetch: fetchTags,
    createTag,
    updateTag,
    deleteTag,
  };
}
