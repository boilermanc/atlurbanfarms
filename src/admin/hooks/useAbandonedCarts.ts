import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export type AbandonedCartStatus = 'pending' | 'reminded' | 'converted';

export interface AbandonedCartItem {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  image?: string;
}

export interface AbandonedCart {
  id: string;
  session_id: string;
  customer_id: string | null;
  email: string;
  first_name: string | null;
  cart_items: AbandonedCartItem[];
  cart_total: number;
  item_count: number;
  reminder_sent_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  status: AbandonedCartStatus;
}

export interface AbandonedCartsFilter {
  status?: AbandonedCartStatus | 'all';
  search?: string;
  daysBack?: number; // default 7
}

function deriveStatus(row: { reminder_sent_at: string | null; converted_at: string | null }): AbandonedCartStatus {
  if (row.converted_at) return 'converted';
  if (row.reminder_sent_at) return 'reminded';
  return 'pending';
}

export function useAbandonedCarts(filters: AbandonedCartsFilter) {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCarts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const daysBack = filters.daysBack ?? 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);

      let query = supabase
        .from('abandoned_carts')
        .select('*')
        .gt('created_at', cutoff.toISOString())
        .order('updated_at', { ascending: false });

      if (filters.status === 'pending') {
        query = query.is('converted_at', null).is('reminder_sent_at', null);
      } else if (filters.status === 'reminded') {
        query = query.is('converted_at', null).not('reminder_sent_at', 'is', null);
      } else if (filters.status === 'converted') {
        query = query.not('converted_at', 'is', null);
      }

      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        query = query.or(`email.ilike.%${term}%,first_name.ilike.%${term}%`);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const normalized: AbandonedCart[] = (data || []).map((row: any) => ({
        ...row,
        cart_items: Array.isArray(row.cart_items) ? row.cart_items : [],
        cart_total: Number(row.cart_total) || 0,
        item_count: Number(row.item_count) || 0,
        status: deriveStatus(row),
      }));

      setCarts(normalized);
    } catch (err: any) {
      console.error('Error fetching abandoned carts:', err);
      setError(err?.message || 'Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.search, filters.daysBack]);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  return { carts, loading, error, refetch: fetchCarts };
}

export interface AbandonedCartStats {
  pending: number;
  reminded: number;
  converted: number;
  pendingValue: number;
}

export function useAbandonedCartStats(daysBack: number = 7) {
  const [stats, setStats] = useState<AbandonedCartStats>({
    pending: 0,
    reminded: 0,
    converted: 0,
    pendingValue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      const cutoffIso = cutoff.toISOString();

      const { data } = await supabase
        .from('abandoned_carts')
        .select('cart_total, reminder_sent_at, converted_at')
        .gt('created_at', cutoffIso);

      const rows = data || [];
      const next: AbandonedCartStats = {
        pending: 0,
        reminded: 0,
        converted: 0,
        pendingValue: 0,
      };
      for (const row of rows as any[]) {
        const status = deriveStatus(row);
        if (status === 'pending') {
          next.pending += 1;
          next.pendingValue += Number(row.cart_total) || 0;
        } else if (status === 'reminded') {
          next.reminded += 1;
        } else if (status === 'converted') {
          next.converted += 1;
        }
      }
      setStats(next);
    } catch (err) {
      console.error('Error fetching abandoned cart stats:', err);
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
