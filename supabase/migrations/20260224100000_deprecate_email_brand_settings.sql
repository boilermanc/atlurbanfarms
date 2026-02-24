-- Deprecate email_brand_settings table.
-- Brand colors now come from config_settings (category='branding') as the
-- single source of truth. The email send-email edge function and admin
-- useBrandSettings() hook have been updated to read from config_settings.
--
-- This migration:
-- 1. Adds a business_address key to config_settings (was only in email_brand_settings)
-- 2. Marks email_brand_settings as deprecated via a table comment
-- The table is NOT dropped yet for rollback safety.

-- Ensure business_address exists in config_settings
INSERT INTO config_settings (category, key, value, data_type, description)
VALUES ('business', 'business_address', '"Atlanta, GA"', 'string', 'Business mailing address for emails and footer')
ON CONFLICT (category, key) DO NOTHING;

-- Mark the old table as deprecated
COMMENT ON TABLE email_brand_settings IS 'DEPRECATED: Use config_settings category=branding instead. Kept for rollback safety. No code reads from this table as of 2026-02-24.';
