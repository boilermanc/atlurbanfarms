-- Inventory drift surfacing view
-- Run this manually in the Supabase SQL Editor (project ref: povudgtvzggnxwgtjexa).
-- Powers the "Inventory Health Check" widget on the admin dashboard.
--
-- Two drift modes:
--   tracking_disabled   - active product has track_inventory=false (Cilantro-class bug:
--                         silent oversell because inventory checks are bypassed entirely).
--   stale_stock_status  - active product is out of stock by quantity but stock_status
--                         still reads 'in_stock'. Cosmetic; the storefront uses
--                         quantity_available, not stock_status.

CREATE OR REPLACE VIEW v_inventory_drift AS
SELECT
  p.id,
  p.name,
  p.slug,
  pc.name AS category_name,
  p.track_inventory,
  p.quantity_available,
  p.stock_status,
  CASE
    WHEN p.track_inventory = false
      THEN 'tracking_disabled'
    WHEN p.track_inventory = true
      AND p.quantity_available = 0
      AND p.stock_status = 'in_stock'
      THEN 'stale_stock_status'
    ELSE NULL
  END AS drift_reason
FROM products p
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE p.is_active = true
  AND (
    p.track_inventory = false
    OR (p.track_inventory = true AND p.quantity_available = 0 AND p.stock_status = 'in_stock')
  );
