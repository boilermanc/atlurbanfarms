-- Migration: Add description column to product_tags
-- Created: 2026-01-30
-- Description: Adds optional description field for product tags

-- Add description column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_tags'
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.product_tags ADD COLUMN description text DEFAULT NULL;
    COMMENT ON COLUMN public.product_tags.description IS 'Optional description for the product tag';
  END IF;
END $$;
