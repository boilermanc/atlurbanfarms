-- Create customer_favorites table for storing user's favorited products
CREATE TABLE IF NOT EXISTS customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a customer can only favorite a product once
  UNIQUE(customer_id, product_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer_id ON customer_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_product_id ON customer_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_created_at ON customer_favorites(created_at DESC);

-- Enable RLS
ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own favorites
CREATE POLICY "Users can view their own favorites"
  ON customer_favorites
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Policy: Users can insert their own favorites
CREATE POLICY "Users can add favorites"
  ON customer_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Policy: Users can delete their own favorites
CREATE POLICY "Users can remove favorites"
  ON customer_favorites
  FOR DELETE
  USING (auth.uid() = customer_id);

-- Policy: Admins can view all favorites (for analytics)
CREATE POLICY "Admins can view all favorites"
  ON customer_favorites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.role = 'admin'
    )
  );
