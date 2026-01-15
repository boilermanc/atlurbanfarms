-- Config Settings Table
-- Stores application configuration settings by category and key

CREATE TABLE config_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE config_settings ENABLE ROW LEVEL SECURITY;

-- Public can view certain settings (for frontend use)
CREATE POLICY "Public can view public settings"
  ON config_settings FOR SELECT USING (
    category IN ('branding', 'shipping', 'checkout')
  );

-- Authenticated users with admin roles can manage all settings
CREATE POLICY "Admins can manage config settings"
  ON config_settings FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for fast lookups
CREATE INDEX idx_config_settings_category ON config_settings(category);
CREATE INDEX idx_config_settings_category_key ON config_settings(category, key);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_config_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER config_settings_updated_at
  BEFORE UPDATE ON config_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_config_settings_updated_at();

-- Insert default settings

-- Business settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('business', 'company_name', 'ATL Urban Farms', 'string', 'Company display name'),
  ('business', 'support_email', '', 'string', 'Customer support email address'),
  ('business', 'support_phone', '', 'string', 'Customer support phone number'),
  ('business', 'timezone', 'America/New_York', 'string', 'Business timezone'),
  ('business', 'ship_from_address_line1', '', 'string', 'Ship-from address line 1'),
  ('business', 'ship_from_address_line2', '', 'string', 'Ship-from address line 2'),
  ('business', 'ship_from_city', 'Atlanta', 'string', 'Ship-from city'),
  ('business', 'ship_from_state', 'GA', 'string', 'Ship-from state'),
  ('business', 'ship_from_zip', '', 'string', 'Ship-from ZIP code'),
  ('business', 'ship_from_country', 'US', 'string', 'Ship-from country');

-- Checkout settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('checkout', 'guest_checkout_enabled', 'true', 'boolean', 'Allow checkout without account'),
  ('checkout', 'minimum_order_amount', '0', 'number', 'Minimum order amount in dollars'),
  ('checkout', 'maximum_order_amount', '10000', 'number', 'Maximum order amount in dollars'),
  ('checkout', 'cart_expiration_hours', '24', 'number', 'Hours until cart expires');

-- Shipping settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('shipping', 'free_shipping_enabled', 'false', 'boolean', 'Enable free shipping threshold'),
  ('shipping', 'free_shipping_threshold', '50', 'number', 'Free shipping minimum order amount'),
  ('shipping', 'default_shipping_service', 'standard', 'string', 'Default shipping service');

-- Inventory settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('inventory', 'default_buffer_percentage', '10', 'number', 'Default inventory buffer percentage'),
  ('inventory', 'low_stock_threshold', '10', 'number', 'Low stock alert threshold'),
  ('inventory', 'allow_oversell', 'false', 'boolean', 'Allow selling when out of stock'),
  ('inventory', 'allocation_strategy', 'fifo', 'string', 'Inventory allocation strategy (fifo, lifo, fefo)');

-- Notification settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('notifications', 'order_confirmation_email', 'true', 'boolean', 'Send order confirmation emails'),
  ('notifications', 'shipping_notification_email', 'true', 'boolean', 'Send shipping notification emails'),
  ('notifications', 'shipping_notification_sms', 'false', 'boolean', 'Send shipping notification SMS'),
  ('notifications', 'low_stock_alert', 'true', 'boolean', 'Send low stock alerts to admins'),
  ('notifications', 'admin_notification_emails', '', 'string', 'Comma-separated admin email addresses');

-- Branding settings
INSERT INTO config_settings (category, key, value, data_type, description) VALUES
  ('branding', 'logo_url', '', 'string', 'Logo image URL'),
  ('branding', 'primary_brand_color', '#10b981', 'string', 'Primary brand color hex code'),
  ('branding', 'homepage_announcement', '', 'string', 'Homepage announcement text'),
  ('branding', 'announcement_bar_enabled', 'false', 'boolean', 'Show announcement bar'),
  ('branding', 'announcement_bar_text', '', 'string', 'Announcement bar text');
