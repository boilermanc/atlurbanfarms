-- Migration: Add shipping zones tables for state-based shipping restrictions
-- Created: 2026-01-22

-- 1. Shipping Zones table - per-state shipping settings
CREATE TABLE IF NOT EXISTS shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL UNIQUE,
  state_name text NOT NULL,
  status text NOT NULL DEFAULT 'allowed' CHECK (status IN ('allowed', 'blocked', 'conditional')),
  conditions jsonb DEFAULT NULL,
  customer_message text DEFAULT NULL,
  internal_notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Shipping Zone Rules table - dynamic rules for shipping
CREATE TABLE IF NOT EXISTS shipping_zone_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('seasonal_block', 'service_requirement', 'transit_limit', 'surcharge')),
  priority integer NOT NULL DEFAULT 0,
  conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '{}',
  effective_start date DEFAULT NULL,
  effective_end date DEFAULT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_zones_state_code ON shipping_zones(state_code);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_status ON shipping_zones(status);
CREATE INDEX IF NOT EXISTS idx_shipping_zone_rules_active ON shipping_zone_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shipping_zone_rules_priority ON shipping_zone_rules(priority);

-- 4. RLS Policies
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zone_rules ENABLE ROW LEVEL SECURITY;

-- Admins full access to zones
CREATE POLICY "Admins full access to shipping_zones" ON shipping_zones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Anyone can read zones (needed for checkout)
CREATE POLICY "Anyone can read shipping_zones" ON shipping_zones
  FOR SELECT USING (true);

-- Admins full access to rules
CREATE POLICY "Admins full access to shipping_zone_rules" ON shipping_zone_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Anyone can read active rules (needed for checkout)
CREATE POLICY "Anyone can read active shipping_zone_rules" ON shipping_zone_rules
  FOR SELECT USING (is_active = true);

-- 5. Initialize with default zones (all US states allowed by default)
INSERT INTO shipping_zones (state_code, state_name, status) VALUES
  ('AL', 'Alabama', 'allowed'),
  ('AK', 'Alaska', 'blocked'),  -- Remote, extreme weather
  ('AZ', 'Arizona', 'allowed'),
  ('AR', 'Arkansas', 'allowed'),
  ('CA', 'California', 'conditional'),  -- Agricultural restrictions
  ('CO', 'Colorado', 'allowed'),
  ('CT', 'Connecticut', 'allowed'),
  ('DE', 'Delaware', 'allowed'),
  ('FL', 'Florida', 'allowed'),
  ('GA', 'Georgia', 'allowed'),
  ('HI', 'Hawaii', 'blocked'),  -- Cannot ship plants to Hawaii
  ('ID', 'Idaho', 'allowed'),
  ('IL', 'Illinois', 'allowed'),
  ('IN', 'Indiana', 'allowed'),
  ('IA', 'Iowa', 'allowed'),
  ('KS', 'Kansas', 'allowed'),
  ('KY', 'Kentucky', 'allowed'),
  ('LA', 'Louisiana', 'allowed'),
  ('ME', 'Maine', 'allowed'),
  ('MD', 'Maryland', 'allowed'),
  ('MA', 'Massachusetts', 'allowed'),
  ('MI', 'Michigan', 'allowed'),
  ('MN', 'Minnesota', 'conditional'),  -- Winter restrictions
  ('MS', 'Mississippi', 'allowed'),
  ('MO', 'Missouri', 'allowed'),
  ('MT', 'Montana', 'conditional'),  -- Winter restrictions
  ('NE', 'Nebraska', 'allowed'),
  ('NV', 'Nevada', 'allowed'),
  ('NH', 'New Hampshire', 'allowed'),
  ('NJ', 'New Jersey', 'allowed'),
  ('NM', 'New Mexico', 'allowed'),
  ('NY', 'New York', 'allowed'),
  ('NC', 'North Carolina', 'allowed'),
  ('ND', 'North Dakota', 'conditional'),  -- Winter restrictions
  ('OH', 'Ohio', 'allowed'),
  ('OK', 'Oklahoma', 'allowed'),
  ('OR', 'Oregon', 'allowed'),
  ('PA', 'Pennsylvania', 'allowed'),
  ('RI', 'Rhode Island', 'allowed'),
  ('SC', 'South Carolina', 'allowed'),
  ('SD', 'South Dakota', 'conditional'),  -- Winter restrictions
  ('TN', 'Tennessee', 'allowed'),
  ('TX', 'Texas', 'allowed'),
  ('UT', 'Utah', 'allowed'),
  ('VT', 'Vermont', 'allowed'),
  ('VA', 'Virginia', 'allowed'),
  ('WA', 'Washington', 'allowed'),
  ('WV', 'West Virginia', 'allowed'),
  ('WI', 'Wisconsin', 'conditional'),  -- Winter restrictions
  ('WY', 'Wyoming', 'conditional')  -- Winter restrictions
ON CONFLICT (state_code) DO NOTHING;

-- 6. Set customer messages for blocked/conditional states
UPDATE shipping_zones SET
  customer_message = 'We cannot ship live plants to Hawaii due to agricultural import restrictions.',
  internal_notes = 'USDA restrictions on plant imports'
WHERE state_code = 'HI';

UPDATE shipping_zones SET
  customer_message = 'We cannot ship live plants to Alaska due to extreme transit times and weather conditions.',
  internal_notes = 'Too remote, plants unlikely to survive'
WHERE state_code = 'AK';

UPDATE shipping_zones SET
  customer_message = 'Shipping to California requires expedited shipping due to agricultural inspection delays.',
  conditions = '{"required_service": "priority", "max_transit_days": 3}'::jsonb,
  internal_notes = 'California has strict ag inspection at borders'
WHERE state_code = 'CA';

UPDATE shipping_zones SET
  customer_message = 'Shipping to this state may be suspended during winter months (Dec-Feb) to protect plant health.',
  conditions = '{"blocked_months": [12, 1, 2], "max_transit_days": 3}'::jsonb
WHERE state_code IN ('MN', 'MT', 'ND', 'SD', 'WI', 'WY');

-- 7. Create a sample seasonal rule
INSERT INTO shipping_zone_rules (name, rule_type, priority, conditions, actions, is_active) VALUES
(
  'Winter Shipping Block - Northern States',
  'seasonal_block',
  10,
  '{"states": ["MN", "MT", "ND", "SD", "WI", "WY", "ME", "VT", "NH"], "months": [12, 1, 2]}'::jsonb,
  '{"block": true, "block_message": "We temporarily suspend shipping to your state during winter months to protect plant health. Shipping will resume in March."}'::jsonb,
  true
);

-- 8. Update triggers
CREATE OR REPLACE FUNCTION update_shipping_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipping_zones_updated_at ON shipping_zones;
CREATE TRIGGER shipping_zones_updated_at
  BEFORE UPDATE ON shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_zones_updated_at();

DROP TRIGGER IF EXISTS shipping_zone_rules_updated_at ON shipping_zone_rules;
CREATE TRIGGER shipping_zone_rules_updated_at
  BEFORE UPDATE ON shipping_zone_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_zones_updated_at();
