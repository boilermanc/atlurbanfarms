-- Abandoned cart email reminder system
-- Captures cart snapshots when users start checkout, sends reminder emails
-- for carts abandoned 2+ hours without order completion.

-- ============================================
-- 1. Create abandoned_carts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    cart_items JSONB NOT NULL,
    cart_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    reminder_sent_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Indexes
-- ============================================

-- Unique constraint enables ON CONFLICT upsert and prevents duplicate rows per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_session_email
    ON public.abandoned_carts(session_id, email);

-- Partial index for the cron query (only pending, unconverted carts)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_reminder_pending
    ON public.abandoned_carts(updated_at)
    WHERE reminder_sent_at IS NULL AND converted_at IS NULL;

-- For email deduplication in the edge function
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email
    ON public.abandoned_carts(email);

-- For customer lookups
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_id
    ON public.abandoned_carts(customer_id);

-- ============================================
-- 3. Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_abandoned_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER abandoned_carts_updated_at
    BEFORE UPDATE ON public.abandoned_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_abandoned_carts_updated_at();

-- ============================================
-- 4. RLS policies
-- ============================================

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (guest checkout has no auth)
CREATE POLICY "Anyone can insert abandoned carts"
    ON public.abandoned_carts
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Anyone can update by session_id (for marking as converted)
CREATE POLICY "Anyone can update abandoned carts by session"
    ON public.abandoned_carts
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

-- Admin full access
CREATE POLICY "Admins have full access to abandoned carts"
    ON public.abandoned_carts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_user_roles
            WHERE customer_id = auth.uid()
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_user_roles
            WHERE customer_id = auth.uid()
            AND is_active = true
        )
    );

-- ============================================
-- 5. Abandoned cart email template
-- ============================================

INSERT INTO email_templates (
    template_key, name, description, category,
    subject_line, html_content, variables_schema, is_active
) VALUES (
    'abandoned_cart',
    'Abandoned Cart Reminder',
    'Sent when a customer leaves items in their cart without completing checkout',
    'marketing',
    'You left some seedlings behind! Your cart is waiting 🌱',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Cart is Waiting</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Your Seedlings Are Waiting!</h1>
        <p style="color: #d1fae5; margin: 10px 0 0; font-size: 16px;">You left {{item_count}} item(s) in your cart</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi {{first_name}},
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
          It looks like you were in the middle of something! Your cart with {{item_count}} item(s) totaling <strong>{{cart_total}}</strong> is still saved and ready for you.
        </p>
        <!-- Cart Items -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 12px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              {{cart_items_html}}
            </td>
          </tr>
        </table>
        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{checkout_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">Complete Your Order</a>
        </div>
        <!-- Urgency message -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left: 4px solid #f59e0b; margin: 25px 0;">
          <tr>
            <td style="padding: 15px 20px; background-color: #fef3c7;">
              <p style="color: #92400e; font-size: 14px; font-weight: bold; margin: 0 0 5px;">Live Plants - Limited Availability</p>
              <p style="color: #78350f; font-size: 14px; line-height: 1.5; margin: 0;">
                Our seedlings are grown fresh weekly. Stock can change quickly, so we recommend completing your order soon to ensure availability!
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
      <td style="background-color: #065f46; padding: 30px; text-align: center;">
        <p style="color: #d1fae5; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #a7f3d0; font-size: 12px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
    '[
      {"key": "first_name", "label": "Customer First Name", "example": "Sarah"},
      {"key": "item_count", "label": "Number of Items", "example": "3"},
      {"key": "cart_total", "label": "Cart Total", "example": "$45.97"},
      {"key": "cart_items_html", "label": "Cart Items HTML", "example": "<p>Cherry Tomato Seedling x2 - $12.99</p>"},
      {"key": "checkout_url", "label": "Shop URL", "example": "https://deux.atlurbanfarms.com/shop"}
    ]'::jsonb,
    true
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- 6. pg_cron + pg_net for hourly reminders
-- ============================================
-- NOTE: pg_cron and pg_net must be enabled in Supabase Dashboard > Database > Extensions.
-- If these extensions are not available on your plan, set up a cron job externally
-- (e.g., via n8n or Supabase Dashboard SQL scheduler) to call:
--   POST https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/abandoned-cart-reminder
--
-- Uncomment below once extensions are enabled:

-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--     'abandoned-cart-reminder',
--     '30 * * * *',
--     $$
--     SELECT net.http_post(
--         url := 'https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/abandoned-cart-reminder',
--         headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"}'::jsonb,
--         body := '{}'::jsonb
--     );
--     $$
-- );
