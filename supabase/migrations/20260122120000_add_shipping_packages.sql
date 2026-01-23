-- Migration: Add shipping_packages table for dynamic box configuration
-- Created: 2026-01-22

-- 1. Shipping packages table
CREATE TABLE IF NOT EXISTS shipping_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  length decimal(8,2) NOT NULL,  -- inches
  width decimal(8,2) NOT NULL,   -- inches
  height decimal(8,2) NOT NULL,  -- inches
  empty_weight decimal(8,2) NOT NULL DEFAULT 0, -- pounds (box + packing materials)
  min_quantity integer NOT NULL DEFAULT 1,
  max_quantity integer NOT NULL DEFAULT 999,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure min <= max
  CONSTRAINT valid_quantity_range CHECK (min_quantity <= max_quantity),
  -- Ensure positive dimensions
  CONSTRAINT positive_dimensions CHECK (length > 0 AND width > 0 AND height > 0)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_packages_active ON shipping_packages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shipping_packages_quantity ON shipping_packages(min_quantity, max_quantity);
CREATE INDEX IF NOT EXISTS idx_shipping_packages_sort ON shipping_packages(sort_order);

-- 3. RLS Policies
ALTER TABLE shipping_packages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to shipping_packages" ON shipping_packages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Public can read active packages (needed for checkout package calculation)
CREATE POLICY "Public read active packages" ON shipping_packages
  FOR SELECT USING (is_active = true);

-- 4. Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_shipping_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipping_packages_updated_at ON shipping_packages;
CREATE TRIGGER shipping_packages_updated_at
  BEFORE UPDATE ON shipping_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_packages_updated_at();

-- 5. Seed default packages
INSERT INTO shipping_packages (name, length, width, height, empty_weight, min_quantity, max_quantity, is_default, is_active, sort_order) VALUES
  ('Small Box', 8, 6, 4, 0.25, 1, 4, false, true, 1),
  ('Medium Box', 12, 10, 6, 0.5, 5, 12, true, true, 2),
  ('Large Box', 16, 12, 8, 0.75, 13, 24, false, true, 3)
ON CONFLICT DO NOTHING;
