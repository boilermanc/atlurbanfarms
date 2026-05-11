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
    seedlingsPerUnit: dbProduct.seedlings_per_unit || 1,
    quantity,
  };
}

/** Fetch bundle component names for any bundle items in the cart. */
async function enrichCartBundleItems(cartItems: CartItem[]): Promise<CartItem[]> {
  const bundleItems = cartItems.filter(item => item.productType === 'bundle' && !item.bundleItems);
  if (bundleItems.length === 0) return cartItems;

  const bundleIds = bundleItems.map(item => item.id);
  const { data: relationships } = await supabase
    .from('product_relationships')
    .select(`
      parent_product_id,
      quantity,
      product:products!child_product_id(name)
    `)
    .in('parent_product_id', bundleIds)
    .eq('relationship_type', 'bundle')
    .order('sort_order');

  if (!relationships || relationships.length === 0) return cartItems;

  const bundleMap = new Map<string, Array<{ name: string; quantity: number }>>();
  for (const rel of relationships as any[]) {
    const pid = rel.parent_product_id;
    if (!bundleMap.has(pid)) bundleMap.set(pid, []);
    bundleMap.get(pid)!.push({
      name: rel.product?.name || 'Unknown item',
      quantity: rel.quantity || 1,
    });
  }

  return cartItems.map(item => {
    const components = bundleMap.get(item.id);
    return components ? { ...item, bundleItems: components } : item;
  });
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
 * Cart-sync failure surface.
 *
 * Every catch site for a cart DB write funnels through here so we have a
 * single place to wire customer-facing feedback. Today we log to the
 * console and dispatch a `cart-sync-error` CustomEvent on window; the
 * matching `cart-sync-success` event is reserved for a future "Cart saved"
 * confirmation but isn't emitted yet. Detail shape for both:
 *   { message: string }
 *
 * The customer-facing toast UI is intentionally deferred to a follow-up
 * PR — no toast library is currently installed and a new one is out of
 * scope here. A future Toast component should listen for these events.
 *
 * TODO: integrate Sentry (`@sentry/react`) once it is wired up at the app
 * entry point. Until then we deliberately do NOT reference window.Sentry
 * — it doesn't exist in this codebase.
 */
function notifyCartSyncFailure(err: unknown) {
  console.error('Cart sync failed:', err);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cart-sync-error', {
        detail: {
          message:
            "We couldn't save your cart just now. Please try again or refresh the page.",
        },
      })
    );
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
  // Prevent concurrent handleLogin invocations from clobbering each other's
  // merge/setCart sequence (writeCartToDb is now atomic via the
  // sync_cart_items RPC; the surrounding flow is not — see doc block below)
  const handlingLoginRef = useRef(false);
  // Coordinate between initial getSession() and the INITIAL_SESSION event
  // so handleLogin runs exactly once per page load
  const bootstrapHandledRef = useRef(false);

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

    const mapped = items
      .filter((item: any) => item.product) // skip deleted products
      .map((item: any) => mapDbProductToCartItem(item.product, item.quantity));

    return enrichCartBundleItems(mapped);
  }

  async function writeCartToDb(cartId: string, items: CartItem[]) {
    // Atomic reconcile via Postgres RPC (sync_cart_items). The function
    // upserts every row and deletes anything not in p_items in a single
    // statement, which closes the duplicate-key race that delete-then-
    // insert used to expose under concurrent writers.
    const { error } = await supabase.rpc('sync_cart_items', {
      p_cart_id: cartId,
      p_items: items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    });
    if (error) throw error;
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
        .catch(notifyCartSyncFailure)
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

    /**
     * Auth event handling matrix:
     *
     *   SIGNED_IN       → New sign-in or re-sign-in. Run handleLogin when the
     *                     uid changes. Defends against Supabase emitting
     *                     SIGNED_IN multiple times in a row (commit cfd9275
     *                     patched AuthContext for the same root cause —
     *                     this hook needs the same dedup).
     *
     *   INITIAL_SESSION → Fires on subscribe in Supabase v2+. Run handleLogin
     *                     if a session is present and the bootstrap
     *                     getSession() call hasn't already handled it.
     *                     Without this, Safari under ITP can leave us
     *                     authenticated-but-unregistered here: userIdRef
     *                     stays null and every debounced DB sync silently
     *                     early-returns at the guard on line ~254.
     *
     *   TOKEN_REFRESHED → Recovery path. If we never observed SIGNED_IN /
     *                     INITIAL_SESSION (prevUid is null) but the SDK is
     *                     now refreshing a token, we missed the login.
     *                     Treat the first TOKEN_REFRESHED with a session as
     *                     the login event.
     *
     *   SIGNED_OUT      → Clear local cart and reset coordination refs so a
     *                     subsequent login fires fresh.
     *
     * handlingLoginRef gates concurrent handleLogin invocations so two
     * simultaneous logins don't clobber each other's merge results — the
     * underlying writeCartToDb call is itself atomic now (sync_cart_items
     * RPC, see migration 20260511100000), but the surrounding fetch →
     * merge → setCart flow is not.
     * bootstrapHandledRef coordinates between the initial getSession() and
     * the INITIAL_SESSION event so handleLogin runs exactly once on load.
     *
     * If you remove any branch here, re-read the Safari ITP audit before
     * shipping. This file's pattern is load-bearing for cart_items writes.
     */

    async function handleLogin(userId: string) {
      if (handlingLoginRef.current) return;
      handlingLoginRef.current = true;
      bootstrapHandledRef.current = true;
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
        notifyCartSyncFailure(err);
        // Keep local cart as fallback
        initialLoadDoneRef.current = true;
      } finally {
        isSyncingRef.current = false;
        handlingLoginRef.current = false;
        if (mounted) setLoading(false);
      }
    }

    // Bootstrap: if a session is present and no auth event has beaten us to
    // it, fire handleLogin; otherwise the onAuthStateChange listener below
    // will. bootstrapHandledRef is the coordination point.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      userIdRef.current = uid;
      if (uid) {
        if (!bootstrapHandledRef.current) {
          handleLogin(uid);
        }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      const prevUid = userIdRef.current;
      userIdRef.current = uid;

      if (event === 'SIGNED_OUT') {
        cartIdRef.current = null;
        bootstrapHandledRef.current = false;
        initialLoadDoneRef.current = true;
        setCart([]);
        localStorage.removeItem(CART_STORAGE_KEY);
        return;
      }

      if (!uid) return;

      if (event === 'SIGNED_IN' && uid !== prevUid) {
        handleLogin(uid);
      } else if (event === 'INITIAL_SESSION' && uid !== prevUid && !bootstrapHandledRef.current) {
        handleLogin(uid);
      } else if (event === 'TOKEN_REFRESHED' && prevUid === null) {
        // Safari recovery: we never registered this user. Treat the refresh
        // as the login so cart sync stops early-returning.
        handleLogin(uid);
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
        .then(({ error }) => { if (error) notifyCartSyncFailure(error); });
    }
  }, []);

  return { cart, setCart, addToCart, updateQuantity, removeFromCart, clearCart, loading };
}
