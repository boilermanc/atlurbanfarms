-- Add mode-specific Stripe keys and migrate existing legacy values.
-- The edge functions resolve keys by reading stripe_mode + the matching
-- stripe_*_test / stripe_*_live row, so both must exist.

-- 1. Ensure stripe_mode exists (defaults to 'test')
INSERT INTO config_settings (category, key, value, data_type, value_type, description)
VALUES ('integrations', 'stripe_mode', '"test"', 'string', 'string', 'Active Stripe environment: test or live')
ON CONFLICT (category, key) DO NOTHING;

-- 2. Add mode-specific publishable key rows.
--    Migrate the current stripe_publishable_key value into the _test bucket
--    (existing keys are pk_test_*).
INSERT INTO config_settings (category, key, value, data_type, value_type, description)
SELECT 'integrations',
       'stripe_publishable_key_test',
       COALESCE(
         (SELECT value FROM config_settings WHERE category = 'integrations' AND key = 'stripe_publishable_key'),
         '""'
       ),
       'string',
       'string',
       'Stripe test-mode publishable key'
WHERE NOT EXISTS (
  SELECT 1 FROM config_settings WHERE category = 'integrations' AND key = 'stripe_publishable_key_test'
);

INSERT INTO config_settings (category, key, value, data_type, value_type, description)
VALUES ('integrations', 'stripe_publishable_key_live', '""', 'string', 'string', 'Stripe live-mode publishable key')
ON CONFLICT (category, key) DO NOTHING;

-- 3. Add mode-specific secret key rows.
INSERT INTO config_settings (category, key, value, data_type, value_type, description)
SELECT 'integrations',
       'stripe_secret_key_test',
       COALESCE(
         (SELECT value FROM config_settings WHERE category = 'integrations' AND key = 'stripe_secret_key'),
         '""'
       ),
       'string',
       'string',
       'Stripe test-mode secret key'
WHERE NOT EXISTS (
  SELECT 1 FROM config_settings WHERE category = 'integrations' AND key = 'stripe_secret_key_test'
);

INSERT INTO config_settings (category, key, value, data_type, value_type, description)
VALUES ('integrations', 'stripe_secret_key_live', '""', 'string', 'string', 'Stripe live-mode secret key')
ON CONFLICT (category, key) DO NOTHING;

-- 4. Add mode-specific webhook secret rows.
INSERT INTO config_settings (category, key, value, data_type, value_type, description)
SELECT 'integrations',
       'stripe_webhook_secret_test',
       COALESCE(
         (SELECT value FROM config_settings WHERE category = 'integrations' AND key = 'stripe_webhook_secret'),
         '""'
       ),
       'string',
       'string',
       'Stripe test-mode webhook signing secret'
WHERE NOT EXISTS (
  SELECT 1 FROM config_settings WHERE category = 'integrations' AND key = 'stripe_webhook_secret_test'
);

INSERT INTO config_settings (category, key, value, data_type, value_type, description)
VALUES ('integrations', 'stripe_webhook_secret_live', '""', 'string', 'string', 'Stripe live-mode webhook signing secret')
ON CONFLICT (category, key) DO NOTHING;
