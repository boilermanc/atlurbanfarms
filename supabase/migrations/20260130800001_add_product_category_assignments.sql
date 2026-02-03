-- Migration: Add product_category_assignments junction table
-- Created: 2026-01-30
-- Description: Allows products to be assigned to multiple categories

-- Create junction table for many-to-many product-category relationships
CREATE TABLE IF NOT EXISTS product_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate assignments
  UNIQUE(product_id, category_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_category_assignments_product ON product_category_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_assignments_category ON product_category_assignments(category_id);

-- Comments
COMMENT ON TABLE product_category_assignments IS 'Many-to-many relationship between products and categories';
COMMENT ON COLUMN product_category_assignments.product_id IS 'The product being assigned to a category';
COMMENT ON COLUMN product_category_assignments.category_id IS 'The category the product is assigned to';
COMMENT ON COLUMN product_category_assignments.sort_order IS 'Display order within the category';

-- Enable RLS
ALTER TABLE product_category_assignments ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see category assignments)
DROP POLICY IF EXISTS "Anyone can view product category assignments" ON product_category_assignments;
CREATE POLICY "Anyone can view product category assignments"
  ON product_category_assignments FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin full access
DROP POLICY IF EXISTS "Admins can manage product category assignments" ON product_category_assignments;
CREATE POLICY "Admins can manage product category assignments"
  ON product_category_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Grant permissions
GRANT SELECT ON product_category_assignments TO anon, authenticated;
GRANT ALL ON product_category_assignments TO service_role;

-- Migrate existing category_id data to the new junction table
-- This preserves existing single-category assignments
INSERT INTO product_category_assignments (product_id, category_id, sort_order)
SELECT id, category_id, 0
FROM products
WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Note: We keep the category_id column on products for backwards compatibility
-- and as the "primary" category. The junction table allows additional categories.
COMMENT ON COLUMN public.products.category_id IS 'Primary category (for backwards compatibility). Use product_category_assignments for all category assignments.';
