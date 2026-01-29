-- Add stock_status column for products that don't track inventory
-- When track_inventory is false, this field determines if the product is in stock or out of stock

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_status VARCHAR(20) DEFAULT 'in_stock'
CHECK (stock_status IN ('in_stock', 'out_of_stock'));

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN public.products.stock_status IS 'Manual stock status for products not tracking inventory. Used when track_inventory is false.';
