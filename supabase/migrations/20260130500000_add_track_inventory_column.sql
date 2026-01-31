-- Add track_inventory column to products table
-- This column controls whether inventory is automatically tracked or manually set via stock_status
-- Migration: 20260130500000_add_track_inventory_column.sql

-- Add track_inventory column (defaults to true for backward compatibility)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

-- Add low_stock_threshold column if it doesn't exist
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;

-- Comments
COMMENT ON COLUMN public.products.track_inventory IS 'When true, inventory is tracked via quantity_available. When false, use stock_status (in_stock/out_of_stock) instead.';
COMMENT ON COLUMN public.products.low_stock_threshold IS 'Quantity threshold for low stock alerts (used when track_inventory is true)';

-- Index for efficient stock queries
CREATE INDEX IF NOT EXISTS idx_products_track_inventory ON public.products(track_inventory);
