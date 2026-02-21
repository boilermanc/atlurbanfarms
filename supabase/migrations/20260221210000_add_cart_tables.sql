-- Migration: Add cart persistence tables for authenticated users
-- Created: 2026-02-21
-- Description: Creates carts and cart_items tables so authenticated users
--   have a server-side cart that persists across devices/browsers.

-- ============================================
-- 1. CARTS TABLE (one per authenticated user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CART_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, product_id)
);

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON public.carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);

-- ============================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================

-- Auto-update carts.updated_at on row change
CREATE OR REPLACE FUNCTION public.update_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'carts_updated_at') THEN
    CREATE TRIGGER carts_updated_at
        BEFORE UPDATE ON public.carts
        FOR EACH ROW
        EXECUTE FUNCTION public.update_carts_updated_at();
  END IF;
END $$;

-- Touch parent cart's updated_at when items change
CREATE OR REPLACE FUNCTION public.update_cart_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.carts SET updated_at = NOW()
    WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cart_items_touch_cart') THEN
    CREATE TRIGGER cart_items_touch_cart
        AFTER INSERT OR UPDATE OR DELETE ON public.cart_items
        FOR EACH ROW
        EXECUTE FUNCTION public.update_cart_on_item_change();
  END IF;
END $$;

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Carts: users can manage their own cart
DROP POLICY IF EXISTS "Users can view their own cart" ON public.carts;
CREATE POLICY "Users can view their own cart"
    ON public.carts FOR SELECT
    TO authenticated
    USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Users can create their own cart" ON public.carts;
CREATE POLICY "Users can create their own cart"
    ON public.carts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Users can update their own cart" ON public.carts;
CREATE POLICY "Users can update their own cart"
    ON public.carts FOR UPDATE
    TO authenticated
    USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Users can delete their own cart" ON public.carts;
CREATE POLICY "Users can delete their own cart"
    ON public.carts FOR DELETE
    TO authenticated
    USING (auth.uid() = customer_id);

-- Cart items: users can manage items in their own cart
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
CREATE POLICY "Users can view their own cart items"
    ON public.cart_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.carts
            WHERE carts.id = cart_items.cart_id
            AND carts.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can add items to their own cart" ON public.cart_items;
CREATE POLICY "Users can add items to their own cart"
    ON public.cart_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.carts
            WHERE carts.id = cart_items.cart_id
            AND carts.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update items in their own cart" ON public.cart_items;
CREATE POLICY "Users can update items in their own cart"
    ON public.cart_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.carts
            WHERE carts.id = cart_items.cart_id
            AND carts.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can remove items from their own cart" ON public.cart_items;
CREATE POLICY "Users can remove items from their own cart"
    ON public.cart_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.carts
            WHERE carts.id = cart_items.cart_id
            AND carts.customer_id = auth.uid()
        )
    );
