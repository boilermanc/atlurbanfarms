-- Fix shipping emails (issue #33)
-- 1. Re-activate shipping_notification template
-- 2. Deactivate unused shipping templates (label_created, in_transit, out_for_delivery)
-- 3. Add scheduled email columns to shipments table

-- Re-activate the shipping_notification template (was deactivated in favor of granular templates)
UPDATE email_templates
SET is_active = true,
    description = 'Sent 24 hours after shipping label creation with tracking info',
    updated_at = now()
WHERE template_key = 'shipping_notification';

-- Deactivate the three templates we no longer need
UPDATE email_templates
SET is_active = false,
    updated_at = now()
WHERE template_key IN (
  'shipping_label_created',
  'shipping_in_transit',
  'shipping_out_for_delivery'
);

-- Add columns to shipments for scheduled shipping notification email
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS shipping_email_send_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_email_sent_at TIMESTAMPTZ;

-- Index for the scheduled email query (find unsent emails past their send time)
CREATE INDEX IF NOT EXISTS idx_shipments_pending_email
  ON public.shipments (shipping_email_send_at)
  WHERE shipping_email_sent_at IS NULL AND voided = false;
