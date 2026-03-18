-- Migration: Add guest account creation CTA to order confirmation email
-- Date: 2026-03-17
-- Adds {{account_cta}} placeholder between View Invoice button and "Happy growing!" sign-off.
-- The send-email function populates this with a CTA block for guest orders, or empty string for logged-in customers.
-- Uses REPLACE() to preserve Sheree's custom template design.

-- Insert {{account_cta}} after the View Invoice button (before "Happy growing!")
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  'Happy growing!',
  '{{account_cta}}

        Happy growing!'
),
updated_at = NOW()
WHERE template_key = 'order_confirmation'
  AND html_content NOT LIKE '%{{account_cta}}%';

-- Add account_cta to variables_schema
UPDATE email_templates
SET variables_schema = variables_schema || '[{"key": "account_cta", "label": "Guest Account Creation CTA (auto-generated)", "example": ""}]'::jsonb,
    updated_at = NOW()
WHERE template_key = 'order_confirmation'
  AND NOT variables_schema::text LIKE '%account_cta%';
