-- Migration: Email Templates System
-- Description: Creates tables for managing email templates, versions, and brand settings
-- Date: January 2025

-- ============================================
-- Table: email_templates
-- Main table for storing email template content
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  subject_line VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  plain_text_content TEXT,
  variables_schema JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- ============================================
-- Table: email_template_versions
-- Stores version history for each template
-- ============================================
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  subject_line VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  plain_text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for version lookups
CREATE INDEX IF NOT EXISTS idx_template_versions_template ON email_template_versions(template_id, version_number DESC);

-- ============================================
-- Table: email_brand_settings
-- Global brand settings used across all templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'text',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_brand_settings ENABLE ROW LEVEL SECURITY;

-- email_templates policies
CREATE POLICY "Authenticated users can read active email_templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email_templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email_templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (true);

-- email_template_versions policies
CREATE POLICY "Authenticated users can read email_template_versions"
  ON email_template_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_template_versions"
  ON email_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- email_brand_settings policies
CREATE POLICY "Authenticated users can read email_brand_settings"
  ON email_brand_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update email_brand_settings"
  ON email_brand_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert email_brand_settings"
  ON email_brand_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Seed Default Brand Settings
-- ============================================
INSERT INTO email_brand_settings (setting_key, setting_value, setting_type) VALUES
  ('logo_url', '', 'url'),
  ('primary_color', '#10b981', 'color'),
  ('secondary_color', '#065f46', 'color'),
  ('footer_text', '© {{current_year}} ATL Urban Farms. All rights reserved.', 'textarea'),
  ('facebook_url', '', 'url'),
  ('instagram_url', '', 'url'),
  ('business_name', 'ATL Urban Farms', 'text'),
  ('business_email', 'hello@atlurbanfarms.com', 'email'),
  ('business_phone', '', 'text'),
  ('business_address', 'Atlanta, GA', 'textarea')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- Seed Default Email Templates
-- ============================================

-- Order Confirmation Template
INSERT INTO email_templates (template_key, name, description, subject_line, html_content, variables_schema) VALUES
(
  'order_confirmation',
  'Order Confirmation',
  'Sent automatically after a successful checkout',
  'Your ATL Urban Farms Order #{{order_id}} is Confirmed!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ATL Urban Farms</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #10b981; margin: 0 0 20px; font-size: 24px;">Thank You for Your Order!</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We''ve received your order and are getting your plants ready with care. Here''s a summary of what you ordered:
        </p>

        <!-- Order Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">
                <strong>Order Number:</strong> {{order_id}}<br>
                <strong>Order Date:</strong> {{order_date}}
              </p>
            </td>
          </tr>
        </table>

        <!-- Order Items -->
        {{order_items}}

        <!-- Order Total -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 2px solid #10b981; margin-top: 20px; padding-top: 20px;">
          <tr>
            <td style="text-align: right; padding: 5px 0;">
              <span style="color: #666;">Subtotal:</span>
              <span style="color: #333; margin-left: 20px;">{{order_subtotal}}</span>
            </td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 5px 0;">
              <span style="color: #666;">Shipping:</span>
              <span style="color: #333; margin-left: 20px;">{{order_shipping}}</span>
            </td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 5px 0;">
              <span style="color: #666;">Tax:</span>
              <span style="color: #333; margin-left: 20px;">{{order_tax}}</span>
            </td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 10px 0;">
              <span style="color: #10b981; font-size: 18px; font-weight: bold;">Total:</span>
              <span style="color: #10b981; font-size: 18px; font-weight: bold; margin-left: 20px;">{{order_total}}</span>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          We''ll send you another email when your order ships. If you have any questions, just reply to this email!
        </p>

        <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <strong>Note:</strong> We ship live plants Monday through Wednesday only to ensure they arrive fresh and healthy!
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          Happy growing!<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "customer_email", "label": "Customer Email", "example": "john@example.com"},
    {"key": "order_id", "label": "Order ID", "example": "ORD-2025-001234"},
    {"key": "order_date", "label": "Order Date", "example": "January 22, 2025"},
    {"key": "order_items", "label": "Order Items (HTML)", "example": "<table>...</table>"},
    {"key": "order_subtotal", "label": "Subtotal", "example": "$42.99"},
    {"key": "order_shipping", "label": "Shipping Cost", "example": "$5.00"},
    {"key": "order_tax", "label": "Tax", "example": "$0.00"},
    {"key": "order_total", "label": "Order Total", "example": "$47.99"}
  ]'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Shipping Update Template
