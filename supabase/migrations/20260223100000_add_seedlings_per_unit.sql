-- Add seedlings_per_unit to products for accurate shipping weight calculation.
-- Bundle products (e.g., "Basil 20-Pack") contain multiple physical seedlings
-- but were being treated as 1 item for shipping. This column stores the actual
-- seedling count so shipping rates reflect the real weight.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS seedlings_per_unit integer NOT NULL DEFAULT 1
CONSTRAINT positive_seedlings CHECK (seedlings_per_unit >= 1);

-- Auto-populate existing bundle products from product_relationships.
-- For each bundle parent, SUM the quantities of all child relationships.
UPDATE public.products p
SET seedlings_per_unit = sub.total_seedlings
FROM (
  SELECT parent_product_id, COALESCE(SUM(quantity), 1) AS total_seedlings
  FROM product_relationships
  WHERE relationship_type = 'bundle'
  GROUP BY parent_product_id
) sub
WHERE p.id = sub.parent_product_id
  AND p.product_type = 'bundle';
