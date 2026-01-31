import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tag_type: string | null;
  created_at: string;
}

export const useProductTags = () => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('product_tags')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(async (
    name: string,
    slug: string,
    description?: string,
    tag_type?: string
  ) => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('product_tags')
        .insert({
          name,
          slug,
          description: description || null,
          tag_type: tag_type || null
        })
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
    updates: Partial<Pick<ProductTag, 'name' | 'slug' | 'description' | 'tag_type'>>
  ) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('product_tags')
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
        .from('product_tags')
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
    deleteTag
  };
};
