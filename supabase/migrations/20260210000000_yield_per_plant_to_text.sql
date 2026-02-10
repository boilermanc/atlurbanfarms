-- Change yield_per_plant from DECIMAL(10,2) to TEXT
-- to support freeform values like "1-2 lbs" or "6-8 heads"
ALTER TABLE public.products
ALTER COLUMN yield_per_plant TYPE text USING yield_per_plant::text;
