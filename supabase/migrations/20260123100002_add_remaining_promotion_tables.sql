-- Add remaining promotion tables and fix column name mismatches
-- Created: 2026-01-23

-- ============================================
-- 1. PROMOTION-PRODUCT JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, product_id)
);

-- ============================================
-- 2. PROMOTION-CATEGORY JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, category_id)
);

-- ============================================
-- 3. PROMOTION-CUSTOMER JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  customer_email text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT promotion_customer_identifier CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

-- ============================================
-- 4. PROMOTION USAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_email text,
  discount_amount decimal(10,2) NOT NULL,
  used_at timestamptz DEFAULT now(),
  CONSTRAINT usage_customer_identifier CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

-- ============================================
-- 5. UPDATE ORDERS TABLE
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES promotions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_description text;

-- ============================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================

-- Junction table indexes
CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);
CREATE INDEX IF NOT EXISTS idx_promotion_categories_promotion ON promotion_categories(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_categories_category ON promotion_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_promotion_customers_promotion ON promotion_customers(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_customers_customer ON promotion_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_customers_email ON promotion_customers(customer_email) WHERE customer_email IS NOT NULL;

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer ON promotion_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_email ON promotion_usage(customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotion_usage_order ON promotion_usage(order_id);

-- Orders table promotion index
CREATE INDEX IF NOT EXISTS idx_orders_promotion ON orders(promotion_id) WHERE promotion_id IS NOT NULL;

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all promotion tables
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

-- Admins: Full access to promotion_products
DROP POLICY IF EXISTS "Admins full access to promotion_products" ON promotion_products;
CREATE POLICY "Admins full access to promotion_products" ON promotion_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read promotion_products
DROP POLICY IF EXISTS "Public read promotion_products" ON promotion_products;
CREATE POLICY "Public read promotion_products" ON promotion_products
  FOR SELECT USING (true);

-- Admins: Full access to promotion_categories
DROP POLICY IF EXISTS "Admins full access to promotion_categories" ON promotion_categories;
CREATE POLICY "Admins full access to promotion_categories" ON promotion_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read promotion_categories
DROP POLICY IF EXISTS "Public read promotion_categories" ON promotion_categories;
CREATE POLICY "Public read promotion_categories" ON promotion_categories
  FOR SELECT USING (true);

-- Admins: Full access to promotion_customers
DROP POLICY IF EXISTS "Admins full access to promotion_customers" ON promotion_customers;
CREATE POLICY "Admins full access to promotion_customers" ON promotion_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Customers: Read their own promotion assignments
DROP POLICY IF EXISTS "Customers read own promotion_customers" ON promotion_customers;
CREATE POLICY "Customers read own promotion_customers" ON promotion_customers
  FOR SELECT USING (customer_id = auth.uid());

-- Admins: Full access to promotion_usage
DROP POLICY IF EXISTS "Admins full access to promotion_usage" ON promotion_usage;
CREATE POLICY "Admins full access to promotion_usage" ON promotion_usage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Customers: Read their own usage
DROP POLICY IF EXISTS "Customers read own promotion_usage" ON promotion_usage;
CREATE POLICY "Customers read own promotion_usage" ON promotion_usage
  FOR SELECT USING (customer_id = auth.uid());

-- Service role / anon: Insert promotion_usage (for order creation)
DROP POLICY IF EXISTS "Insert promotion_usage on order" ON promotion_usage;
CREATE POLICY "Insert promotion_usage on order" ON promotion_usage
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON promotion_products TO authenticated, anon;
GRANT SELECT ON promotion_categories TO authenticated, anon;
GRANT SELECT ON promotion_customers TO authenticated;
GRANT SELECT, INSERT ON promotion_usage TO authenticated, anon;

GRANT ALL ON promotion_products TO service_role;
GRANT ALL ON promotion_categories TO service_role;
GRANT ALL ON promotion_customers TO service_role;
GRANT ALL ON promotion_usage TO service_role;
