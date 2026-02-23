import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface ManageResult {
  success: boolean;
  error?: string;
  details?: {
    auth_user_handled: boolean;
    tables_affected?: string[];
    warnings?: string[];
    action: string;
  };
}

export function useCustomerManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invokeAction = useCallback(async (
    action: 'deactivate' | 'reactivate' | 'wipe',
    customerId: string
  ): Promise<ManageResult> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'admin-manage-customer',
        { body: { action, customer_id: customerId } }
      );

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || `${action} failed`);

      return data as ManageResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} customer`;
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivateCustomer = useCallback(
    (customerId: string) => invokeAction('deactivate', customerId),
    [invokeAction]
  );

  const reactivateCustomer = useCallback(
    (customerId: string) => invokeAction('reactivate', customerId),
    [invokeAction]
  );

  const wipeCustomerData = useCallback(
    (customerId: string) => invokeAction('wipe', customerId),
    [invokeAction]
  );

  return {
    deactivateCustomer,
    reactivateCustomer,
    wipeCustomerData,
    loading,
    error,
  };
}
