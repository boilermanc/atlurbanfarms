import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, CartItem } from '../../types';

const CART_STORAGE_KEY = 'atl-urban-farms-cart';

/** Map a raw DB product row (with joined category + images) to a CartItem. */
function mapDbProductToCartItem(dbProduct: any, quantity: number): CartItem {
  const rawPrice = Number(dbProduct.price) || 0;
  const rawCompareAt = dbProduct.compare_at_price != null ? Number(dbProduct.compare_at_price) : null;
  const isOnSale = rawCompareAt != null && rawCompareAt > 0 && rawPrice > 0 && rawCompareAt !== rawPrice;

  const primaryImage = dbProduct.images?.find((img: any) => img.is_primary) || dbProduct.images?.[0] || null;

  return {
    id: dbProduct.id,
    name: dbProduct.name,
    description: dbProduct.description || '',
    shortDescription: dbProduct.short_description || null,
    price: isOnSale ? Math.min(rawPrice, rawCompareAt!) : rawPrice,
    compareAtPrice: isOnSale ? Math.max(rawPrice, rawCompareAt!) : rawCompareAt,
    image: primaryImage?.url || 'https://placehold.co/400x400?text=No+Image',
    category: dbProduct.category?.name || 'Uncategorized',
    stock: dbProduct.quantity_available || 0,
    productType: dbProduct.product_type || null,
    externalUrl: dbProduct.external_url || null,
    externalButtonText: dbProduct.external_button_text || null,
    localPickup: dbProduct.local_pickup || 'can_be_picked_up',
    quantity,
  };
}

function getLocalCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLocalCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Merge two cart arrays. Union of products; higher quantity wins.
 * Always prefers DB cart prices (freshly calculated from products table)
 * over local cart prices (may be stale from localStorage).
 */
