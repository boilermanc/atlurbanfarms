-- Seedling credit audit log for tracking Sproutify credit activity
-- (checks, redemptions from checkout, and admin grants)

CREATE TABLE seedling_credit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('check', 'redeem', 'grant')),
  customer_email TEXT NOT NULL,
  credit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  credit_id TEXT,
  order_id UUID REFERENCES orders(id),
  order_number TEXT,
  performed_by UUID REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'not_found')),
  notes TEXT,
  sproutify_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_seedling_credit_log_email ON seedling_credit_log(customer_email);
CREATE INDEX idx_seedling_credit_log_action ON seedling_credit_log(action);
CREATE INDEX idx_seedling_credit_log_created ON seedling_credit_log(created_at DESC);

ALTER TABLE seedling_credit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to seedling_credit_log" ON seedling_credit_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Allow inserts from authenticated users (checkout redemption logging)
CREATE POLICY "Authenticated users can insert credit log" ON seedling_credit_log
  FOR INSERT TO authenticated
  WITH CHECK (action = 'redeem');
