-- Migration: Add promotions and discounts tables
-- Created: 2026-01-23

-- ============================================
-- 1. MAIN PROMOTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name text NOT NULL,
  code text UNIQUE,                              -- NULL for automatic-only promotions
  description text,                              -- Customer-facing description
  internal_notes text,                           -- Admin-only notes

  -- Discount Type & Value
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_price', 'buy_x_get_y', 'free_shipping')),
  discount_value decimal(10,2),                  -- percentage (0-100) or dollar amount

  -- Buy X Get Y specific fields
  buy_quantity integer,                          -- Buy this many...
  get_quantity integer,                          -- ...get this many
  get_discount_percent decimal(5,2),             -- at this discount (100 = free)

  -- Scope
  scope text NOT NULL DEFAULT 'site_wide' CHECK (scope IN ('site_wide', 'category', 'product', 'customer')),

  -- Conditions
  minimum_order_amount decimal(10,2),            -- Minimum cart subtotal required
  minimum_quantity integer,                      -- Minimum items in cart
  maximum_discount_amount decimal(10,2),         -- Cap for percentage discounts

  -- Usage Limits
  usage_limit_total integer,                     -- Total uses allowed (NULL = unlimited)
  usage_limit_per_customer integer DEFAULT 1,    -- Per customer limit (NULL = unlimited)
  usage_count integer DEFAULT 0,                 -- Current usage count

  -- Stacking Rules
  stackable boolean DEFAULT false,               -- Can combine with other promotions?
  priority integer DEFAULT 0,                    -- Higher = applied first when multiple apply

  -- Activation Method
  activation_type text NOT NULL DEFAULT 'automatic' CHECK (activation_type IN ('automatic', 'code', 'both')),

  -- Schedule
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,                           -- NULL = no end date

  -- Display Settings
  banner_text text,                              -- Homepage banner text
  banner_bg_color text DEFAULT '#10b981',        -- Emerald-500
  banner_text_color text DEFAULT '#ffffff',
  badge_text text DEFAULT 'SALE',                -- Text shown on product badges
  show_on_homepage boolean DEFAULT false,        -- Show banner on homepage

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES customers(id)
);

-- ============================================
-- 2. PROMOTION-PRODUCT JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(promotion_id, product_id)
);

-- ============================================
-- 3. PROMOTION-CATEGORY JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(promotion_id, category_id)
);

-- ============================================
-- 4. PROMOTION-CUSTOMER JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  customer_email text,                           -- For guest/non-registered customers
  created_at timestamptz DEFAULT now(),

  CONSTRAINT promotion_customer_identifier CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

-- ============================================
-- 5. PROMOTION USAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_email text,                           -- For tracking guest usage
  discount_amount decimal(10,2) NOT NULL,        -- Actual discount applied
  used_at timestamptz DEFAULT now(),

  CONSTRAINT usage_customer_identifier CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

-- ============================================
-- 6. UPDATE ORDERS TABLE
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES promotions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_description text;

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

-- Promotions table indexes
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotions_scope ON promotions(scope);
CREATE INDEX IF NOT EXISTS idx_promotions_activation ON promotions(activation_type);
CREATE INDEX IF NOT EXISTS idx_promotions_homepage ON promotions(show_on_homepage) WHERE show_on_homepage = true;

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
-- 8. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all promotion tables
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

-- Admins: Full access to promotions
CREATE POLICY "Admins full access to promotions" ON promotions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read active promotions (for displaying sales on storefront)
CREATE POLICY "Public read active promotions" ON promotions
  FOR SELECT USING (
    is_active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

-- Admins: Full access to promotion_products
CREATE POLICY "Admins full access to promotion_products" ON promotion_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read promotion_products (for displaying which products are on sale)
CREATE POLICY "Public read promotion_products" ON promotion_products
  FOR SELECT USING (true);

-- Admins: Full access to promotion_categories
CREATE POLICY "Admins full access to promotion_categories" ON promotion_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read promotion_categories
CREATE POLICY "Public read promotion_categories" ON promotion_categories
  FOR SELECT USING (true);

-- Admins: Full access to promotion_customers
CREATE POLICY "Admins full access to promotion_customers" ON promotion_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Customers: Read their own promotion assignments
CREATE POLICY "Customers read own promotion_customers" ON promotion_customers
  FOR SELECT USING (
    customer_id = auth.uid()
  );

-- Admins: Full access to promotion_usage
CREATE POLICY "Admins full access to promotion_usage" ON promotion_usage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Customers: Read their own usage
CREATE POLICY "Customers read own promotion_usage" ON promotion_usage
  FOR SELECT USING (
    customer_id = auth.uid()
  );

-- Service role / anon: Insert promotion_usage (for order creation)
CREATE POLICY "Insert promotion_usage on order" ON promotion_usage
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 9. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promotions_updated_at ON promotions;
CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

-- Grant permissions to authenticated and anon roles
GRANT SELECT ON promotions TO authenticated, anon;
GRANT SELECT ON promotion_products TO authenticated, anon;
GRANT SELECT ON promotion_categories TO authenticated, anon;
GRANT SELECT ON promotion_customers TO authenticated;
GRANT SELECT, INSERT ON promotion_usage TO authenticated, anon;

-- Grant full permissions to service role (for admin operations via RLS)
GRANT ALL ON promotions TO service_role;
GRANT ALL ON promotion_products TO service_role;
GRANT ALL ON promotion_categories TO service_role;
GRANT ALL ON promotion_customers TO service_role;
GRANT ALL ON promotion_usage TO service_role;
