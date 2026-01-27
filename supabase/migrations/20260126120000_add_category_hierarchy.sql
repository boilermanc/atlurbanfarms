-- Migration: Add parent_id to product_categories for hierarchical structure
-- This allows categories to be organized as main categories with subcategories

-- Add parent_id column (nullable, self-referencing)
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;

-- Create index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);

-- Add comment for documentation
COMMENT ON COLUMN product_categories.parent_id IS 'References parent category for hierarchical structure. NULL means top-level category.';
