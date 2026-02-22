-- Migration: Update order confirmation email template and brand settings
-- Date: 2026-02-22
-- Fixes:
--   1. Order items render as proper HTML table (Product, Qty, Price columns)
--   2. Dynamic branding: logo + primary color from config_settings
--   3. Delivery info section (shipping address or pickup details)
--   4. Shipping note pulled from config_settings
--   5. View Invoice button linking to /account/orders
--   6. Footer address: www.AtlUrbanFarms.com
--   7. Footer copyright: ATL Urban Farms, a Sweetwater Urban Farms company
--   8. Header/footer color: uses {{primary_color}} from brand config

-- Update order confirmation template with new design
UPDATE email_templates
SET html_content = $tpl$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header with branding -->
    <tr>
      <td style="background-color: {{primary_color}}; padding: 30px; text-align: center;">
        {{header_content}}
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: {{primary_color}}; margin: 0 0 20px; font-size: 24px;">Thank You for Your Order!</h1>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{customer_first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We've received your order and are getting your plants ready with care. Here's a summary of what you ordered:
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

        <!-- Order Items Table -->
        {{order_items}}

        <!-- Order Total -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 2px solid {{primary_color}}; margin-top: 20px; padding-top: 20px;">
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
              <span style="color: {{primary_color}}; font-size: 18px; font-weight: bold;">Total:</span>
              <span style="color: {{primary_color}}; font-size: 18px; font-weight: bold; margin-left: 20px;">{{order_total}}</span>
            </td>
          </tr>
        </table>

        <!-- Delivery Info (Shipping Address or Pickup Details) -->
        {{delivery_info}}

        <!-- Shipping Note -->
        <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <strong>Note:</strong> {{shipping_note}}
        </p>

        <!-- View Invoice Button -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto; text-align: center;" width="100%">
          <tr>
            <td style="text-align: center;">
              <a href="{{invoice_url}}" style="display: inline-block; background-color: {{primary_color}}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Invoice</a>
            </td>
          </tr>
        </table>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          Happy growing!<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: {{primary_color}}; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          www.AtlUrbanFarms.com
        </p>
        <p style="color: #ffffff; font-size: 12px; margin: 0;">
          ATL Urban Farms, a Sweetwater Urban Farms company &ndash; Powered by Sweetwater Technology
        </p>
      </td>
    </tr>
  </table>
</body>
</html>$tpl$,
variables_schema = '[
  {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
  {"key": "order_id", "label": "Order Number", "example": "ORD-2026-001234"},
  {"key": "order_date", "label": "Order Date", "example": "February 22, 2026"},
  {"key": "order_items", "label": "Order Items (HTML table)", "example": "<table>...</table>"},
  {"key": "order_subtotal", "label": "Subtotal", "example": "$42.99"},
  {"key": "order_shipping", "label": "Shipping Cost", "example": "$5.00"},
  {"key": "order_tax", "label": "Tax", "example": "$0.00"},
  {"key": "order_total", "label": "Order Total", "example": "$47.99"},
  {"key": "delivery_info", "label": "Delivery Info (HTML)", "example": "Shipping or pickup details"},
  {"key": "shipping_note", "label": "Shipping Note", "example": "We ship live plants Mon-Wed..."},
  {"key": "invoice_url", "label": "Invoice URL", "example": "https://deux.atlurbanfarms.com/account/orders"},
  {"key": "primary_color", "label": "Brand Primary Color", "example": "#10b981"},
  {"key": "header_content", "label": "Header Content (logo or text)", "example": "<img src=...>"}
]'::jsonb,
updated_at = NOW()
WHERE template_key = 'order_confirmation';

-- Update brand settings for consistent branding across all email templates
UPDATE email_brand_settings
SET setting_value = 'www.AtlUrbanFarms.com',
    updated_at = NOW()
WHERE setting_key = 'business_address';

UPDATE email_brand_settings
SET setting_value = 'ATL Urban Farms, a Sweetwater Urban Farms company – Powered by Sweetwater Technology',
    updated_at = NOW()
WHERE setting_key = 'footer_text';
