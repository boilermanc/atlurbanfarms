-- Migration: Ensure UNIQUE constraint on carts.customer_id
-- Date: 2026-02-22
-- Fixes: ON CONFLICT upsert failing with 42P10 because the original
--   CREATE TABLE IF NOT EXISTS may have been skipped if the table pre-existed.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'carts_customer_id_key'
      AND conrelid = 'public.carts'::regclass
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_customer_id_key UNIQUE (customer_id);
  END IF;
END $$;
