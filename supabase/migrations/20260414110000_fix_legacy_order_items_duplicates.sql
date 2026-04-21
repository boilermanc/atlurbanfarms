-- Migration: Fix duplicate legacy_order_items
-- Created: 2026-04-14
-- Description: Removes duplicate legacy order items caused by NULL woo_product_id
--   bypassing the UNIQUE constraint, and replaces the constraint with one that
--   treats NULLs as equal.

-- ============================================
-- 1. DELETE DUPLICATE ROWS (keep earliest by id)
-- ============================================
DELETE FROM legacy_order_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY legacy_order_id, COALESCE(woo_product_id, 0), product_name
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM legacy_order_items
  ) ranked
  WHERE rn > 1
);

-- ============================================
-- 2. REPLACE UNIQUE CONSTRAINT
-- ============================================
-- Drop the old constraint that allows NULL duplicates
ALTER TABLE legacy_order_items
  DROP CONSTRAINT IF EXISTS legacy_order_items_legacy_order_id_woo_product_id_product__key;

-- Create a unique index using COALESCE so NULL woo_product_id is treated as equal
CREATE UNIQUE INDEX IF NOT EXISTS unique_legacy_order_item
  ON legacy_order_items (legacy_order_id, COALESCE(woo_product_id, 0), product_name);
