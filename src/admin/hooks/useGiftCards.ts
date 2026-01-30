import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  GiftCard,
  GiftCardTransaction,
  GiftCardFormData,
  GiftCardAdjustmentFormData,
  GiftCardFilters,
  generateGiftCardCode,
} from '../types/giftCards';

// ============================================
// HOOK: Fetch gift cards with filters
// ============================================
export function useGiftCards(filters: GiftCardFilters = {}) {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;
  const offset = (page - 1) * perPage;

  const fetchGiftCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('gift_cards')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply search filter (code or email)
      if (filters.search) {
        query = query.or(
          `code.ilike.%${filters.search}%,recipient_email.ilike.%${filters.search}%,purchaser_email.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%`
        );
      }

      // Apply pagination
      query = query.range(offset, offset + perPage - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setGiftCards(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching gift cards:', err);
      setError(err.message || 'Failed to fetch gift cards');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.search, offset, perPage]);

  useEffect(() => {
    fetchGiftCards();
  }, [fetchGiftCards]);

  return {
    giftCards,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchGiftCards,
  };
}

// ============================================
// HOOK: Fetch single gift card with transactions
// ============================================
export function useGiftCard(giftCardId: string | null) {
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGiftCard = useCallback(async () => {
    if (!giftCardId) {
      setGiftCard(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch gift card
      const { data: giftCardData, error: giftCardError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('id', giftCardId)
        .single();

      if (giftCardError) throw giftCardError;

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('gift_card_transactions')
        .select(`
          *,
          orders(order_number),
          customers:created_by(first_name, last_name)
        `)
        .eq('gift_card_id', giftCardId)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Format transactions
      const formattedTransactions: GiftCardTransaction[] = (transactionsData || []).map((t: any) => ({
        ...t,
        order: t.orders,
        created_by_user: t.customers,
      }));

      setGiftCard(giftCardData);
      setTransactions(formattedTransactions);
    } catch (err: any) {
      console.error('Error fetching gift card:', err);
      setError(err.message || 'Failed to fetch gift card');
    } finally {
      setLoading(false);
    }
  }, [giftCardId]);

  useEffect(() => {
    fetchGiftCard();
  }, [fetchGiftCard]);

  return { giftCard, transactions, loading, error, refetch: fetchGiftCard };
}

// ============================================
// HOOK: Create new gift card (manual issuance)
// ============================================
export function useCreateGiftCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGiftCard = useCallback(
    async (formData: GiftCardFormData): Promise<{ success: boolean; id?: string; code?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const initialBalance = parseFloat(formData.initial_balance);
        if (isNaN(initialBalance) || initialBalance <= 0) {
          throw new Error('Initial balance must be a positive number');
        }

        // Generate unique code
        const code = generateGiftCardCode();

        // Get current user for created_by
        const { data: { user } } = await supabase.auth.getUser();

        // Create gift card
        const { data: newGiftCard, error: insertError } = await supabase
          .from('gift_cards')
          .insert({
            code,
            initial_balance: initialBalance,
            current_balance: initialBalance,
            status: 'active',
            recipient_email: formData.recipient_email?.trim() || null,
            recipient_name: formData.recipient_name?.trim() || null,
            message: formData.message?.trim() || null,
            expires_at: formData.expires_at || null,
            created_by: user?.id || null,
          })
          .select('id, code')
          .single();

        if (insertError) throw insertError;

        // Create initial transaction
        const { error: transactionError } = await supabase
          .from('gift_card_transactions')
          .insert({
            gift_card_id: newGiftCard.id,
            amount: initialBalance,
            balance_after: initialBalance,
            type: 'purchase',
            notes: 'Manual issuance by admin',
            created_by: user?.id || null,
          });

        if (transactionError) {
          console.error('Error creating initial transaction:', transactionError);
        }

        return { success: true, id: newGiftCard.id, code: newGiftCard.code };
      } catch (err: any) {
        console.error('Error creating gift card:', err);
        const errorMessage = err.message || 'Failed to create gift card';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createGiftCard, loading, error };
}

// ============================================
// HOOK: Adjust gift card balance
// ============================================
export function useAdjustGiftCardBalance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjustBalance = useCallback(
    async (
      giftCardId: string,
      formData: GiftCardAdjustmentFormData
    ): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Amount must be a positive number');
        }

        // Fetch current gift card
        const { data: currentCard, error: fetchError } = await supabase
          .from('gift_cards')
          .select('current_balance, status')
          .eq('id', giftCardId)
          .single();

        if (fetchError) throw fetchError;

        // Calculate new balance
        const adjustmentAmount = formData.type === 'add' ? amount : -amount;
        const newBalance = currentCard.current_balance + adjustmentAmount;

        if (newBalance < 0) {
          throw new Error('Cannot reduce balance below zero');
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Create transaction (trigger will update the balance)
        const { error: transactionError } = await supabase
          .from('gift_card_transactions')
          .insert({
            gift_card_id: giftCardId,
            amount: adjustmentAmount,
            balance_after: newBalance,
            type: 'adjustment',
            notes: formData.notes?.trim() || `Manual ${formData.type === 'add' ? 'credit' : 'debit'} by admin`,
            created_by: user?.id || null,
          });

        if (transactionError) throw transactionError;

        return { success: true, newBalance };
      } catch (err: any) {
        console.error('Error adjusting gift card balance:', err);
        const errorMessage = err.message || 'Failed to adjust balance';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { adjustBalance, loading, error };
}

// ============================================
// HOOK: Toggle gift card status (enable/disable)
// ============================================
export function useToggleGiftCardStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = useCallback(
    async (
      giftCardId: string,
      newStatus: 'active' | 'disabled'
    ): Promise<{ success: boolean; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        // Fetch current gift card to check balance
        const { data: currentCard, error: fetchError } = await supabase
          .from('gift_cards')
          .select('current_balance, status')
          .eq('id', giftCardId)
          .single();

        if (fetchError) throw fetchError;

        // Can't re-enable a depleted card
        if (newStatus === 'active' && currentCard.current_balance <= 0) {
          throw new Error('Cannot enable a gift card with zero balance');
        }

        // Update status
        const { error: updateError } = await supabase
          .from('gift_cards')
          .update({ status: newStatus })
          .eq('id', giftCardId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: any) {
        console.error('Error toggling gift card status:', err);
        const errorMessage = err.message || 'Failed to update status';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { toggleStatus, loading, error };
}

// ============================================
// HOOK: Gift card stats/summary
// ============================================
export function useGiftCardStats() {
  const [stats, setStats] = useState<{
    totalActive: number;
    totalActiveBalance: number;
    totalDepleted: number;
    totalDisabled: number;
    totalIssued: number;
    totalRedeemed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all gift cards
      const { data: giftCards, error: queryError } = await supabase
        .from('gift_cards')
        .select('status, current_balance, initial_balance');

      if (queryError) throw queryError;

      const cards = giftCards || [];

      const activeCards = cards.filter(c => c.status === 'active');
      const depletedCards = cards.filter(c => c.status === 'depleted');
      const disabledCards = cards.filter(c => c.status === 'disabled');

      const totalIssued = cards.reduce((sum, c) => sum + (c.initial_balance || 0), 0);
      const totalActiveBalance = activeCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);
      const totalRedeemed = totalIssued - cards.reduce((sum, c) => sum + (c.current_balance || 0), 0);

      setStats({
        totalActive: activeCards.length,
        totalActiveBalance,
        totalDepleted: depletedCards.length,
        totalDisabled: disabledCards.length,
        totalIssued,
        totalRedeemed,
      });
    } catch (err: any) {
      console.error('Error fetching gift card stats:', err);
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
