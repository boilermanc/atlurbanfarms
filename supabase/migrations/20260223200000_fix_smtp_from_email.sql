-- Fix SMTP from email address: use orders@ instead of support@ or clint@
-- The smtp_username (clint@) is for SMTP authentication only.
-- The smtp_from_email controls the From header in outgoing emails.
-- Note: Gmail Send As alias must be configured for orders@atlurbanfarms.com

UPDATE config_settings
SET value = '"orders@atlurbanfarms.com"',
    updated_at = NOW()
WHERE category = 'integrations'
  AND key = 'smtp_from_email';

UPDATE config_settings
SET value = '"ATL Urban Farms"',
    updated_at = NOW()
WHERE category = 'integrations'
  AND key = 'smtp_from_name';
