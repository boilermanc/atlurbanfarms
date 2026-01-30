-- Migration: Add WooCommerce import tables
-- Created: 2026-01-30

-- ============================================
-- 1. ADD WOO_CUSTOMER_ID TO CUSTOMERS TABLE
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS woo_customer_id INTEGER;

-- Index for looking up customers by WooCommerce ID
CREATE INDEX IF NOT EXISTS idx_customers_woo_customer_id ON customers(woo_customer_id) WHERE woo_customer_id IS NOT NULL;

-- ============================================
-- 2. LEGACY ORDERS TABLE (WooCommerce Historical Orders)
-- ============================================
CREATE TABLE IF NOT EXISTS legacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WooCommerce References
  woo_order_id INTEGER NOT NULL UNIQUE,           -- WooCommerce order ID
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,  -- Linked Supabase customer
  woo_customer_id INTEGER,                        -- Original WooCommerce customer ID

  -- Order Details
  order_date TIMESTAMPTZ NOT NULL,                -- Original order date
  status TEXT,                                    -- Order status (completed, processing, etc.)

  -- Pricing
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  shipping DECIMAL(10,2),
  total DECIMAL(10,2),

  -- Payment
  payment_method TEXT,

  -- Billing Information
  billing_email TEXT,
  billing_first_name TEXT,
  billing_last_name TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,

  -- Shipping Information
  shipping_first_name TEXT,
  shipping_last_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. WOO IMPORT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS woo_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Import Details
  import_type TEXT NOT NULL CHECK (import_type IN ('customers', 'orders', 'full')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- Results
  customers_imported INTEGER DEFAULT 0,
  customers_updated INTEGER DEFAULT 0,
  orders_imported INTEGER DEFAULT 0,
  orders_skipped INTEGER DEFAULT 0,
  errors JSONB,

  -- Who ran it
  imported_by UUID REFERENCES customers(id) ON DELETE SET NULL,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

-- Legacy orders indexes
CREATE INDEX IF NOT EXISTS idx_legacy_orders_woo_order_id ON legacy_orders(woo_order_id);
CREATE INDEX IF NOT EXISTS idx_legacy_orders_customer_id ON legacy_orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_orders_woo_customer_id ON legacy_orders(woo_customer_id) WHERE woo_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_orders_order_date ON legacy_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_orders_status ON legacy_orders(status);

-- Woo import log indexes
CREATE INDEX IF NOT EXISTS idx_woo_import_log_status ON woo_import_log(status);
CREATE INDEX IF NOT EXISTS idx_woo_import_log_import_type ON woo_import_log(import_type);
CREATE INDEX IF NOT EXISTS idx_woo_import_log_created_at ON woo_import_log(created_at DESC);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE legacy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE woo_import_log ENABLE ROW LEVEL SECURITY;

-- Legacy Orders: Admin only access
CREATE POLICY "Admins can manage legacy orders" ON legacy_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Woo Import Log: Admin only access
CREATE POLICY "Admins can manage import log" ON woo_import_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

-- Grant read access to authenticated users (RLS will restrict to admins)
GRANT SELECT ON legacy_orders TO authenticated;
GRANT SELECT ON woo_import_log TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON legacy_orders TO service_role;
GRANT ALL ON woo_import_log TO service_role;

-- ============================================
-- 7. HELPER FUNCTION: Log import start
-- ============================================
CREATE OR REPLACE FUNCTION start_woo_import(
  p_import_type TEXT,
  p_imported_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO woo_import_log (import_type, imported_by, status)
  VALUES (p_import_type, p_imported_by, 'running')
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. HELPER FUNCTION: Complete import
-- ============================================
CREATE OR REPLACE FUNCTION complete_woo_import(
  p_log_id UUID,
  p_customers_imported INTEGER DEFAULT 0,
  p_customers_updated INTEGER DEFAULT 0,
  p_orders_imported INTEGER DEFAULT 0,
  p_orders_skipped INTEGER DEFAULT 0,
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
    errors = p_errors
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION start_woo_import TO authenticated;
GRANT EXECUTE ON FUNCTION complete_woo_import TO authenticated;
GRANT EXECUTE ON FUNCTION start_woo_import TO service_role;
GRANT EXECUTE ON FUNCTION complete_woo_import TO service_role;
