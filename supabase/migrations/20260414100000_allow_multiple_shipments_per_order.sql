-- Allow multiple shipments per order (e.g. orders with 40+ seedlings need 2 boxes/labels).
-- The previous unique constraint on order_id prevented storing more than one shipment row,
-- causing the second label to overwrite the first via upsert.

-- Drop the unique index and replace with a regular (non-unique) index
DROP INDEX IF EXISTS idx_shipments_order_id;
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
