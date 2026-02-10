import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useDeleteCustomer() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkCanDelete = useCallback(async (customerId: string): Promise<{ canDelete: boolean; orderCount: number }> => {
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (countError) {
      return { canDelete: false, orderCount: 0 };
    }

    // Also check legacy (WooCommerce) orders
    let legacyCount = 0;
    try {
      const { count: lc } = await supabase
        .from('legacy_orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);
      legacyCount = lc ?? 0;
    } catch {
      // Table may not exist — treat as zero
    }

    const totalOrders = (count ?? 0) + legacyCount;
    return { canDelete: totalOrders === 0, orderCount: totalOrders };
  }, []);

  const deleteCustomer = useCallback(async (customerId: string): Promise<{ success: boolean; error?: string }> => {
    setDeleting(true);
    setError(null);

    try {
      // Final safety check — refuse to delete if orders exist
      const { canDelete, orderCount } = await checkCanDelete(customerId);
      if (!canDelete) {
        const msg = `Cannot delete customer with ${orderCount} existing order(s)`;
        setError(msg);
        return { success: false, error: msg };
      }

      // Delete related records first, then the customer.
      // Each delete silently succeeds if no rows match.
      const relatedTables = [
        'customer_addresses',
        'customer_preferences',
        'customer_profiles',
        'customer_tag_assignments',
        'customer_favorites',
        'customer_attribution',
      ];

      for (const table of relatedTables) {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('customer_id', customerId);

        if (deleteError) {
          // Some tables may not exist — log but don't fail
          console.warn(`Could not delete from ${table}:`, deleteError.message);
        }
      }

      // Delete the customer record itself
      const { error: customerDeleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (customerDeleteError) throw customerDeleteError;

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to delete customer';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setDeleting(false);
    }
  }, [checkCanDelete]);

  return { deleteCustomer, checkCanDelete, deleting, error };
}
