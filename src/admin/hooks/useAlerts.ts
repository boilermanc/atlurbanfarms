import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface BackInStockAlert {
  id: string;
  product_id: string;
  email: string;
  customer_id: string | null;
  status: 'pending' | 'notified' | 'cancelled';
  created_at: string;
  notified_at: string | null;
  product_name: string;
  product_quantity: number;
  product_is_active: boolean;
  customer_first_name: string | null;
  customer_last_name: string | null;
}

export interface AlertsFilter {
  status?: 'pending' | 'notified' | 'cancelled' | 'all';
  productId?: string;
  search?: string;
}

export interface ProductWithAlerts {
  product_id: string;
  product_name: string;
  product_quantity: number;
  alert_count: number;
}

/**
 * Hook for fetching back-in-stock alerts
 */
export function useBackInStockAlerts(filters?: AlertsFilter) {
  const [alerts, setAlerts] = useState<BackInStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('back_in_stock_alerts_with_product')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let filteredData = data || [];

      // Client-side search filter for email
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(
          (alert) =>
            alert.email.toLowerCase().includes(searchLower) ||
            alert.product_name?.toLowerCase().includes(searchLower) ||
            alert.customer_first_name?.toLowerCase().includes(searchLower) ||
            alert.customer_last_name?.toLowerCase().includes(searchLower)
        );
      }

      setAlerts(filteredData);
    } catch (err: any) {
      console.error('Error fetching back-in-stock alerts:', err);
      setError(err.message || 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.productId, filters?.search]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Hook for fetching products with pending alerts (out of stock with subscribers)
 */
export function useProductsWithPendingAlerts() {
  const [products, setProducts] = useState<ProductWithAlerts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get all pending alerts grouped by product
      const { data, error: fetchError } = await supabase
        .from('back_in_stock_alerts_with_product')
        .select('product_id, product_name, product_quantity')
        .eq('status', 'pending');

      if (fetchError) throw fetchError;

      // Group by product and count
      const productMap = new Map<string, ProductWithAlerts>();

      (data || []).forEach((alert) => {
        const existing = productMap.get(alert.product_id);
        if (existing) {
          existing.alert_count += 1;
        } else {
          productMap.set(alert.product_id, {
            product_id: alert.product_id,
            product_name: alert.product_name,
            product_quantity: alert.product_quantity,
            alert_count: 1,
          });
        }
      });

      // Convert to array and sort by alert count
      const productsArray = Array.from(productMap.values()).sort(
        (a, b) => b.alert_count - a.alert_count
      );

      setProducts(productsArray);
    } catch (err: any) {
      console.error('Error fetching products with pending alerts:', err);
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

/**
 * Hook for notifying subscribers when product is back in stock
 */
export function useNotifyBackInStock() {
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notifySubscribers = useCallback(
    async (productId: string): Promise<{ success: boolean; count?: number; error?: string }> => {
      setNotifying(true);
      setError(null);

      try {
        // Call the RPC function to mark alerts as notified
        const { data, error: rpcError } = await supabase.rpc('notify_back_in_stock_alerts', {
          p_product_id: productId,
        });

        if (rpcError) throw rpcError;

        return { success: true, count: data };
      } catch (err: any) {
        console.error('Error notifying subscribers:', err);
        const errorMsg = err.message || 'Failed to notify subscribers';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setNotifying(false);
      }
    },
    []
  );

  return { notifySubscribers, notifying, error };
}

/**
 * Hook for cancelling a single alert
 */
export function useCancelAlert() {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelAlert = useCallback(
    async (alertId: string): Promise<{ success: boolean; error?: string }> => {
      setCancelling(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('back_in_stock_alerts')
          .update({ status: 'cancelled' })
          .eq('id', alertId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: any) {
        console.error('Error cancelling alert:', err);
        const errorMsg = err.message || 'Failed to cancel alert';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setCancelling(false);
      }
    },
    []
  );

  return { cancelAlert, cancelling, error };
}

/**
 * Hook for getting alert statistics
 */
export function useAlertStats() {
  const [stats, setStats] = useState({
    pending: 0,
    notified: 0,
    productsWithAlerts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get pending count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('back_in_stock_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Get notified count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: notifiedCount, error: notifiedError } = await supabase
        .from('back_in_stock_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'notified')
        .gte('notified_at', thirtyDaysAgo.toISOString());

      if (notifiedError) throw notifiedError;

      // Get unique products with pending alerts
      const { data: productsData, error: productsError } = await supabase
        .from('back_in_stock_alerts')
        .select('product_id')
        .eq('status', 'pending');

      if (productsError) throw productsError;

      const uniqueProducts = new Set(productsData?.map((p) => p.product_id));

      setStats({
        pending: pendingCount || 0,
        notified: notifiedCount || 0,
        productsWithAlerts: uniqueProducts.size,
      });
    } catch (err: any) {
      console.error('Error fetching alert stats:', err);
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
