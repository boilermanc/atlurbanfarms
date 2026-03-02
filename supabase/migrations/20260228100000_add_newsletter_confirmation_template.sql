-- Migration: Add newsletter confirmation email template
-- Description: Inserts the newsletter_confirmation template into the database
--              so it appears in the admin Email Templates page
-- Date: 2026-02-28

INSERT INTO email_templates (template_key, name, description, category, subject_line, html_content, variables_schema, is_active) VALUES
(
  'newsletter_confirmation',
  'Newsletter Confirmation',
  'Sent when someone signs up for the newsletter to confirm their email address',
  'marketing',
  'Confirm your ATL Urban Farms newsletter subscription',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Newsletter Subscription</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #10b981; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Almost There!</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi {{first_name}},
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Thanks for signing up for the ATL Urban Farms newsletter! Please confirm your email address by clicking the button below:
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
          <tr>
            <td style="text-align: center;">
              <a href="{{confirmation_url}}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Confirm My Subscription</a>
            </td>
          </tr>
        </table>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;">
          This link expires in 48 hours. If you didn''t sign up for our newsletter, you can safely ignore this email.
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
    {"key": "first_name", "label": "Subscriber First Name", "example": "John"},
    {"key": "confirmation_url", "label": "Confirmation URL", "example": "https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/newsletter-confirm?token=abc123"}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;
