import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ============================================
// TYPES
// ============================================

export interface WooImportLog {
  id: string;
  import_type: 'customers' | 'orders' | 'full';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  customers_imported: number;
  customers_updated: number;
  orders_imported: number;
  orders_skipped: number;
  errors: any[] | null;
  imported_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface WooImportStats {
  totalCustomersImported: number;
  totalOrdersImported: number;
  lastImportDate: string | null;
  lastImportType: string | null;
  lastImportStatus: string | null;
  runningImports: number;
}

export interface WooImportFilters {
  page?: number;
  perPage?: number;
  status?: 'all' | 'running' | 'completed' | 'failed';
  importType?: 'all' | 'customers' | 'orders' | 'full';
}

export interface LegacyOrder {
  id: string;
  woo_order_id: number;
  customer_id: string | null;
  woo_customer_id: number | null;
  order_date: string;
  status: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping: number | null;
  total: number | null;
  payment_method: string | null;
  billing_email: string | null;
  billing_first_name: string | null;
  billing_last_name: string | null;
  created_at: string;
}

// ============================================
// HOOK: Fetch import logs with filters
// ============================================
export function useWooImportLogs(filters: WooImportFilters = {}) {
  const [logs, setLogs] = useState<WooImportLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;
  const offset = (page - 1) * perPage;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('woo_import_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply import type filter
      if (filters.importType && filters.importType !== 'all') {
        query = query.eq('import_type', filters.importType);
      }

      // Apply pagination
      query = query.range(offset, offset + perPage - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching import logs:', err);
      setError(err.message || 'Failed to fetch import logs');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.importType, offset, perPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchLogs,
  };
}

// ============================================
// HOOK: Fetch import statistics
// ============================================
export function useWooImportStats() {
  const [stats, setStats] = useState<WooImportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get totals from all completed imports
      const { data: completedLogs, error: logsError } = await supabase
        .from('woo_import_log')
        .select('customers_imported, customers_updated, orders_imported, status, import_type, completed_at')
        .eq('status', 'completed');

      if (logsError) throw logsError;

      // Get count of running imports
      const { count: runningCount, error: runningError } = await supabase
        .from('woo_import_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running');

      if (runningError) throw runningError;

      // Get last import
      const { data: lastImport, error: lastError } = await supabase
        .from('woo_import_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastError && lastError.code !== 'PGRST116') throw lastError; // PGRST116 = no rows

      // Calculate totals
      const totalCustomersImported = completedLogs?.reduce(
        (sum, log) => sum + (log.customers_imported || 0) + (log.customers_updated || 0),
        0
      ) || 0;

      const totalOrdersImported = completedLogs?.reduce(
        (sum, log) => sum + (log.orders_imported || 0),
        0
      ) || 0;

      setStats({
        totalCustomersImported,
        totalOrdersImported,
        lastImportDate: lastImport?.completed_at || lastImport?.started_at || null,
        lastImportType: lastImport?.import_type || null,
        lastImportStatus: lastImport?.status || null,
        runningImports: runningCount || 0,
      });
    } catch (err: any) {
      console.error('Error fetching import stats:', err);
      setError(err.message || 'Failed to fetch import stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// ============================================
// HOOK: Fetch legacy orders
// ============================================
export function useLegacyOrders(filters: { page?: number; perPage?: number; search?: string } = {}) {
  const [orders, setOrders] = useState<LegacyOrder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;
  const offset = (page - 1) * perPage;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('legacy_orders')
        .select('*', { count: 'exact' })
        .order('order_date', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `billing_email.ilike.%${filters.search}%,billing_first_name.ilike.%${filters.search}%,billing_last_name.ilike.%${filters.search}%,woo_order_id::text.ilike.%${filters.search}%`
        );
      }

      // Apply pagination
      query = query.range(offset, offset + perPage - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching legacy orders:', err);
      setError(err.message || 'Failed to fetch legacy orders');
    } finally {
      setLoading(false);
    }
  }, [filters.search, offset, perPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchOrders,
  };
}

// ============================================
// HOOK: Get customer counts with WooCommerce IDs
// ============================================
export function useWooCustomerCount() {
  const [count, setCount] = useState<{ total: number; withWooId: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        // Total customers
        const { count: totalCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });

        // Customers with woo_customer_id
        const { count: wooCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .not('woo_customer_id', 'is', null);

        setCount({
          total: totalCount || 0,
          withWooId: wooCount || 0,
        });
      } catch (err) {
        console.error('Error fetching customer counts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, []);

  return { count, loading };
}
