import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CustomerRole } from '../types/customer';

export function useCustomerRole() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRole = useCallback(async (customerId: string, newRole: CustomerRole) => {
    setUpdating(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ role: newRole })
        .eq('id', customerId);

      if (updateError) throw updateError;
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update customer role');
      return { success: false, error: err.message };
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateRole, updating, error };
}
