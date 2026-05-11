-- Migration: Atomic sync_cart_items RPC
-- Created: 2026-05-11
-- Description: Replaces the racy delete-then-insert pattern in
--   src/hooks/useCartSync.ts (writeCartToDb) with a single atomic
--   function. Eliminates cart_items duplicate-key constraint violations
--   that surface under concurrent handleLogin / debounced sync (e.g.
--   when SIGNED_IN + INITIAL_SESSION both fire and the second writer
--   inserts before the first finishes).
--
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS and CREATE OR REPLACE.

-- ============================================
-- 1. updated_at COLUMN ON cart_items
-- ============================================
-- The RPC stamps updated_at on each upsert so we can tell when a given
-- line item last changed. The existing cart_items_touch_cart trigger
-- continues to update the parent carts.updated_at.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 2. sync_cart_items RPC
-- ============================================
-- Atomically reconciles cart_items for p_cart_id with p_items.
--
-- p_items shape: JSONB array of objects, e.g.
--   [{ "product_id": "uuid-string", "quantity": 2 }, ...]
--
-- Semantics:
--   * UPSERT each item in p_items (ON CONFLICT updates quantity + updated_at).
--   * DELETE any existing row for p_cart_id whose product_id is not in p_items.
--   * SECURITY INVOKER preserves the caller's auth context, so the existing
--     RLS policies on cart_items (which require the cart to belong to
--     auth.uid()) still apply. Anonymous callers cannot affect another
--     user's cart.
--
-- Atomicity: a single function body runs in one implicit transaction, so
-- the UPSERT and DELETE either both succeed or both roll back. No
-- partial state, no duplicate-key window.
CREATE OR REPLACE FUNCTION public.sync_cart_items(
  p_cart_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Upsert every item in p_items.
  INSERT INTO public.cart_items (cart_id, product_id, quantity)
  SELECT
    p_cart_id,
    (item->>'product_id')::UUID,
    (item->>'quantity')::INTEGER
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET
    quantity   = EXCLUDED.quantity,
    updated_at = NOW();

  -- Delete rows for this cart whose product_id is no longer in p_items.
  -- Using NOT EXISTS (rather than NOT IN) avoids the NULL-in-subquery
  -- footgun where NOT IN returns UNKNOWN if any row in the subquery is NULL.
  DELETE FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item
      WHERE (item->>'product_id')::UUID = ci.product_id
    );
END;
$$;

-- ============================================
-- 3. GRANTS
-- ============================================
-- Grant to both authenticated and anon. RLS on cart_items still gates
-- actual access; anon callers can invoke the function but the body's
-- INSERT/DELETE statements will be filtered by RLS policies and produce
-- no effect if the caller doesn't own the cart.
GRANT EXECUTE ON FUNCTION public.sync_cart_items(UUID, JSONB) TO authenticated, anon;
