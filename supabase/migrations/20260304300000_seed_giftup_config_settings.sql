-- Seed giftup config_settings rows so the admin upsert hits UPDATE (not INSERT).
-- Without pre-existing rows the client-side upsert was silently blocked by RLS.

INSERT INTO config_settings (category, key, value, data_type, description)
VALUES
  ('giftup', 'enabled',   'false',  'boolean', 'Accept Gift Up codes at checkout'),
  ('giftup', 'test_mode', 'false',  'boolean', 'Send x-giftup-testmode header on API calls'),
  ('giftup', 'site_id',   '""',     'string',  'Gift Up Site ID for the storefront widget')
ON CONFLICT (category, key) DO NOTHING;

-- Allow the public (anon) client to read giftup flags needed by the
-- customer-facing Gift Cards page (GiftCardsPage.tsx).
DROP POLICY IF EXISTS "Public can view public settings" ON config_settings;

CREATE POLICY "Public can view public settings"
  ON config_settings FOR SELECT USING (
    category IN ('branding', 'shipping', 'checkout', 'business')
    OR (
      category = 'integrations'
      AND key IN (
        'stripe_enabled',
        'stripe_mode',
        'stripe_publishable_key',
        'stripe_publishable_key_test',
        'stripe_publishable_key_live',
        'shipstation_enabled'
      )
    )
    OR (
      category = 'giftup'
      AND key IN ('enabled', 'site_id')
    )
  );

-- Ensure admins can INSERT new config_settings rows (not just UPDATE existing ones).
-- This prevents silent upsert failures for any future integration categories.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'config_settings'
      AND policyname = 'Admins can manage all config_settings'
  ) THEN
    CREATE POLICY "Admins can manage all config_settings"
      ON config_settings FOR ALL USING (
        EXISTS (
          SELECT 1 FROM admin_user_roles
          WHERE customer_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;
