-- Multi-package shipments (MPS) insert one shipments row per package, all
-- sharing the same order_id. The named UNIQUE constraint
-- shipments_order_id_unique (added out-of-band, not via a tracked migration)
-- rejects the second row with SQLSTATE 23505, so Sheree's "Create Shipping
-- Label" click silently saves zero shipments and the UI shows no label.
--
-- The sibling migration 20260414100000_allow_multiple_shipments_per_order
-- dropped the unique INDEX idx_shipments_order_id but missed this separately
-- named CONSTRAINT.

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_order_id_unique;
