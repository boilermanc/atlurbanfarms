import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  ProductPromotion,
  CartDiscountResult,
  HomepageBanner,
  DiscountType,
  calculateSalePrice,
} from '../admin/types/promotions';

// Re-export helper function for convenience
export { calculateSalePrice } from '../admin/types/promotions';

// ============================================
// HOOK: Get promotion for a single product
// ============================================
export function useProductPromotion(productId: string | null) {
  const [promotion, setPromotion] = useState<ProductPromotion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setPromotion(null);
      setLoading(false);
      return;
    }

    const fetchPromotion = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_product_promotions', {
          p_product_id: productId,
        });

        if (error) throw error;

        // RPC returns array, get first (best) promotion
        setPromotion(data?.[0] || null);
      } catch (err) {
        console.error('Error fetching product promotion:', err);
        setPromotion(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotion();
  }, [productId]);

  return { promotion, loading };
}

// ============================================
// HOOK: Get promotions for multiple products (batch)
// ============================================
export function useProductsPromotions(productIds: string[]) {
  const [promotions, setPromotions] = useState<Map<string, ProductPromotion>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productIds.length === 0) {
      setPromotions(new Map());
      setLoading(false);
      return;
    }

    const fetchPromotions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_products_promotions', {
          p_product_ids: productIds,
        });

        if (error) throw error;

        // Build map of product_id -> promotion
        const promoMap = new Map<string, ProductPromotion>();
        (data || []).forEach((item: any) => {
          if (item.promotion_id) {
            promoMap.set(item.product_id, {
              promotion_id: item.promotion_id,
              name: item.name,
              discount_type: item.discount_type,
              discount_value: item.discount_value,
              badge_text: item.badge_text,
              priority: item.priority,
              ends_at: item.ends_at,
            });
          }
        });

        setPromotions(promoMap);
      } catch (err) {
        console.error('Error fetching product promotions:', err);
        setPromotions(new Map());
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [productIds.join(',')]); // Join to create stable dependency

  return { promotions, loading };
}

// ============================================
// HOOK: Calculate cart discount
// ============================================
export function useCartDiscount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CartDiscountResult | null>(null);

  const calculateDiscount = useCallback(
    async (
      cartItems: Array<{ product_id: string; quantity: number; price: number }>,
      couponCode?: string,
      customerId?: string,
      customerEmail?: string
    ): Promise<CartDiscountResult> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('calculate_cart_discount', {
          p_cart_items: cartItems,
          p_coupon_code: couponCode || null,
          p_customer_id: customerId || null,
          p_customer_email: customerEmail || null,
        });

        if (rpcError) throw rpcError;

        const result = data as CartDiscountResult;
        setLastResult(result);
        return result;
      } catch (err: any) {
        console.error('Error calculating discount:', err);
        setError(err.message);
        const errorResult: CartDiscountResult = {
          valid: false,
          discount: 0,
          message: 'Error calculating discount',
        };
        setLastResult(errorResult);
        return errorResult;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearDiscount = useCallback(() => {
    setLastResult(null);
    setError(null);
  }, []);

  return { calculateDiscount, clearDiscount, lastResult, loading, error };
}

// ============================================
// HOOK: Validate coupon code (quick check)
// ============================================
export function useValidateCoupon() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateCoupon = useCallback(
    async (
      couponCode: string
    ): Promise<{
      valid: boolean;
      promotion_id?: string;
      promotion_name?: string;
      discount_type?: string;
      discount_value?: number;
      minimum_order_amount?: number;
      description?: string;
      message?: string;
    }> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('validate_coupon_code', {
          p_coupon_code: couponCode,
        });

        if (rpcError) throw rpcError;

        return data;
      } catch (err: any) {
        console.error('Error validating coupon:', err);
        setError(err.message);
        return { valid: false, message: 'Error validating coupon' };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { validateCoupon, loading, error };
}

// ============================================
// HOOK: Get homepage banners
// ============================================
export function useHomepageBanners() {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const { data, error } = await supabase.rpc('get_active_banners');

        if (error) throw error;

        setBanners(data || []);
      } catch (err) {
        console.error('Error fetching banners:', err);
        setBanners([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  return { banners, loading };
}

// ============================================
// HOOK: Record promotion usage after order
// ============================================
export function useRecordPromotionUsage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordUsage = useCallback(
    async (
      promotionId: string,
      orderId: string,
      customerId: string | null,
      customerEmail: string,
      discountAmount: number
    ): Promise<{ success: boolean; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('record_promotion_usage', {
          p_promotion_id: promotionId,
          p_order_id: orderId,
          p_customer_id: customerId,
          p_customer_email: customerEmail,
          p_discount_amount: discountAmount,
        });

        if (rpcError) throw rpcError;

        if (data && !data.success) {
          throw new Error(data.error || 'Failed to record usage');
        }

        return { success: true };
      } catch (err: any) {
        console.error('Error recording promotion usage:', err);
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { recordUsage, loading, error };
}

// ============================================
// HOOK: Auto-apply best promotion to cart
// ============================================
export function useAutoApplyPromotion(
  cartItems: Array<{ id: string; quantity: number; price: number }>,
  customerId?: string,
  customerEmail?: string
) {
  const [discount, setDiscount] = useState<CartDiscountResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cartItems.length === 0) {
      setDiscount(null);
      return;
    }

    const checkAutoPromotion = async () => {
      setLoading(true);
      try {
        const formattedItems = cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        }));

        const { data, error } = await supabase.rpc('calculate_cart_discount', {
          p_cart_items: formattedItems,
          p_coupon_code: null, // No coupon - just auto promotions
          p_customer_id: customerId || null,
          p_customer_email: customerEmail || null,
        });

        if (error) throw error;

        // Only set if valid and has actual discount
        if (data?.valid && data?.discount > 0) {
          setDiscount(data);
        } else {
          setDiscount(null);
        }
      } catch (err) {
        console.error('Error checking auto promotion:', err);
        setDiscount(null);
      } finally {
        setLoading(false);
      }
    };

    // Debounce to avoid too many calls
    const timer = setTimeout(checkAutoPromotion, 300);
    return () => clearTimeout(timer);
  }, [cartItems, customerId, customerEmail]);

  return { discount, loading };
}

// ============================================
// UTILITY: Calculate savings for display
// ============================================
export function calculateSavings(
  originalPrice: number,
  salePrice: number
): { amount: number; percent: number } {
  const amount = originalPrice - salePrice;
  const percent = originalPrice > 0 ? Math.round((amount / originalPrice) * 100) : 0;
  return { amount, percent };
}

// ============================================
// UTILITY: Format discount description
// ============================================
export function formatDiscountDescription(
  discountType: DiscountType,
  discountValue: number
): string {
  switch (discountType) {
    case 'percentage':
      return `${discountValue}% off`;
    case 'fixed_amount':
      return `$${discountValue.toFixed(2)} off`;
    case 'fixed_price':
      return `Now $${discountValue.toFixed(2)}`;
    case 'free_shipping':
      return 'Free shipping';
    case 'buy_x_get_y':
      return 'Special offer';
    default:
      return 'Sale';
  }
}
