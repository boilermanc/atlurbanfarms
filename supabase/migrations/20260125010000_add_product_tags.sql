-- Migration: Add product tag assignments
-- Created: 2026-01-25
-- Description: Adds junction table for linking products to tags (product_tags table already exists)

-- Note: The product_tags table already exists with the tag definitions:
-- - id, name, slug, tag_type, created_at

-- ============================================
-- 1. PRODUCT TAG ASSIGNMENTS (JUNCTION TABLE)
-- ============================================
CREATE TABLE IF NOT EXISTS public.product_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  -- Ensure each product-tag combo is unique
  CONSTRAINT unique_product_tag_assignment UNIQUE(product_id, tag_id)
);

-- Add comments for documentation
COMMENT ON TABLE public.product_tag_assignments IS 'Junction table linking products to product_tags';

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_product ON public.product_tag_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_tag ON public.product_tag_assignments(tag_id);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.product_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Public read access to product_tag_assignments
DROP POLICY IF EXISTS "Public read access to product_tag_assignments" ON public.product_tag_assignments;
CREATE POLICY "Public read access to product_tag_assignments" ON public.product_tag_assignments
  FOR SELECT
  TO public
  USING (true);

-- Admins have full access to product_tag_assignments
DROP POLICY IF EXISTS "Admins full access to product_tag_assignments" ON public.product_tag_assignments;
CREATE POLICY "Admins full access to product_tag_assignments" ON public.product_tag_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON public.product_tag_assignments TO anon;
GRANT SELECT ON public.product_tag_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tag_assignments TO authenticated;
GRANT ALL ON public.product_tag_assignments TO service_role;

-- ============================================
-- 5. SEED DEFAULT TAGS (if not already migrated from WooCommerce)
-- ============================================
-- Note: These tags may already exist from WooCommerce migration
INSERT INTO public.product_tags (name, slug, tag_type) VALUES
  ('Hydroponic Compatible', 'hydroponic-compatible', 'system'),
  ('NFT System', 'nft-system', 'system'),
  ('DWC Compatible', 'dwc-compatible', 'system'),
  ('Ebb & Flow', 'ebb-flow', 'system'),
  ('Aeroponic', 'aeroponic', 'system'),
  ('Beginner Friendly', 'beginner-friendly', 'difficulty'),
  ('Fast Growing', 'fast-growing', 'attribute'),
  ('Heat Tolerant', 'heat-tolerant', 'attribute'),
  ('Cold Hardy', 'cold-hardy', 'attribute'),
  ('Low Light', 'low-light', 'attribute'),
  ('High Yield', 'high-yield', 'attribute'),
  ('Compact', 'compact', 'attribute'),
  ('Vertical Growing', 'vertical-growing', 'system'),
  ('Microgreens', 'microgreens', 'type'),
  ('Year Round', 'year-round', 'attribute')
ON CONFLICT (slug) DO NOTHING;
