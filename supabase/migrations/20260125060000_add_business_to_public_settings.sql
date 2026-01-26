-- Add 'business' category to public settings access
-- This allows the footer to fetch contact information

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can view public settings" ON config_settings;

-- Recreate with 'business' included
CREATE POLICY "Public can view public settings"
  ON config_settings FOR SELECT USING (
    category IN ('branding', 'shipping', 'checkout', 'business')
  );
