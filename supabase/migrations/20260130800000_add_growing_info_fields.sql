-- Migration: Add additional growing info fields to products
-- Created: 2026-01-30
-- Description: Adds yield_per_plant, harvest_type, growing_season, and growing_location fields

-- Add yield_per_plant column (numeric for decimal values)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS yield_per_plant DECIMAL(10, 2) DEFAULT NULL;

-- Add harvest_type column (text array for multi-select: cut_and_come_again, full_head)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS harvest_type TEXT[] DEFAULT NULL;

-- Add growing_season column (text array for multi-select: year_round, summer, spring, winter, fall)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS growing_season TEXT[] DEFAULT NULL;

-- Add growing_location column (single select: indoor, outdoor, both)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS growing_location VARCHAR(20) DEFAULT NULL
CHECK (growing_location IS NULL OR growing_location IN ('indoor', 'outdoor', 'both'));

-- Add comments for documentation
COMMENT ON COLUMN public.products.yield_per_plant IS 'Expected yield per plant (e.g., ounces, heads, bunches)';
COMMENT ON COLUMN public.products.harvest_type IS 'Recommended harvest types: cut_and_come_again, full_head (can select multiple)';
COMMENT ON COLUMN public.products.growing_season IS 'Growing seasons: year_round, summer, spring, winter, fall (can select multiple)';
COMMENT ON COLUMN public.products.growing_location IS 'Growing location: indoor, outdoor, or both';
