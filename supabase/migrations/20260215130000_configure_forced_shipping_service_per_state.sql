-- Configure forced shipping service per state
-- Each state gets exactly ONE shipping option:
--   Western states (OR, CA, NV, UT, NE, WY, ID, ND, SD, WA, MT) → UPS 3-Day Select
--   All other shippable states → UPS Ground
--
-- This uses the existing forced_service logic in shipengine-get-rates edge function (lines 899-915).

-- Default: UPS Ground for all states
INSERT INTO config_settings (category, key, value, label, description, data_type, is_public, is_editable)
VALUES (
  'shipping',
  'forced_service_default',
  '"ups_ground"'::jsonb,
  'Default Shipping Service',
  'ShipEngine service code assigned to all states by default. Customers see only this one option.',
  'string',
  false,
  true
)
ON CONFLICT (category, key) DO UPDATE
  SET value = EXCLUDED.value,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      data_type = EXCLUDED.data_type,
      updated_at = now();

-- Override: UPS 3-Day Select for western states
INSERT INTO config_settings (category, key, value, label, description, data_type, is_public, is_editable)
VALUES (
  'shipping',
  'forced_service_overrides',
  '{"service_code": "ups_3_day_select", "states": ["OR","CA","NV","UT","NE","WY","ID","ND","SD","WA","MT"]}'::jsonb,
  'State Service Override',
  'Override the default shipping service for specific states. Western states use UPS 3-Day Select.',
  'json',
  false,
  true
)
ON CONFLICT (category, key) DO UPDATE
  SET value = EXCLUDED.value,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      data_type = EXCLUDED.data_type,
      updated_at = now();

-- Disable UPS 2-Day service since only Ground and 3-Day Select are offered
UPDATE shipping_services
SET is_enabled = false, updated_at = now()
WHERE service_code = 'ups_2day' AND is_enabled = true;
