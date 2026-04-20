-- Multi-package shipments (MPS) share one ShipEngine label_id across multiple
-- physical boxes, each with its own tracking number. The previous UNIQUE
-- constraint on shipments.label_id forced us to collapse all packages into
-- one row, dropping the per-package tracking numbers (closes #75).
--
-- Drop the unique constraint and replace with a regular index so we can
-- insert one shipments row per package while still indexing label_id for
-- void lookups (which intentionally affect every row sharing the label_id).

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_label_id_key;
DROP INDEX IF EXISTS shipments_label_id_key;
CREATE INDEX IF NOT EXISTS idx_shipments_label_id ON shipments(label_id);
