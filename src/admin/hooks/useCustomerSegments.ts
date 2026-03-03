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
      const [
        totalResult,
        allOrderedResult,
        orderedSince2024Result,
        subscribedResult,
        unsubscribedResult,
        activeNewsletterResult,
      ] = await Promise.all([
        // 1. Total customers
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true }),

        // 2. All customer IDs who ever ordered
        supabase
          .from('legacy_orders')
          .select('customer_id')
          .not('customer_id', 'is', null)
          .limit(50000),

        // 3. Customer IDs who ordered since 2024
        supabase
          .from('legacy_orders')
          .select('customer_id')
          .not('customer_id', 'is', null)
          .gte('order_date', '2024-01-01')
          .limit(50000),

        // 4. Customer IDs with newsletter_subscribed = true
        supabase
          .from('customers')
          .select('id')
          .eq('newsletter_subscribed', true)
          .limit(50000),

        // 5. Customer IDs with newsletter_subscribed = false
        supabase
          .from('customers')
          .select('id')
          .eq('newsletter_subscribed', false)
          .limit(50000),

        // 6. Active newsletter subscribers (may include anonymous with null customer_id)
        supabase
          .from('newsletter_subscribers')
          .select('customer_id')
          .eq('status', 'active')
          .limit(50000),
      ]);

      // Build sets for intersection/difference computation
      const allOrderedIds = new Set(
        (allOrderedResult.data || []).map((r) => r.customer_id as string)
      );
      const orderedSince2024Ids = new Set(
        (orderedSince2024Result.data || []).map((r) => r.customer_id as string)
      );
      const subscribedIds = new Set(
        (subscribedResult.data || []).map((r) => r.id as string)
      );
      const unsubscribedIds = new Set(
        (unsubscribedResult.data || []).map((r) => r.id as string)
      );

      // Ordered & Subscribed: customers who ordered AND have newsletter_subscribed = true
      let orderedAndSubscribed = 0;
      for (const id of allOrderedIds) {
        if (subscribedIds.has(id)) orderedAndSubscribed++;
      }

      // Newsletter Only: active subscribers whose customer_id is NULL (anonymous)
      // or whose customer_id is NOT in the ordered set
      let newsletterOnly = 0;
      for (const row of activeNewsletterResult.data || []) {
        if (row.customer_id === null || !allOrderedIds.has(row.customer_id as string)) {
          newsletterOnly++;
        }
      }

      // Ghost Accounts: unsubscribed customers with no orders
      let ghostAccounts = 0;
      for (const id of unsubscribedIds) {
        if (!allOrderedIds.has(id)) ghostAccounts++;
      }

      setSegments({
        totalInDatabase: totalResult.count || 0,
        everOrdered: allOrderedIds.size,
        orderedAndSubscribed,
        newsletterOnly,
        activeSince2024: orderedSince2024Ids.size,
        ghostAccounts,
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