function mergeCarts(dbCart: CartItem[], localCart: CartItem[]): CartItem[] {
  const dbMap = new Map<string, CartItem>();
  for (const item of dbCart) {
    dbMap.set(item.id, item);
  }

  const merged = new Map<string, CartItem>();

  // Start with DB items (have fresh prices from products table)
  for (const item of dbCart) {
    merged.set(item.id, item);
  }

  for (const item of localCart) {
    const dbItem = dbMap.get(item.id);
    if (dbItem) {
      // Item exists in both: use DB prices (fresh) with max quantity
      const qty = Math.max(dbItem.quantity, item.quantity);
      merged.set(item.id, { ...dbItem, quantity: qty });
    } else {
      // Item only in local cart: keep it (new item not yet synced)
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

export function useCartSync() {
  const [cart, setCart] = useState<CartItem[]>(getLocalCart);
  const [loading, setLoading] = useState(false);

  const userIdRef = useRef<string | null>(null);
  const cartIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've completed the initial DB load so we don't sync
  // the stale localStorage cart back to DB before the real data arrives.
  const initialLoadDoneRef = useRef(false);
  // Track whether we've reconciled prices for the current session
  const priceReconciledRef = useRef(false);

  // ── DB helpers ──────────────────────────────────────────────

  async function getOrCreateCart(userId: string): Promise<string> {
    if (cartIdRef.current) return cartIdRef.current;

    const { data: existing } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', userId)
      .maybeSingle();

    if (existing) {
      cartIdRef.current = existing.id;
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from('carts')
      .upsert({ customer_id: userId }, { onConflict: 'customer_id' })
      .select('id')
      .single();

    if (error) throw error;
    cartIdRef.current = created!.id;
    return created!.id;
  }

  async function fetchCartFromDb(userId: string): Promise<CartItem[]> {
    const { data: cartRow } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', userId)
      .maybeSingle();

    if (!cartRow) return [];
    cartIdRef.current = cartRow.id;

    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        product_id,
        quantity,
        product:products(
          *,
          category:product_categories(*),
          images:product_images(*)
        )
      `)
      .eq('cart_id', cartRow.id);

    if (error) throw error;
    if (!items) return [];

    return items
      .filter((item: any) => item.product) // skip deleted products
      .map((item: any) => mapDbProductToCartItem(item.product, item.quantity));
  }

  async function writeCartToDb(cartId: string, items: CartItem[]) {
    // Replace all items atomically
    await supabase.from('cart_items').delete().eq('cart_id', cartId);

    if (items.length > 0) {
      const { error } = await supabase.from('cart_items').insert(
        items.map(item => ({
          cart_id: cartId,
          product_id: item.id,
          quantity: item.quantity,
        }))
      );
      if (error) throw error;
    }
  }

  // ── Reconcile localStorage prices against current DB prices ──
  // Fixes stale prices when a sale starts/ends after items were added to cart.

  async function reconcileCartPrices(localItems: CartItem[]): Promise<CartItem[]> {
    if (localItems.length === 0) return localItems;

    const productIds = localItems.map(item => item.id);
    const { data: products, error } = await supabase
      .from('products')
      .select('id, price, compare_at_price')
      .in('id', productIds);

    if (error || !products) return localItems;

    const priceMap = new Map<string, { price: number; compareAtPrice: number | null }>();
    for (const p of products) {
      const rawPrice = Number(p.price) || 0;
      const rawCompareAt = p.compare_at_price != null ? Number(p.compare_at_price) : null;
      const isOnSale = rawCompareAt != null && rawCompareAt > 0 && rawPrice > 0 && rawCompareAt !== rawPrice;
      priceMap.set(p.id, {
        price: isOnSale ? Math.min(rawPrice, rawCompareAt!) : rawPrice,
        compareAtPrice: isOnSale ? Math.max(rawPrice, rawCompareAt!) : rawCompareAt,
      });
    }

    let changed = false;
    const updated = localItems.map(item => {
      const fresh = priceMap.get(item.id);
      if (!fresh) return item; // product deleted, keep as-is
      if (item.price !== fresh.price || item.compareAtPrice !== fresh.compareAtPrice) {
        changed = true;
        return { ...item, price: fresh.price, compareAtPrice: fresh.compareAtPrice };
      }
      return item;
    });

    return changed ? updated : localItems;
  }

  // ── Sync effect: debounced write to DB on cart change ──────

  useEffect(() => {
    if (!userIdRef.current || !cartIdRef.current || isSyncingRef.current || !initialLoadDoneRef.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      const cId = cartIdRef.current;
      if (!cId) return;
      isSyncingRef.current = true;
      writeCartToDb(cId, cart)
        .catch(err => console.error('Failed to sync cart to DB:', err))
        .finally(() => { isSyncingRef.current = false; });
    }, 500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [cart]);

  // ── Persist to localStorage on every change ────────────────

  useEffect(() => {
    saveLocalCart(cart);
  }, [cart]);

  // ── Auth state listener ────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function handleLogin(userId: string) {
      setLoading(true);
      isSyncingRef.current = true;
      try {
        const localCart = getLocalCart();
        const dbCart = await fetchCartFromDb(userId);
        const merged = mergeCarts(dbCart, localCart);

        const cartId = await getOrCreateCart(userId);
        await writeCartToDb(cartId, merged);

        if (mounted) {
          setCart(merged);
          initialLoadDoneRef.current = true;
        }
      } catch (err) {
        console.error('Failed to sync cart on login:', err);
        // Keep local cart as fallback
        initialLoadDoneRef.current = true;
      } finally {
        isSyncingRef.current = false;
        if (mounted) setLoading(false);
      }
    }

    async function loadFromDb(userId: string) {
      setLoading(true);
      isSyncingRef.current = true;
      try {
        const localCart = getLocalCart();
        const dbCart = await fetchCartFromDb(userId);

        // Always ensure a DB cart row exists so cartIdRef is set
        // and the debounced sync effect can write future changes
        const cartId = await getOrCreateCart(userId);

        const merged = mergeCarts(dbCart, localCart);

        // Only write to DB if local has items not already in DB
        // (avoids unnecessary delete+reinsert on every page load)
        const needsSync = localCart.some(localItem => {
          const dbItem = dbCart.find(d => d.id === localItem.id);
          return !dbItem || localItem.quantity > dbItem.quantity;
        });
        if (needsSync) {
          await writeCartToDb(cartId, merged);
        }

        if (mounted) {
          setCart(merged);
          initialLoadDoneRef.current = true;
        }
      } catch (err) {
        console.error('Failed to load cart from DB:', err);
        initialLoadDoneRef.current = true;
      } finally {
        isSyncingRef.current = false;
        if (mounted) setLoading(false);
      }
    }

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      userIdRef.current = uid;
      if (uid) {
        loadFromDb(uid);
      } else {
        // Guest user: reconcile localStorage prices against current DB data.
        // This catches stale prices when a sale starts/ends after items were cached.
        if (!priceReconciledRef.current) {
          priceReconciledRef.current = true;
          const localItems = getLocalCart();
          if (localItems.length > 0) {
            const reconciled = await reconcileCartPrices(localItems);
            if (mounted && reconciled !== localItems) {
              setCart(reconciled);
            }
          }
        }
        initialLoadDoneRef.current = true;
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      const prevUid = userIdRef.current;
      userIdRef.current = uid;

      if (event === 'SIGNED_IN' && uid && uid !== prevUid) {
        handleLogin(uid);
      } else if (event === 'SIGNED_OUT') {
        cartIdRef.current = null;
        initialLoadDoneRef.current = true;
        setCart([]);
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // ── Cart operations ────────────────────────────────────────

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem('cart'); // legacy key

    // Also clear in DB
    const cId = cartIdRef.current;
    if (cId) {
      supabase.from('cart_items').delete().eq('cart_id', cId)
        .then(({ error }) => { if (error) console.error('Failed to clear DB cart:', error); });
    }
  }, []);

  return { cart, setCart, addToCart, updateQuantity, removeFromCart, clearCart, loading };
}
