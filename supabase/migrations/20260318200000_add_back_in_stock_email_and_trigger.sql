-- ============================================
-- Back-in-stock email template
-- ============================================
INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'back_in_stock',
  'Back In Stock Notification',
  'Sent to subscribers when an out-of-stock product becomes available again',
  'alerts',
  '{{product_name}} is back in stock!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Back In Stock</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">It''s Back!</h1>
        <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">An item on your wishlist is available again</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          Great news! <strong>{{product_name}}</strong> is back in stock and ready to ship. These go fast, so grab yours before they''re gone again!
        </p>

        <!-- Product Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #166534; font-size: 20px; font-weight: bold; margin: 0 0 8px;">{{product_name}}</p>
              <p style="color: #10b981; font-size: 18px; font-weight: bold; margin: 0 0 20px;">{{product_price}}</p>
              <a href="{{product_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Shop Now</a>
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
    {"key": "first_name", "label": "Customer First Name", "example": "Sarah"},
    {"key": "product_name", "label": "Product Name", "example": "Cherry Tomato Seedlings"},
    {"key": "product_url", "label": "Product Page URL", "example": "https://deux.atlurbanfarms.com/shop/cherry-tomato"},
    {"key": "product_image", "label": "Product Image URL", "example": "https://..."},
    {"key": "product_price", "label": "Product Price", "example": "$4.99"}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;


-- ============================================
-- Trigger function: auto-notify when product restocked
-- Fires when quantity_available changes from 0 to > 0
-- and there are pending alerts for the product.
-- Uses pg_net to call the edge function asynchronously.
-- ============================================

-- Enable pg_net extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_back_in_stock_notify()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INTEGER;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only fire when quantity goes from 0 (or NULL) to > 0
  IF (COALESCE(OLD.quantity_available, 0) = 0) AND (NEW.quantity_available > 0) THEN
    -- Check if there are pending alerts
    SELECT COUNT(*) INTO pending_count
    FROM public.back_in_stock_alerts
    WHERE product_id = NEW.id AND status = 'pending';

    IF pending_count > 0 THEN
      -- Read Supabase URL and service key from vault or env
      supabase_url := current_setting('app.settings.supabase_url', true);
      service_key := current_setting('app.settings.service_role_key', true);

      -- If settings are available, call the edge function via pg_net
      IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := supabase_url || '/functions/v1/back-in-stock-notify',
          body := json_build_object('product_id', NEW.id)::text,
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          )::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the products table
DROP TRIGGER IF EXISTS trg_back_in_stock_notify ON public.products;
CREATE TRIGGER trg_back_in_stock_notify
  AFTER UPDATE OF quantity_available ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_back_in_stock_notify();
