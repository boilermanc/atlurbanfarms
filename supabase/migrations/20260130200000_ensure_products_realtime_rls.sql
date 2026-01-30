-- Migration: Ensure products table has proper RLS and REPLICA IDENTITY for Realtime
-- This ensures anonymous/authenticated users can receive realtime events for product changes

-- Enable RLS on products table (no-op if already enabled)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid duplicates
DROP POLICY IF EXISTS "Public read active products" ON products;

-- Create SELECT policy for anonymous and authenticated users
-- This is required for Supabase Realtime to broadcast changes to subscribers
CREATE POLICY "Public read active products" ON products
  FOR SELECT USING (is_active = true);

-- Ensure REPLICA IDENTITY is set to FULL for proper realtime change tracking
-- This allows Supabase to send the full row data in realtime events
ALTER TABLE products REPLICA IDENTITY FULL;

-- Also ensure product_categories and product_images have proper RLS for realtime
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for categories
DROP POLICY IF EXISTS "Public read active categories" ON product_categories;
CREATE POLICY "Public read active categories" ON product_categories
  FOR SELECT USING (is_active = true);

-- Drop and recreate policies for product images
DROP POLICY IF EXISTS "Public read product images" ON product_images;
CREATE POLICY "Public read product images" ON product_images
  FOR SELECT USING (true);

-- Set REPLICA IDENTITY for related tables
ALTER TABLE product_categories REPLICA IDENTITY FULL;
ALTER TABLE product_images REPLICA IDENTITY FULL;

-- Grant SELECT permissions (ensures anon/authenticated can query)
GRANT SELECT ON products TO anon, authenticated;
GRANT SELECT ON product_categories TO anon, authenticated;
GRANT SELECT ON product_images TO anon, authenticated;
