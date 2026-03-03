import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface CustomerSegments {
  totalInDatabase: number;
  everOrdered: number;
  orderedAndSubscribed: number;
  newsletterOnly: number;
  activeSince2024: number;
  ghostAccounts: number;
}

export function useCustomerSegments() {
  const [segments, setSegments] = useState<CustomerSegments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_customer_segments');

      if (rpcError) throw rpcError;

      setSegments({
        totalInDatabase: data.total ?? 0,
        everOrdered: data.ever_ordered ?? 0,
        orderedAndSubscribed: data.ordered_and_subscribed ?? 0,
        newsletterOnly: data.newsletter_only ?? 0,
        activeSince2024: data.active_since_2024 ?? 0,
        ghostAccounts: data.ghost_accounts ?? 0,
      });
    } catch (err: any) {
      console.error('Error fetching customer segments:', err);
      setError(err.message || 'Failed to load customer segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  return { segments, loading, error, refetch: fetchSegments };
}
