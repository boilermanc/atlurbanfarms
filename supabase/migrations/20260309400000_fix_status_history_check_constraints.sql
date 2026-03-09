-- Fix CHECK constraints on order_status_history to include shipped and picked_up statuses
-- These were added after the original constraints were created

BEGIN;

-- Update order_status_history.status constraint to include shipped and picked_up
DO $$
BEGIN
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_status_check;
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_to_status_check;
  ALTER TABLE order_status_history
    ADD CONSTRAINT order_status_history_status_check
    CHECK (status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed','shipped','picked_up'));
END $$;

-- Update order_status_history.from_status constraint to include shipped and picked_up
DO $$
BEGIN
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_from_status_check;
  ALTER TABLE order_status_history
    ADD CONSTRAINT order_status_history_from_status_check
    CHECK (from_status IS NULL OR from_status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed','shipped','picked_up'));
END $$;

-- Also update orders.status constraint to include shipped and picked_up
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed','shipped','picked_up'));
END $$;

COMMIT;
