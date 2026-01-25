BEGIN;

-- Ensure payment + refund tracking columns exist on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS refunded_total numeric(10,2) NOT NULL DEFAULT 0;

-- Create dedicated refund log table
CREATE TABLE IF NOT EXISTS order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text,
  items jsonb,
  stripe_refund_id text,
  status text NOT NULL DEFAULT 'succeeded',
  created_by uuid REFERENCES customers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS order_refunds_order_id_idx ON order_refunds(order_id);
CREATE INDEX IF NOT EXISTS order_refunds_created_at_idx ON order_refunds(created_at DESC);

-- Guardrails so refunded totals never exceed the order amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND conname = 'orders_refunded_total_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_refunded_total_check
      CHECK (refunded_total >= 0 AND refunded_total <= COALESCE(total, 0));
  END IF;
END $$;

COMMIT;
