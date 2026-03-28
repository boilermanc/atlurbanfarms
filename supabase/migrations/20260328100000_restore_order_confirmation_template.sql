-- Restore Sheree's custom order confirmation template (version 24)
-- The template was overwritten by destructive SET html_content migrations (0309*).
-- This restores v24 from email_template_versions and splices in newer variables:
--   {{discount_row}}, {{shipping_note_block}}, {{account_cta}}
--
-- IMPORTANT: All future template migrations MUST use REPLACE(), never SET html_content.

UPDATE email_templates
SET html_content = $tpl$<!--
=======================================================================
  ORDER CONFIRMATION EMAIL — ATL Urban Farms
  For Clint: Resend implementation notes at the bottom of this file.
=======================================================================
-->

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Order Confirmed - ATL Urban Farms</title>
  <!--[if !mso]><!--><style>
    @media only screen and (max-width: 620px) {
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style><!--<![endif]-->
</head>
<body style="width:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;background-color:#f0f1f5;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f0f1f5" style="background-color:#f0f1f5;">
  <tr>
    <td align="center" style="padding:20px 0;">
      <!--[if mso]><table align="center" border="0" cellpadding="0" cellspacing="0" width="600"><tr><td><![endif]-->
      <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background-color:#ffffff;">

        <!-- HEADER LOGO -->
        <tr>
          <td style="padding:20px 20px 10px 20px;">
            <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/ATLemailbanner.png" width="560" alt="ATL Urban Farms" style="display:block;width:100%;height:auto;max-width:560px;border:0;">
          </td>
        </tr>

        <!-- HERO IMAGE -->
        <tr>
          <td>
            <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/thank.png" width="600" alt="Thank you for your order!" style="display:block;width:100%;height:auto;max-width:600px;border:0;">
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ORDER HEADING -->
        <tr>
          <td style="padding:10px 20px 6px;background-color:#ffffff;">
            <span style="font-size:24px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#000000;line-height:1.2;">Order #{{order_number}}</span><br><br>
            <span style="font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;line-height:1.4;">Hey {{customer_first_name}}! We have received your order. Thanks for supporting ATL!</span>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- STATUS BOX: order date + payment -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1079bf;border-radius:15px;background-color:#fffafd;border-collapse:separate;">
              <tr>
                <td width="50%" style="padding:14px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;letter-spacing:-0.025em;line-height:1.3;">
                  Order date: <strong>{{order_date}}</strong>
                </td>
                <td width="50%" style="padding:14px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;letter-spacing:-0.025em;line-height:1.3;">
                  Payment: <strong>{{payment_method}}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:30px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ITEMS ORDERED HEADER -->
        <tr>
          <td style="padding:0 20px 10px;background-color:#ffffff;">
            <span style="font-size:18px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#000000;">Items Ordered</span>
          </td>
        </tr>

        <!-- ITEMS LIST -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1079bf;border-radius:15px;background-color:#fffafd;border-collapse:separate;">
              <tr>
                <td style="padding:16px 20px;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#000000;line-height:1.6;">
                  {{order_items}}
                </td>
              </tr>
              <tr>
                <td style="padding:0 20px 6px;border-top:1px solid #ddeeff;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Subtotal</td>
                      <td align="right" style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">{{subtotal}}</td>
                    </tr>
                    {{discount_row}}
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Tax</td>
                      <td align="right" style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">{{order_tax}}</td>
                    </tr>
                    {{shipping_row}}
                    <tr>
                      <td style="padding:8px 0;font-size:17px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#000000;border-top:1px solid #1079bf;">Total</td>
                      <td align="right" style="padding:8px 0;font-size:17px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#1079bf;border-top:1px solid #1079bf;">{{order_total}}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:30px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!--  DELIVERY BLOCK — Clint replaces this entire <tr> with     -->
        <!--  either SHIP_BLOCK or PICKUP_BLOCK from the code below     -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        {{DELIVERY_BLOCK}}
        {{shipping_note_block}}
        <!-- ═══════════════════════════════════════════════════════════ -->

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- CTA BUTTON -->
        <tr>
          <td style="padding:24px 20px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" style="background-color:#8dc63f;border-radius:50px;mso-padding-alt:12px 40px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{order_url}}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="50%" strokecolor="#8dc63f" fillcolor="#8dc63f">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;letter-spacing:0.2em;">VIEW ORDER</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="{{order_url}}" target="_blank" style="display:inline-block;padding:12px 40px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2em;line-height:1.4;">VIEW ORDER</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- GUEST ACCOUNT CTA (hidden for logged-in customers) -->
        {{account_cta}}

        <!-- SPACER -->
        <tr><td style="height:10px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- SUPPORT BOX -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1079bf;border-radius:15px;border-collapse:separate;">
              <tr>
                <td style="padding:30px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#fffafd;">
                  <span style="font-weight:700;font-size:16px;">Questions about your order?</span><br>
                  <span style="font-size:16px;">Drop us a line. We can help!</span>
                  <br><br>
                  <a href="mailto:{{business_email}}" target="_blank" style="color:#fffafd;text-decoration:none;font-size:18px;font-weight:700;letter-spacing:0.1em;font-family:Arial,Helvetica,sans-serif;">{{business_email}}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- SOCIAL ICONS -->
        <tr>
          <td style="padding:10px 20px;background-color:#ffffff;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td style="padding:5px 10px;">
                  <a href="{{facebook_url}}" target="_blank" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/facebook%20icon.png" width="25" height="25" alt="Facebook" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="{{instagram_url}}" target="_blank" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/insta%20icon.png" width="25" height="25" alt="Instagram" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="https://www.atlurbanfarms.com" target="_blank" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/website%20icon.png" width="25" height="25" alt="Website" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="mailto:{{business_email}}" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/email%20icon.png" width="25" height="25" alt="Email" style="display:block;border:0;">
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:10px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:10px 20px 30px;background-color:#ffffff;text-align:center;font-size:13px;font-family:Arial,Helvetica,sans-serif;color:#666666;line-height:1.6;">
            {{footer_text}}<br>
            You're receiving this email because you placed an order with ATL Urban Farms.
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>$tpl$,
variables_schema = '[
  {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
  {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
  {"key": "order_date", "label": "Order Date", "example": "Friday, March 28, 2026"},
  {"key": "payment_method", "label": "Payment Method", "example": "Credit Card"},
  {"key": "order_items", "label": "Order Items (HTML)", "example": "<table>...</table>"},
  {"key": "subtotal", "label": "Subtotal", "example": "$42.99"},
  {"key": "discount_row", "label": "Discount Row (HTML, empty if no discount)", "example": "<tr>...</tr>"},
  {"key": "order_tax", "label": "Tax", "example": "$3.44"},
  {"key": "shipping_row", "label": "Shipping Row (HTML, hidden for pickup)", "example": "<tr>...</tr>"},
  {"key": "order_total", "label": "Order Total", "example": "$47.99"},
  {"key": "DELIVERY_BLOCK", "label": "Delivery Block (shipping address or pickup details)", "example": "<tr>...</tr>"},
  {"key": "shipping_note_block", "label": "Shipping Note (HTML, hidden for pickup)", "example": "<tr>...</tr>"},
  {"key": "order_url", "label": "View Order URL", "example": "https://atlurbanfarms.com/account/orders"},
  {"key": "account_cta", "label": "Guest Account Creation CTA (auto-generated)", "example": ""},
  {"key": "business_email", "label": "Business Email", "example": "info@atlurbanfarms.com"},
  {"key": "facebook_url", "label": "Facebook URL", "example": "https://facebook.com/atlurbanfarms"},
  {"key": "instagram_url", "label": "Instagram URL", "example": "https://instagram.com/atlurbanfarms"},
  {"key": "footer_text", "label": "Footer Text", "example": "© 2026 ATL Urban Farms"}
]'::jsonb,
updated_at = NOW()
WHERE template_key = 'order_confirmation';
