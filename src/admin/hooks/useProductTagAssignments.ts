import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ProductTag } from './useProductTags';

export const useProductTagAssignments = (productId: string | undefined) => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchAssignedTags();
    } else {
      setTags([]);
      setLoading(false);
    }
  }, [productId]);

  const fetchAssignedTags = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('product_tag_assignments')
        .select(`
          tag_id,
          product_tags (
            id,
            name,
            slug,
            tag_type,
            created_at
          )
        `)
        .eq('product_id', productId);

      if (fetchError) throw fetchError;

      const assignedTags = (data || [])
        .map((pt: any) => pt.product_tags)
        .filter((tag: any) => tag !== null) as ProductTag[];

      setTags(assignedTags);
    } catch (err) {
      console.error('Error fetching assigned tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assigned tags');
    } finally {
      setLoading(false);
    }
  };

  const assignTag = async (tagId: string) => {
    if (!productId) {
      setError('Product ID is required');
      return { success: false, error: 'Product ID is required' };
    }

    try {
      const { error: insertError } = await supabase
        .from('product_tag_assignments')
        .insert({
          product_id: productId,
          tag_id: tagId,
        });

      if (insertError) throw insertError;

      await fetchAssignedTags();
      return { success: true };
    } catch (err) {
      console.error('Error assigning tag:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to assign tag';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const unassignTag = async (tagId: string) => {
    if (!productId) {
      setError('Product ID is required');
      return { success: false, error: 'Product ID is required' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('product_tag_assignments')
        .delete()
        .eq('product_id', productId)
        .eq('tag_id', tagId);

      if (deleteError) throw deleteError;

      await fetchAssignedTags();
      return { success: true };
    } catch (err) {
      console.error('Error unassigning tag:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to unassign tag';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  return { tags, loading, error, assignTag, unassignTag, refetch: fetchAssignedTags };
};