INSERT INTO email_templates (template_key, name, description, subject_line, html_content, variables_schema) VALUES
(
  'shipping_notification',
  'Shipping Update',
  'Sent when a tracking number is added to an order',
  'Your ATL Urban Farms Order #{{order_id}} Has Shipped!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ATL Urban Farms</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #10b981; margin: 0 0 20px; font-size: 24px;">Your Order Has Shipped!</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Great news! Your order #{{order_id}} is on its way to you.
        </p>

        <!-- Tracking Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 8px; margin: 25px 0; text-align: center;">
          <tr>
            <td style="padding: 30px;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px;">Tracking Number</p>
              <p style="color: #10b981; font-size: 24px; font-weight: bold; margin: 0 0 20px;">{{tracking_number}}</p>
              <p style="color: #666; font-size: 14px; margin: 0 0 15px;">Carrier: {{carrier}}</p>
              <a href="{{tracking_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Package</a>
            </td>
          </tr>
        </table>

        <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #fef3c7; padding: 15px; border-radius: 8px;">
          <strong>Plant Care Tip:</strong> Please ensure someone is available to receive the package, as live plants are sensitive to temperature extremes.
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          Happy growing!<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "order_id", "label": "Order ID", "example": "ORD-2025-001234"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://ups.com/track?num=1Z999AA10123456784"},
    {"key": "estimated_delivery", "label": "Estimated Delivery", "example": "January 25, 2025"}
  ]'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Welcome Email Template
INSERT INTO email_templates (template_key, name, description, subject_line, html_content, variables_schema) VALUES
(
  'welcome',
  'Welcome Email',
  'Sent when a new account is created',
  'Welcome to ATL Urban Farms, {{customer_first_name}}!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ATL Urban Farms</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #10b981; margin: 0 0 20px; font-size: 24px;">Welcome to ATL Urban Farms!</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Thanks for creating an account with us! We''re excited to help you grow your garden.
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          As a member, you''ll enjoy:
        </p>

        <ul style="color: #333; font-size: 16px; line-height: 1.8;">
          <li>Order tracking and history</li>
          <li>Saved addresses for faster checkout</li>
          <li>Exclusive member offers</li>
          <li>Access to Sage, our AI gardening assistant</li>
        </ul>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
            <td>
              <a href="{{login_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Start Shopping</a>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Happy growing!<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "customer_email", "label": "Customer Email", "example": "john@example.com"},
    {"key": "login_url", "label": "Login URL", "example": "https://atlurbanfarms.com/login"}
  ]'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Password Reset Template
INSERT INTO email_templates (template_key, name, description, subject_line, html_content, variables_schema) VALUES
(
  'password_reset',
  'Password Reset',
  'Sent when a user requests a password reset',
  'Reset Your ATL Urban Farms Password',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ATL Urban Farms</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #333; margin: 0 0 20px; font-size: 24px;">Reset Your Password</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new one:
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
            <td>
              <a href="{{reset_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            </td>
          </tr>
        </table>

        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This link will expire in {{expiry_time}}.
        </p>

        <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
          If you didn''t request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "reset_url", "label": "Reset URL", "example": "https://atlurbanfarms.com/reset-password?token=abc123"},
    {"key": "expiry_time", "label": "Link Expiry Time", "example": "24 hours"}
  ]'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Ready for Pickup Template
INSERT INTO email_templates (template_key, name, description, subject_line, html_content, variables_schema, is_active) VALUES
(
  'order_ready_pickup',
  'Ready for Pickup',
  'Sent when an order is marked ready for pickup',
  'Your ATL Urban Farms Order #{{order_id}} is Ready for Pickup!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ready for Pickup</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ATL Urban Farms</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #10b981; margin: 0 0 20px; font-size: 24px;">Your Order is Ready!</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Great news! Your order #{{order_id}} is ready and waiting for you.
        </p>

        <!-- Pickup Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 8px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #166534; margin: 0 0 15px; font-size: 16px;">Pickup Location</h3>
              <p style="color: #333; font-size: 16px; margin: 0 0 5px; font-weight: bold;">{{pickup_location}}</p>
              <p style="color: #666; font-size: 14px; margin: 0 0 15px;">{{pickup_address}}</p>

              <h3 style="color: #166534; margin: 0 0 10px; font-size: 16px;">Hours</h3>
              <p style="color: #333; font-size: 14px; margin: 0;">{{pickup_hours}}</p>
            </td>
          </tr>
        </table>

        {{#if pickup_instructions}}
        <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #fef3c7; padding: 15px; border-radius: 8px;">
          <strong>Special Instructions:</strong> {{pickup_instructions}}
        </p>
        {{/if}}

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          See you soon!<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "order_id", "label": "Order ID", "example": "ORD-2025-001234"},
    {"key": "pickup_location", "label": "Pickup Location Name", "example": "ATL Urban Farms - Westside"},
    {"key": "pickup_address", "label": "Pickup Address", "example": "123 Garden St, Atlanta, GA 30318"},
    {"key": "pickup_hours", "label": "Pickup Hours", "example": "Mon-Sat 9am-5pm"},
    {"key": "pickup_instructions", "label": "Special Instructions", "example": "Ring doorbell on arrival"}
  ]'::jsonb,
  false  -- Not active by default since pickup may not be set up
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- Function to auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_timestamp();

DROP TRIGGER IF EXISTS email_brand_settings_updated_at ON email_brand_settings;
CREATE TRIGGER email_brand_settings_updated_at
  BEFORE UPDATE ON email_brand_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_timestamp();
