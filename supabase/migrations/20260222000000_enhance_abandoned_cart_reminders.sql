-- Enhance abandoned cart reminder system
-- Adds tracking column to carts table for persistent authenticated user carts
-- and config settings to control reminder thresholds.

-- ============================================
-- 1. Add reminder tracking column to carts table
-- ============================================

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS abandoned_reminder_sent_at TIMESTAMPTZ;

-- Partial index for the cron query: only carts not yet reminded
CREATE INDEX IF NOT EXISTS idx_carts_abandoned_reminder_pending
  ON public.carts(updated_at)
  WHERE abandoned_reminder_sent_at IS NULL;

-- ============================================
-- 2. Config settings for abandoned cart reminders
-- ============================================

INSERT INTO config_settings (category, key, value, data_type, description)
VALUES
  ('marketing', 'abandoned_cart_enabled', 'true', 'boolean',
   'Enable abandoned cart reminder emails'),
  ('marketing', 'abandoned_cart_checkout_hours', '2', 'number',
   'Hours after last activity before sending reminder for checkout-initiated abandoned carts'),
  ('marketing', 'abandoned_cart_persistent_hours', '24', 'number',
   'Hours after last activity before sending reminder for authenticated user persistent carts'),
  ('marketing', 'abandoned_cart_max_age_days', '7', 'number',
   'Maximum age in days for a cart to be eligible for abandoned cart reminders')
ON CONFLICT (category, key) DO NOTHING;
