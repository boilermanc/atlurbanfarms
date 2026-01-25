import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CustomerTag, CustomerTagAssignment } from '../types/customer';

export function useCustomerTagAssignments(customerId: string) {
  const [assignments, setAssignments] = useState<CustomerTagAssignment[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('customer_tag_assignments')
        .select(`
          *,
          tag:customer_tags(*)
        `)
        .eq('customer_id', customerId);

      if (fetchError) throw fetchError;

      setAssignments(data || []);
      setTags((data || []).map((a: any) => a.tag).filter(Boolean));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tag assignments');
      console.error('Error fetching tag assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const assignTag = useCallback(async (tagId: string, assignedBy?: string) => {
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('customer_tag_assignments')
        .insert({
          customer_id: customerId,
          tag_id: tagId,
          assigned_by: assignedBy || null,
        });

      if (insertError) throw insertError;
      await fetchAssignments();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to assign tag');
      return { success: false, error: err.message };
    }
  }, [customerId, fetchAssignments]);

  const unassignTag = useCallback(async (tagId: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId)
        .eq('tag_id', tagId);

      if (deleteError) throw deleteError;
      await fetchAssignments();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to remove tag');
      return { success: false, error: err.message };
    }
  }, [customerId, fetchAssignments]);

  return {
    assignments,
    tags,
    loading,
    error,
    refetch: fetchAssignments,
    assignTag,
    unassignTag,
  };
}
