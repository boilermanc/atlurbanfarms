import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Promotion,
  PromotionFormData,
  PromotionUsage,
  PromotionFilters,
  PromotionStatus,
  getPromotionStatus,
} from '../types/promotions';

// ============================================
// HOOK: Fetch promotions with filters
// ============================================
export function usePromotions(filters: PromotionFilters = {}) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;
  const offset = (page - 1) * perPage;

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('promotions')
        .select(
          `
          *,
          promotion_products(product_id, products(id, name)),
          promotion_categories(category_id, product_categories(id, name)),
          promotion_excluded_categories(category_id, product_categories(id, name)),
          promotion_customers(customer_id, customer_email, customers(id, first_name, last_name, email))
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      // Apply status filter (need to filter in-memory for complex status logic)
      if (filters.status && filters.status !== 'all') {
        const now = new Date().toISOString();
        switch (filters.status) {
          case 'active':
            query = query
              .eq('is_active', true)
              .lte('starts_at', now)
              .or(`ends_at.is.null,ends_at.gt.${now}`);
            break;
          case 'scheduled':
            query = query.eq('is_active', true).gt('starts_at', now);
            break;
          case 'expired':
            query = query.lt('ends_at', now);
            break;
          case 'inactive':
            query = query.eq('is_active', false);
            break;
        }
      }

      // Apply scope filter
      if (filters.scope && filters.scope !== 'all') {
        query = query.eq('scope', filters.scope);
      }

      // Apply discount type filter
      if (filters.discountType && filters.discountType !== 'all') {
        query = query.eq('discount_type', filters.discountType);
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }

      // Apply pagination
      query = query.range(offset, offset + perPage - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Transform data to include relations
      const formattedPromotions: Promotion[] = (data || []).map((p: any) => ({
        ...p,
        products: p.promotion_products?.map((pp: any) => pp.products).filter(Boolean) || [],
        categories:
          p.promotion_categories?.map((pc: any) => pc.product_categories).filter(Boolean) || [],
        excluded_categories:
          p.promotion_excluded_categories?.map((pec: any) => pec.product_categories).filter(Boolean) || [],
        customers:
          p.promotion_customers
            ?.map((pc: any) => ({
              id: pc.customer_id,
              email: pc.customer_email || pc.customers?.email,
              name: pc.customers
                ? `${pc.customers.first_name || ''} ${pc.customers.last_name || ''}`.trim()
                : null,
            }))
            .filter(Boolean) || [],
      }));

      setPromotions(formattedPromotions);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error fetching promotions:', err);
      setError(err.message || 'Failed to fetch promotions');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.scope, filters.discountType, filters.search, offset, perPage]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  return {
    promotions,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchPromotions,
  };
}

// ============================================
// HOOK: Fetch single promotion
// ============================================
export function usePromotion(promotionId: string | null) {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromotion = useCallback(async () => {
    if (!promotionId) {
      setPromotion(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('promotions')
        .select(
          `
          *,
          promotion_products(product_id, products(id, name)),
          promotion_categories(category_id, product_categories(id, name)),
          promotion_excluded_categories(category_id, product_categories(id, name)),
          promotion_customers(customer_id, customer_email, customers(id, first_name, last_name, email))
        `
        )
        .eq('id', promotionId)
        .single();

      if (queryError) throw queryError;

      const formattedPromotion: Promotion = {
        ...data,
        products: data.promotion_products?.map((pp: any) => pp.products).filter(Boolean) || [],
        categories:
          data.promotion_categories?.map((pc: any) => pc.product_categories).filter(Boolean) || [],
        excluded_categories:
          data.promotion_excluded_categories?.map((pec: any) => pec.product_categories).filter(Boolean) || [],
        customers:
          data.promotion_customers
            ?.map((pc: any) => ({
              id: pc.customer_id,
              email: pc.customer_email || pc.customers?.email,
              name: pc.customers
                ? `${pc.customers.first_name || ''} ${pc.customers.last_name || ''}`.trim()
                : null,
            }))
            .filter(Boolean) || [],
      };

      setPromotion(formattedPromotion);
    } catch (err: any) {
      console.error('Error fetching promotion:', err);
      setError(err.message || 'Failed to fetch promotion');
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

  useEffect(() => {
    fetchPromotion();
  }, [fetchPromotion]);

  return { promotion, loading, error, refetch: fetchPromotion };
}

// ============================================
// HOOK: Save promotion (create or update)
// ============================================
export function useSavePromotion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePromotion = useCallback(
    async (
      formData: PromotionFormData,
      promotionId?: string
    ): Promise<{ success: boolean; id?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        // Build promotion data object
        // Note: Column names must match database schema exactly
        const promotionData = {
          name: formData.name.trim(),
          coupon_code: formData.code?.trim().toUpperCase() || null,
          description: formData.description?.trim() || null,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value ? parseFloat(formData.discount_value) : 0,
          buy_quantity: formData.buy_quantity ? parseInt(formData.buy_quantity) : null,
          get_quantity: formData.get_quantity ? parseInt(formData.get_quantity) : null,
          scope: formData.scope,
          minimum_order_amount: formData.minimum_order_amount
            ? parseFloat(formData.minimum_order_amount)
            : null,
          minimum_quantity: formData.minimum_quantity ? parseInt(formData.minimum_quantity) : null,
          max_uses: formData.usage_limit_total
            ? parseInt(formData.usage_limit_total)
            : null,
          max_uses_per_customer: formData.usage_limit_per_customer
            ? parseInt(formData.usage_limit_per_customer)
            : null,
          stackable: formData.stackable,
          priority: formData.priority ? parseInt(formData.priority) : 0,
          activation_type: formData.activation_type === 'code' ? 'coupon' : formData.activation_type,
          starts_at: formData.starts_at,
          ends_at: formData.ends_at || null,
          banner_text: formData.banner_text?.trim() || null,
          banner_background_color: formData.banner_bg_color,
          banner_text_color: formData.banner_text_color,
          badge_text: formData.badge_text?.trim() || 'SALE',
          show_banner: formData.show_on_homepage,
          is_active: formData.is_active,
        };

        let savedPromotionId = promotionId;

        if (promotionId) {
          // Update existing promotion
          const { error: updateError } = await supabase
            .from('promotions')
            .update(promotionData)
            .eq('id', promotionId);

          if (updateError) throw updateError;
        } else {
          // Create new promotion
          const { data: newPromotion, error: insertError } = await supabase
            .from('promotions')
            .insert(promotionData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          savedPromotionId = newPromotion.id;
        }

        // Update junction tables
        if (savedPromotionId) {
          // Update promotion_products
          await supabase.from('promotion_products').delete().eq('promotion_id', savedPromotionId);
          if (formData.product_ids.length > 0) {
            const { error: productsError } = await supabase.from('promotion_products').insert(
              formData.product_ids.map((productId) => ({
                promotion_id: savedPromotionId,
                product_id: productId,
              }))
            );
            if (productsError) console.error('Error saving promotion products:', productsError);
          }

          // Update promotion_categories
          await supabase.from('promotion_categories').delete().eq('promotion_id', savedPromotionId);
          if (formData.category_ids.length > 0) {
            const { error: categoriesError } = await supabase.from('promotion_categories').insert(
              formData.category_ids.map((categoryId) => ({
                promotion_id: savedPromotionId,
                category_id: categoryId,
              }))
            );
            if (categoriesError)
              console.error('Error saving promotion categories:', categoriesError);
          }

          // Update promotion_excluded_categories
          await supabase.from('promotion_excluded_categories').delete().eq('promotion_id', savedPromotionId);
          if (formData.excluded_category_ids.length > 0) {
            const { error: excludedCategoriesError } = await supabase.from('promotion_excluded_categories').insert(
              formData.excluded_category_ids.map((categoryId) => ({
                promotion_id: savedPromotionId,
                category_id: categoryId,
              }))
            );
            if (excludedCategoriesError)
              console.error('Error saving excluded categories:', excludedCategoriesError);
          }

          // Update promotion_customers
          await supabase.from('promotion_customers').delete().eq('promotion_id', savedPromotionId);
          const customerInserts = [
            ...formData.customer_ids.map((customerId) => ({
              promotion_id: savedPromotionId,
              customer_id: customerId,
              customer_email: null,
            })),
            ...formData.customer_emails
              .filter((email) => email.trim())
              .map((email) => ({
                promotion_id: savedPromotionId,
                customer_id: null,
                customer_email: email.trim().toLowerCase(),
              })),
          ];
          if (customerInserts.length > 0) {
            const { error: customersError } = await supabase
              .from('promotion_customers')
              .insert(customerInserts);
            if (customersError)
              console.error('Error saving promotion customers:', customersError);
          }
        }

        return { success: true, id: savedPromotionId };
      } catch (err: any) {
        console.error('Error saving promotion:', err);
        const errorMessage = err.message || 'Failed to save promotion';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { savePromotion, loading, error };
}

// ============================================
// HOOK: Delete promotion
// ============================================
export function useDeletePromotion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletePromotion = useCallback(
    async (promotionId: string): Promise<{ success: boolean; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const { error: deleteError } = await supabase
          .from('promotions')
          .delete()
          .eq('id', promotionId);

        if (deleteError) throw deleteError;

        return { success: true };
      } catch (err: any) {
        console.error('Error deleting promotion:', err);
        const errorMessage = err.message || 'Failed to delete promotion';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { deletePromotion, loading, error };
}

// ============================================
// HOOK: Toggle promotion active status
// ============================================
export function useTogglePromotion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePromotion = useCallback(
    async (
      promotionId: string,
      isActive: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('promotions')
          .update({ is_active: isActive })
          .eq('id', promotionId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: any) {
        console.error('Error toggling promotion:', err);
        const errorMessage = err.message || 'Failed to update promotion';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { togglePromotion, loading, error };
}

// ============================================
// HOOK: Fetch promotion usage history
// ============================================
export function usePromotionUsage(promotionId: string | null) {
  const [usage, setUsage] = useState<PromotionUsage[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!promotionId) {
      setUsage([]);
      setTotalDiscount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('promotion_usage')
        .select(
          `
          *,
          orders(order_number),
          customers(first_name, last_name, email)
        `
        )
        .eq('promotion_id', promotionId)
        .order('used_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;

      const formattedUsage: PromotionUsage[] = (data || []).map((u: any) => ({
        ...u,
        order: u.orders,
        customer: u.customers,
      }));

      setUsage(formattedUsage);
      setTotalDiscount(
        formattedUsage.reduce((sum, u) => sum + (u.discount_amount || 0), 0)
      );
    } catch (err: any) {
      console.error('Error fetching promotion usage:', err);
      setError(err.message || 'Failed to fetch usage');
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { usage, totalDiscount, loading, error, refetch: fetchUsage };
}

// ============================================
// HOOK: Promotion analytics/stats
// ============================================
export function usePromotionStats(promotionId: string | null) {
  const [stats, setStats] = useState<{
    usageCount: number;
    totalDiscountGiven: number;
    uniqueCustomers: number;
    averageDiscount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!promotionId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('promotion_usage')
        .select('discount_amount, customer_id, customer_email')
        .eq('promotion_id', promotionId);

      if (queryError) throw queryError;

      const usageData = data || [];
      const totalDiscount = usageData.reduce((sum, u) => sum + (u.discount_amount || 0), 0);
      const uniqueCustomers = new Set(
        usageData.map((u) => u.customer_id || u.customer_email).filter(Boolean)
      ).size;

      setStats({
        usageCount: usageData.length,
        totalDiscountGiven: totalDiscount,
        uniqueCustomers,
        averageDiscount: usageData.length > 0 ? totalDiscount / usageData.length : 0,
      });
    } catch (err: any) {
      console.error('Error fetching promotion stats:', err);
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
