-- Migration: Change Subscriber from role to checkbox
-- Created: 2026-01-26
-- Description: Removes 'subscriber' from role enum, uses newsletter_subscribed boolean instead

-- ============================================
-- 1. MIGRATE EXISTING SUBSCRIBERS
-- ============================================
-- Any customer with role='subscriber' becomes role='customer' with newsletter_subscribed=true
UPDATE public.customers
SET
  role = 'customer',
  newsletter_subscribed = true
WHERE role = 'subscriber';

-- ============================================
-- 2. UPDATE ROLE CHECK CONSTRAINT
-- ============================================
-- Drop the old check constraint and add a new one without 'subscriber'
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_role_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_role_check
  CHECK (role IN ('customer', 'admin'));

-- Update the column comment
COMMENT ON COLUMN public.customers.role IS 'Customer role: customer (default), admin (staff/admin user). Newsletter subscription is tracked via newsletter_subscribed column.';
