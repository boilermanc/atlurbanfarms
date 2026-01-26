-- Order Attribution Table
-- Stores "How did you hear about us?" responses linked to orders

CREATE TABLE IF NOT EXISTS order_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT,
  source TEXT NOT NULL,
  source_label TEXT, -- Human-readable label for the source
  other_text TEXT, -- Free text if they selected "Other"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for reporting and lookups
CREATE INDEX idx_order_attributions_source ON order_attributions(source);
CREATE INDEX idx_order_attributions_created ON order_attributions(created_at);
CREATE INDEX idx_order_attributions_order_id ON order_attributions(order_id);

-- Enable Row Level Security
ALTER TABLE order_attributions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert attribution (public checkout flow)
CREATE POLICY "Anyone can insert attribution"
  ON order_attributions FOR INSERT
  WITH CHECK (true);

-- Admins can view all attributions for reporting
CREATE POLICY "Admins can view attributions"
  ON order_attributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Service role can do anything (for backend operations)
CREATE POLICY "Service role full access"
  ON order_attributions FOR ALL
  USING (auth.role() = 'service_role');
