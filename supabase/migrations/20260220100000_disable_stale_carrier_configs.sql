-- Disable stale carrier configurations now that we've moved to ShipEngine production.
-- Only the production UPS carrier (se-4751564) should remain enabled.

-- Disable sandbox UPS entry (se-4751557)
UPDATE carrier_configurations
SET is_enabled = false, updated_at = NOW()
WHERE api_credentials->>'shipengine_carrier_id' = 'se-4751557'
  AND is_enabled = true;

-- Disable stamps_com carrier (not used with our UPS-only setup)
UPDATE carrier_configurations
SET is_enabled = false, updated_at = NOW()
WHERE carrier_code = 'stamps_com'
  AND is_enabled = true;
