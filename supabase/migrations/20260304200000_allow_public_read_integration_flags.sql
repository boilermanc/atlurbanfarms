-- Allow public (non-admin) users to read non-secret integration settings
-- needed by the checkout page (stripe_enabled, stripe_publishable_key, etc.)
-- Secret keys remain hidden by RLS.

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
  );
