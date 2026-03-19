-- Migration: Fix woo_import_log constraint to allow line_items import type
-- The import tool logs line_items imports but the constraint only allows 'customers', 'orders', 'full'

ALTER TABLE woo_import_log DROP CONSTRAINT IF EXISTS woo_import_log_import_type_check;

ALTER TABLE woo_import_log ADD CONSTRAINT woo_import_log_import_type_check
  CHECK (import_type IN ('customers', 'orders', 'line_items', 'full'));

-- Add line_items_imported column if not exists
ALTER TABLE woo_import_log ADD COLUMN IF NOT EXISTS line_items_imported INTEGER DEFAULT 0;
