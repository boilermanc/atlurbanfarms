-- Migration: Add shipping email templates
-- Description: Adds category field and creates shipping notification email templates
-- Date: 2026-01-22

-- ============================================
-- 1. Add category column to email_templates
-- ============================================
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- Update existing templates with categories
UPDATE email_templates SET category = 'orders' WHERE template_key IN ('order_confirmation', 'order_ready_pickup');
UPDATE email_templates SET category = 'shipping' WHERE template_key = 'shipping_notification';
UPDATE email_templates SET category = 'account' WHERE template_key IN ('welcome', 'password_reset');

-- ============================================
-- 2. Shipping Label Created Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'shipping_label_created',
  'Shipping Label Created',
  'Sent when a shipping label is created for an order',
  'shipping',
  'Your ATL Urban Farms order has shipped!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Shipped</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Your Order Has Shipped!</h1>
        <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Your plants are on their way</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Great news! Your order <strong>#{{order_number}}</strong> has been packed with care and is now on its way to you.
        </p>

        <!-- Tracking Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #166534; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Tracking Number</p>
              <p style="color: #10b981; font-size: 22px; font-weight: bold; margin: 0 0 15px; font-family: monospace;">{{tracking_number}}</p>
              <p style="color: #166534; font-size: 14px; margin: 0 0 20px;">
                Carrier: <strong>{{carrier}}</strong>
              </p>
              <a href="{{tracking_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Your Package</a>
            </td>
          </tr>
        </table>

        <!-- Estimated Delivery -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>Estimated Delivery:</strong> {{estimated_delivery}}
              </p>
            </td>
          </tr>
        </table>

        <!-- Plant Care Tip -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left: 4px solid #10b981; margin: 25px 0;">
          <tr>
            <td style="padding: 15px 20px; background-color: #f9fafb;">
              <p style="color: #166534; font-size: 14px; font-weight: bold; margin: 0 0 5px;">Plant Care Tip</p>
              <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 0;">
                Please unbox your plants as soon as they arrive. If they look stressed from shipping, give them a drink of water and some indirect light - they''ll perk up quickly!
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          Happy growing!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "estimated_delivery", "label": "Estimated Delivery Date", "example": "Friday, January 24th"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://track.shipengine.com/..."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 3. Shipping In Transit Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'shipping_in_transit',
  'Shipping In Transit',
  'Sent when a package is in transit',
  'shipping',
  'Your plants are on the way!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Package In Transit</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Your Plants Are On The Way!</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Your order <strong>#{{order_number}}</strong> is making its way to you!
        </p>

        <!-- Current Location -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px; text-align: center;">
              <p style="color: #1e40af; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Current Location</p>
              <p style="color: #1d4ed8; font-size: 20px; font-weight: bold; margin: 0 0 15px;">{{current_location}}</p>
              <p style="color: #1e40af; font-size: 14px; margin: 0;">
                Tracking: <strong style="font-family: monospace;">{{tracking_number}}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- Estimated Delivery -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="color: #166534; font-size: 16px; margin: 0;">
                <strong>Estimated Delivery:</strong> {{estimated_delivery}}
              </p>
            </td>
          </tr>
        </table>

        <div style="text-align: center; margin: 25px 0;">
          <a href="{{tracking_url}}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Your Package</a>
        </div>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          Almost there!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "current_location", "label": "Current Location", "example": "Atlanta, GA"},
    {"key": "estimated_delivery", "label": "Estimated Delivery Date", "example": "Friday, January 24th"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://track.shipengine.com/..."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 4. Shipping Out for Delivery Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'shipping_out_for_delivery',
  'Out for Delivery',
  'Sent when a package is out for delivery',
  'shipping',
  'Your plants are out for delivery today!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Out for Delivery</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Out for Delivery!</h1>
        <p style="color: #fef3c7; margin: 10px 0 0; font-size: 16px;">Your plants arrive today</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Exciting news! Your order <strong>#{{order_number}}</strong> is out for delivery and will arrive today!
        </p>

        <!-- Delivery Notice -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #92400e; font-size: 40px; margin: 0 0 10px;">&#x1F69A;</p>
              <p style="color: #92400e; font-size: 20px; font-weight: bold; margin: 0 0 15px;">Arriving Today!</p>
              <p style="color: #78350f; font-size: 14px; margin: 0;">
                Carrier: <strong>{{carrier}}</strong><br>
                Tracking: <strong style="font-family: monospace;">{{tracking_number}}</strong>
              </p>
            </td>
          </tr>
        </table>

        <div style="text-align: center; margin: 25px 0;">
          <a href="{{tracking_url}}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Your Delivery</a>
        </div>

        <!-- Plant Care Tip -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left: 4px solid #10b981; margin: 25px 0;">
          <tr>
            <td style="padding: 15px 20px; background-color: #f9fafb;">
              <p style="color: #166534; font-size: 14px; font-weight: bold; margin: 0 0 5px;">Reminder</p>
              <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 0;">
                Please bring your plants inside as soon as they arrive, especially in hot or cold weather. They''ve been waiting to meet you!
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          See you soon!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://track.shipengine.com/..."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 5. Shipping Delivered Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'shipping_delivered',
  'Delivered',
  'Sent when a package has been delivered',
  'shipping',
  'Your plants have been delivered!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Package Delivered</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 50px; margin: 0 0 10px;">&#x1F331;</p>
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Delivered!</h1>
        <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">Your plants have arrived</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Your order <strong>#{{order_number}}</strong> has been delivered!
        </p>

        <!-- Delivery Confirmation -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px; text-align: center;">
              <p style="color: #166534; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Delivered On</p>
              <p style="color: #10b981; font-size: 20px; font-weight: bold; margin: 0 0 15px;">{{delivery_date}}</p>
              <p style="color: #166534; font-size: 14px; margin: 0;">
                Carrier: <strong>{{carrier}}</strong>
              </p>
            </td>
          </tr>
        </table>

        <div style="text-align: center; margin: 25px 0;">
          <a href="{{tracking_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">View Delivery Details</a>
        </div>

        <!-- Getting Started Tips -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #10b981; font-size: 18px; margin: 0 0 15px;">Getting Started with Your Plants</h3>
              <ul style="color: #666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li><strong>Unbox carefully</strong> - Remove packaging gently</li>
                <li><strong>Water if dry</strong> - Check soil moisture and water if needed</li>
                <li><strong>Acclimate slowly</strong> - Place in indirect light for a few days</li>
                <li><strong>Be patient</strong> - Some stress after shipping is normal</li>
              </ul>
            </td>
          </tr>
        </table>

        <!-- Review Request -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 2px dashed #10b981; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px; text-align: center;">
              <p style="color: #166534; font-size: 16px; margin: 0 0 10px;">
                <strong>Love your plants?</strong>
              </p>
              <p style="color: #666; font-size: 14px; margin: 0;">
                We''d love to hear about your experience! Share your plant journey with us.
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          Happy growing!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "delivery_date", "label": "Delivery Date", "example": "January 24, 2026 at 2:30 PM"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://track.shipengine.com/..."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 6. Pickup Ready Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'pickup_ready',
  'Pickup Ready',
  'Sent when an order is ready for pickup',
  'shipping',
  'Your order is ready for pickup!',
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
      <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 50px; margin: 0 0 10px;">&#x1F4E6;</p>
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Ready for Pickup!</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Great news! Your order <strong>#{{order_number}}</strong> is packed and ready for pickup.
        </p>

        <!-- Pickup Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ff; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #7c3aed; font-size: 14px; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Pickup Location</h3>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 5px;">{{pickup_location}}</p>
              <p style="color: #666; font-size: 14px; margin: 0 0 20px;">{{pickup_address}}</p>

              <h3 style="color: #7c3aed; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Pickup Date & Time</h3>
              <p style="color: #333; font-size: 16px; margin: 0;">
                <strong>{{pickup_date}}</strong> at <strong>{{pickup_time}}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- Special Instructions -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left: 4px solid #8b5cf6; margin: 25px 0;">
          <tr>
            <td style="padding: 15px 20px; background-color: #f9fafb;">
              <p style="color: #7c3aed; font-size: 14px; font-weight: bold; margin: 0 0 5px;">Pickup Instructions</p>
              <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 0;">
                {{pickup_instructions}}
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 25px 0;">
          Please bring a valid ID and your order confirmation email. If someone else is picking up your order, let us know in advance.
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          See you soon!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "pickup_location", "label": "Pickup Location Name", "example": "ATL Urban Farms - Westside"},
    {"key": "pickup_address", "label": "Pickup Address", "example": "123 Garden St, Atlanta, GA 30318"},
    {"key": "pickup_date", "label": "Pickup Date", "example": "Saturday, January 25th"},
    {"key": "pickup_time", "label": "Pickup Time", "example": "10:00 AM - 2:00 PM"},
    {"key": "pickup_instructions", "label": "Pickup Instructions", "example": "Please use the side entrance and ring the doorbell."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 7. Pickup Reminder Template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'pickup_reminder',
  'Pickup Reminder',
  'Sent the day before a scheduled pickup',
  'shipping',
  'Reminder: Pick up your plants tomorrow!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pickup Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 50px; margin: 0 0 10px;">&#x23F0;</p>
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pickup Reminder</h1>
        <p style="color: #fef3c7; margin: 10px 0 0; font-size: 16px;">Don''t forget your plants tomorrow!</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{customer_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Just a friendly reminder that your order <strong>#{{order_number}}</strong> is ready and waiting for you!
        </p>

        <!-- Pickup Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef3c7; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #92400e; font-size: 14px; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Tomorrow''s Pickup</h3>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 5px;">{{pickup_location}}</p>
              <p style="color: #78350f; font-size: 14px; margin: 0 0 20px;">{{pickup_address}}</p>

              <p style="color: #333; font-size: 16px; margin: 0;">
                <strong>{{pickup_date}}</strong> at <strong>{{pickup_time}}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- What to Bring -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #333; font-size: 16px; margin: 0 0 15px;">What to Bring</h3>
              <ul style="color: #666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>This email or your order confirmation</li>
                <li>A valid photo ID</li>
                <li>A bag or box to carry your plants (optional)</li>
              </ul>
            </td>
          </tr>
        </table>

        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 25px 0;">
          <strong>{{pickup_instructions}}</strong>
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 30px 0 0;">
          See you tomorrow!<br>
          <strong style="color: #10b981;">The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #d1fae5; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  '[
    {"key": "customer_name", "label": "Customer Name", "example": "John Smith"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "pickup_location", "label": "Pickup Location Name", "example": "ATL Urban Farms - Westside"},
    {"key": "pickup_address", "label": "Pickup Address", "example": "123 Garden St, Atlanta, GA 30318"},
    {"key": "pickup_date", "label": "Pickup Date", "example": "Saturday, January 25th"},
    {"key": "pickup_time", "label": "Pickup Time", "example": "10:00 AM - 2:00 PM"},
    {"key": "pickup_instructions", "label": "Pickup Instructions", "example": "Please use the side entrance and ring the doorbell."}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 8. Deactivate old shipping_notification template
--    (replaced by more specific templates)
-- ============================================
UPDATE email_templates
SET is_active = false,
    description = 'Legacy template - replaced by shipping_label_created, shipping_in_transit, shipping_out_for_delivery, shipping_delivered'
WHERE template_key = 'shipping_notification';

-- Update order_ready_pickup to be inactive if we have the new pickup_ready
UPDATE email_templates
SET is_active = false
WHERE template_key = 'order_ready_pickup';
