-- Add product types support (Simple, Grouped, External/Affiliate, Smart Bundle)
-- Migration: 20260129200000_add_product_types.sql

-- Add product_type column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'simple'
CHECK (product_type IN ('simple', 'grouped', 'external', 'bundle'));

-- Add external product fields (for affiliate/external products)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS external_url TEXT;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS external_button_text VARCHAR(100) DEFAULT 'Buy Now';

-- Index for product type queries
CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products(product_type);

-- Comments
COMMENT ON COLUMN public.products.product_type IS 'Product type: simple (default), grouped (collection of products), external (affiliate link), bundle (products with quantities)';
COMMENT ON COLUMN public.products.external_url IS 'External URL for affiliate/external products';
COMMENT ON COLUMN public.products.external_button_text IS 'Button text for external products (default: Buy Now)';

-- Product Relationships table for Grouped and Bundle products
CREATE TABLE IF NOT EXISTS product_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('grouped', 'bundle')),
  quantity integer DEFAULT 1, -- Used for bundles to specify quantity of each item
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate relationships
  UNIQUE(parent_product_id, child_product_id, relationship_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_relationships_parent ON product_relationships(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_relationships_child ON product_relationships(child_product_id);
CREATE INDEX IF NOT EXISTS idx_product_relationships_type ON product_relationships(relationship_type);

-- Comments
COMMENT ON TABLE product_relationships IS 'Links parent products to child products for grouped and bundle types';
COMMENT ON COLUMN product_relationships.parent_product_id IS 'The parent/container product (grouped or bundle product)';
COMMENT ON COLUMN product_relationships.child_product_id IS 'The child/member product included in the parent';
COMMENT ON COLUMN product_relationships.relationship_type IS 'Type of relationship: grouped (collection) or bundle (with quantities)';
COMMENT ON COLUMN product_relationships.quantity IS 'Quantity of child product in bundle (only used for bundle type)';

-- Enable RLS
ALTER TABLE product_relationships ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see product relationships)
DROP POLICY IF EXISTS "Anyone can view product relationships" ON product_relationships;
CREATE POLICY "Anyone can view product relationships"
  ON product_relationships FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin full access
DROP POLICY IF EXISTS "Admins can manage product relationships" ON product_relationships;
CREATE POLICY "Admins can manage product relationships"
  ON product_relationships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Grant permissions
GRANT SELECT ON product_relationships TO anon, authenticated;
GRANT ALL ON product_relationships TO service_role;
