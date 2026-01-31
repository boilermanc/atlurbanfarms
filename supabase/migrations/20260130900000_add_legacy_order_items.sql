-- Migration: Add legacy_order_items table and line_items tracking
-- Created: 2026-01-30
-- Description: Adds support for importing WooCommerce order line items

-- ============================================
-- 1. LEGACY ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS legacy_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Order Reference
  legacy_order_id UUID NOT NULL REFERENCES legacy_orders(id) ON DELETE CASCADE,
  woo_order_id INTEGER NOT NULL,

  -- Product Reference
  woo_product_id INTEGER,                           -- WooCommerce product ID
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,  -- Linked Supabase product

  -- Item Details
  product_name TEXT NOT NULL,                       -- Product name at time of purchase
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total DECIMAL(10,2),                         -- Total price for this line item

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate line items per order
  UNIQUE(legacy_order_id, woo_product_id, product_name)
);

-- ============================================
-- 2. ADD LINE ITEMS TRACKING TO IMPORT LOG
-- ============================================
-- Add line_items_imported column if it doesn't exist
ALTER TABLE woo_import_log
ADD COLUMN IF NOT EXISTS line_items_imported INTEGER DEFAULT 0;

-- Update the import_type check constraint to include 'line_items'
ALTER TABLE woo_import_log
DROP CONSTRAINT IF EXISTS woo_import_log_import_type_check;

ALTER TABLE woo_import_log
ADD CONSTRAINT woo_import_log_import_type_check
CHECK (import_type IN ('customers', 'orders', 'line_items', 'full'));

-- ============================================
-- 3. ADD WOO_ID TO PRODUCTS TABLE (if not exists)
-- ============================================
-- This allows linking WooCommerce products to Supabase products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS woo_id INTEGER;

-- Index for looking up products by WooCommerce ID
CREATE INDEX IF NOT EXISTS idx_products_woo_id ON products(woo_id) WHERE woo_id IS NOT NULL;

-- ============================================
-- 4. INDEXES FOR LEGACY ORDER ITEMS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_legacy_order_items_legacy_order_id ON legacy_order_items(legacy_order_id);
CREATE INDEX IF NOT EXISTS idx_legacy_order_items_woo_order_id ON legacy_order_items(woo_order_id);
CREATE INDEX IF NOT EXISTS idx_legacy_order_items_woo_product_id ON legacy_order_items(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_legacy_order_items_product_id ON legacy_order_items(product_id) WHERE product_id IS NOT NULL;

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE legacy_order_items ENABLE ROW LEVEL SECURITY;

-- Admin only access
CREATE POLICY "Admins can manage legacy order items" ON legacy_order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON legacy_order_items TO authenticated;
GRANT ALL ON legacy_order_items TO service_role;

-- ============================================
-- 7. UPDATE COMPLETE_WOO_IMPORT FUNCTION
-- ============================================
-- Drop the old function with its specific signature first
DROP FUNCTION IF EXISTS complete_woo_import(UUID, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, TEXT);

-- Create the updated function with line_items_imported parameter
CREATE OR REPLACE FUNCTION complete_woo_import(
  p_log_id UUID,
  p_customers_imported INTEGER DEFAULT 0,
  p_customers_updated INTEGER DEFAULT 0,
  p_orders_imported INTEGER DEFAULT 0,
  p_orders_skipped INTEGER DEFAULT 0,
  p_line_items_imported INTEGER DEFAULT 0,
  p_errors JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'completed'
)
RETURNS VOID AS $$
BEGIN
  UPDATE woo_import_log
  SET
    completed_at = NOW(),
    status = p_status,
    customers_imported = p_customers_imported,
    customers_updated = p_customers_updated,
    orders_imported = p_orders_imported,
    orders_skipped = p_orders_skipped,
    line_items_imported = p_line_items_imported,
    errors = p_errors
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on updated function (with specific signature)
GRANT EXECUTE ON FUNCTION complete_woo_import(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_woo_import(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, TEXT) TO service_role;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE legacy_order_items IS 'Line items from WooCommerce orders, linked to legacy_orders';
COMMENT ON COLUMN legacy_order_items.legacy_order_id IS 'Reference to the parent legacy order';
COMMENT ON COLUMN legacy_order_items.woo_order_id IS 'Original WooCommerce order ID (for direct queries)';
COMMENT ON COLUMN legacy_order_items.woo_product_id IS 'WooCommerce product ID';
COMMENT ON COLUMN legacy_order_items.product_id IS 'Linked Supabase product (via products.woo_id)';
COMMENT ON COLUMN legacy_order_items.product_name IS 'Product name at time of purchase';
COMMENT ON COLUMN legacy_order_items.quantity IS 'Quantity ordered';
COMMENT ON COLUMN legacy_order_items.line_total IS 'Total price for this line (qty * unit price)';
COMMENT ON COLUMN products.woo_id IS 'WooCommerce product ID for linking legacy order items';
