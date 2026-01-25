-- Migration: Add from_status to order_status_history
-- Created: 2026-01-25
-- Description: Adds from_status column to track status transitions (from X to Y)

BEGIN;

-- Add from_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'from_status'
  ) THEN
    ALTER TABLE order_status_history
      ADD COLUMN from_status TEXT;

    COMMENT ON COLUMN order_status_history.from_status IS 'Previous order status before this change';
  END IF;
END $$;

-- Clean up any existing invalid from_status values before adding constraint
UPDATE order_status_history
SET from_status = CASE
  WHEN from_status = 'pending' THEN 'pending_payment'
  WHEN from_status IN ('paid', 'allocated', 'picking', 'packed', 'shipped') THEN 'processing'
  WHEN from_status = 'delivered' THEN 'completed'
  WHEN from_status = 'partial_refund' THEN 'refunded'
  WHEN from_status NOT IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed') THEN NULL
  ELSE from_status
END
WHERE from_status IS NOT NULL;

-- Add constraint to from_status (same valid values as status)
DO $$
BEGIN
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_from_status_check;
  ALTER TABLE order_status_history
    ADD CONSTRAINT order_status_history_from_status_check
    CHECK (from_status IS NULL OR from_status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed'));
END $$;

COMMIT;
