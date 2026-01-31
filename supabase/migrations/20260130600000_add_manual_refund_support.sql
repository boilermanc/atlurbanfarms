-- Add support for manual refunds (cash, check, store credit, etc.)
-- These refunds are recorded without processing through Stripe

BEGIN;

-- Add refund_type to distinguish between Stripe and manual refunds
ALTER TABLE order_refunds
  ADD COLUMN IF NOT EXISTS refund_type text NOT NULL DEFAULT 'stripe';

-- Add refund_method for manual refunds (cash, check, store_credit, other)
ALTER TABLE order_refunds
  ADD COLUMN IF NOT EXISTS refund_method text;

-- Add check constraint for refund_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'order_refunds'::regclass
      AND conname = 'order_refunds_refund_type_check'
  ) THEN
    ALTER TABLE order_refunds
      ADD CONSTRAINT order_refunds_refund_type_check
      CHECK (refund_type IN ('stripe', 'manual'));
  END IF;
END $$;

-- Add check constraint for refund_method (only required for manual refunds)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'order_refunds'::regclass
      AND conname = 'order_refunds_refund_method_check'
  ) THEN
    ALTER TABLE order_refunds
      ADD CONSTRAINT order_refunds_refund_method_check
      CHECK (
        (refund_type = 'stripe' AND refund_method IS NULL) OR
        (refund_type = 'manual' AND refund_method IN ('cash', 'check', 'store_credit', 'other'))
      );
  END IF;
END $$;

-- Create index on refund_type for filtering
CREATE INDEX IF NOT EXISTS order_refunds_refund_type_idx ON order_refunds(refund_type);

-- Comment for documentation
COMMENT ON COLUMN order_refunds.refund_type IS 'Type of refund: stripe (processed via Stripe API) or manual (recorded without payment processing)';
COMMENT ON COLUMN order_refunds.refund_method IS 'Method used for manual refunds: cash, check, store_credit, or other';

COMMIT;
