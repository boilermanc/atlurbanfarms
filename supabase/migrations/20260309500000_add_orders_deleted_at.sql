-- Migration: Add soft-delete support to orders table
-- Date: 2026-03-09
-- Adds deleted_at column for "Move to Trash" functionality
-- Orders with deleted_at set are hidden from the main list

ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for efficient filtering of non-deleted orders
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders (deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN orders.deleted_at IS 'Soft-delete timestamp. Non-null means the order is in Trash.';
