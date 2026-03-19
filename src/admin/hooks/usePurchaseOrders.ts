import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, POStatus } from '../types/purchaseOrders';

interface UsePurchaseOrdersFilters {
  search?: string;
  poStatus?: POStatus | 'all';
  page?: number;
  perPage?: number;
}

interface POStats {
  pending_verification: number;
  verified: number;
  invoiced: number;
  paid: number;
  cancelled: number;
  total_value: number;
}

export function usePurchaseOrders(filters: UsePurchaseOrdersFilters = {}) {
  const { search = '', poStatus = 'all', page = 1, perPage = 20 } = filters;
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('orders')
        .select('id, order_number, po_number, po_status, status, payment_status, payment_method, customer_id, guest_email, subtotal, tax, shipping_cost, total, discount_amount, created_at, po_verified_at, po_verified_by, po_invoiced_at, po_paid_at, customers!customer_id(first_name, last_name, email, company)', { count: 'exact' })
        .eq('payment_method', 'purchase_order')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (poStatus !== 'all') {
        query = query.eq('po_status', poStatus);
      }

      if (search.trim()) {
        query = query.or(
          `order_number.ilike.%${search.trim()}%,po_number.ilike.%${search.trim()}%`
        );
      }

      // Pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setOrders((data as unknown as PurchaseOrder[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  }, [search, poStatus, page, perPage]);

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

export function usePOStats() {
  const [stats, setStats] = useState<POStats>({
    pending_verification: 0,
    verified: 0,
    invoiced: 0,
    paid: 0,
    cancelled: 0,
    total_value: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('po_status, total')
        .eq('payment_method', 'purchase_order')
        .is('deleted_at', null);

      if (error) throw error;

      const counts: POStats = {
        pending_verification: 0,
        verified: 0,
        invoiced: 0,
        paid: 0,
        cancelled: 0,
        total_value: 0,
      };

      (data || []).forEach((row: any) => {
        if (row.po_status && row.po_status in counts) {
          (counts as any)[row.po_status]++;
        }
        counts.total_value += Number(row.total) || 0;
      });

      setStats(counts);
    } catch (err) {
      console.error('Error fetching PO stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

export function useUpdatePOStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async (orderId: string, newStatus: POStatus) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const updates: Record<string, any> = {
        po_status: newStatus,
      };

      // Set timestamps based on status transition
      switch (newStatus) {
        case 'verified':
          updates.po_verified_at = now;
          updates.po_verified_by = user?.id || null;
          break;
        case 'invoiced':
          updates.po_invoiced_at = now;
          break;
        case 'paid':
          updates.po_paid_at = now;
          updates.payment_status = 'paid';
          updates.status = 'processing';
          break;
        case 'cancelled':
          updates.status = 'cancelled';
          break;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (updateError) throw updateError;

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update PO status');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateStatus, loading, error };
}
