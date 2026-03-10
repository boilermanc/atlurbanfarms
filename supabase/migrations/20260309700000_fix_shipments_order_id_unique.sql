-- Add unique constraint on shipments.order_id so the upsert in
-- shipengine-create-label (onConflict: 'order_id') actually works.
-- Without this, PostgreSQL rejects the ON CONFLICT clause and the
-- shipment record is never written.

-- First, deduplicate any existing rows (keep the newest per order_id)
DELETE FROM shipments a
USING shipments b
WHERE a.order_id = b.order_id
  AND a.created_at < b.created_at;

-- Drop the old non-unique index and replace with a unique one
DROP INDEX IF EXISTS idx_shipments_order_id;
CREATE UNIQUE INDEX idx_shipments_order_id ON shipments(order_id);
