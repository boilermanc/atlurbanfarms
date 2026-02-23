-- Migration: Replace Resend email integration with SMTP (Google Workspace)
-- Insert new SMTP config rows, copying from_email and from_name from existing Resend config
-- Note: value column is jsonb, so string values must be JSON-encoded (double-quoted)

INSERT INTO config_settings (category, key, value, data_type, description)
VALUES
  ('integrations', 'smtp_enabled', 'false', 'boolean', 'Enable email sending via SMTP'),
  ('integrations', 'smtp_host', '"smtp.gmail.com"', 'string', 'SMTP server hostname'),
  ('integrations', 'smtp_port', '"465"', 'string', 'SMTP server port (465 for SSL)'),
  ('integrations', 'smtp_username', '""', 'string', 'SMTP authentication username (email address)'),
  ('integrations', 'smtp_password', '""', 'string', 'SMTP authentication password (App Password)')
ON CONFLICT (category, key) DO NOTHING;

-- Copy from_email from existing Resend config (already JSON-encoded in the DB)
INSERT INTO config_settings (category, key, value, data_type, description)
SELECT 'integrations',
       'smtp_from_email',
       COALESCE(
         (SELECT value FROM config_settings WHERE category = 'integrations' AND key = 'resend_from_email'),
         '""'
       ),
       'string',
       'Default From email address'
WHERE NOT EXISTS (
  SELECT 1 FROM config_settings WHERE category = 'integrations' AND key = 'smtp_from_email'
);

-- Copy from_name from existing Resend config (already JSON-encoded in the DB)
INSERT INTO config_settings (category, key, value, data_type, description)
SELECT 'integrations',
       'smtp_from_name',
       COALESCE(
         (SELECT value FROM config_settings WHERE category = 'integrations' AND key = 'resend_from_name'),
         '""'
       ),
       'string',
       'Default From display name'
WHERE NOT EXISTS (
  SELECT 1 FROM config_settings WHERE category = 'integrations' AND key = 'smtp_from_name'
);

-- Leave old resend_* rows in place for rollback safety.
-- They can be removed in a future migration after SMTP is verified working.
