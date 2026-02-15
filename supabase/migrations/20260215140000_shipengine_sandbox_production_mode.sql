-- Add sandbox/production mode toggle for ShipEngine API keys
-- Allows admins to store both keys and flip between environments instantly.

-- 1. Copy existing shipengine_api_key to the sandbox slot (it's a TEST_ key)
INSERT INTO config_settings (category, key, value, data_type, label, description, is_public, is_editable)
SELECT
  'integrations',
  'shipengine_api_key_sandbox',
  cs.value,
  'string',
  'ShipEngine Sandbox API Key',
  'ShipEngine TEST_ API key for sandbox/development use. Returns estimated retail rates.',
  false,
  true
FROM config_settings cs
WHERE cs.category = 'integrations' AND cs.key = 'shipengine_api_key'
ON CONFLICT (category, key) DO NOTHING;

-- 2. Create empty production key slot (value column is jsonb, so empty string = '""')
INSERT INTO config_settings (category, key, value, data_type, label, description, is_public, is_editable)
VALUES (
  'integrations',
  'shipengine_api_key_production',
  '""'::jsonb,
  'string',
  'ShipEngine Production API Key',
  'ShipEngine production API key from your Shipstation-connected account. Returns negotiated rates.',
  false,
  true
)
ON CONFLICT (category, key) DO NOTHING;

-- 3. Set mode to sandbox (matches current state)
INSERT INTO config_settings (category, key, value, data_type, label, description, is_public, is_editable)
VALUES (
  'integrations',
  'shipengine_mode',
  '"sandbox"'::jsonb,
  'string',
  'ShipEngine Environment Mode',
  'Controls which API key is active: "sandbox" for testing or "production" for live negotiated rates.',
  false,
  true
)
ON CONFLICT (category, key) DO NOTHING;
