-- Update shipping_notification email template with new branded design
-- This replaces the basic template with the new ATL Urban Farms branded layout

UPDATE email_templates
SET
  subject_line = 'Your ATL Urban Farms Order #{{order_number}} Has Shipped!',
  html_content = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Shipping Update - ATL Urban Farms</title>
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width: 620px) {
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="width:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;background-color:#f0f1f5;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f0f1f5" style="background-color:#f0f1f5;">
  <tr>
    <td align="center" style="padding:20px 0;">
      <!--[if mso]>
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"><tr><td>
      <![endif]-->

      <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background-color:#ffffff;">

        <!-- HEADER LOGO -->
        <tr>
          <td style="padding:20px 20px 10px 20px;">
            <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/ec1c78feb99eb98bb471df553097a8e8.png" width="560" alt="ATL Urban Farms" style="display:block;width:100%;height:auto;max-width:560px;border:0;">
          </td>
        </tr>

        <!-- HERO IMAGE -->
        <tr>
          <td>
            <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/1c30439caee63237bc4eef94cb33a4b2.jpg" width="600" alt="Fresh from the farm" style="display:block;width:100%;height:auto;max-width:600px;border:0;">
          </td>
        </tr>

        <!-- TRACK ORDER BUTTON -->
        <tr>
          <td style="padding:24px 20px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" style="background-color:#1079bf;border-radius:50px;mso-padding-alt:12px 40px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{tracking_url}}" style="height:44px;v-text-anchor:middle;width:213px;" arcsize="50%" strokecolor="#1079bf" fillcolor="#1079bf">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;letter-spacing:0.2em;">TRACK ORDER</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="{{tracking_url}}" target="_blank" style="display:inline-block;padding:12px 40px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2em;line-height:1.4;">TRACK ORDER</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CARD DIVIDER -->
        <tr>
          <td style="padding:0;background-color:#f0f1f5;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background-color:#ffffff;height:20px;border-bottom-left-radius:8px;border-bottom-right-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="background-color:#f0f1f5;height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="background-color:#ffffff;height:20px;border-top-left-radius:8px;border-top-right-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- ORDER INFO -->
        <tr>
          <td style="padding:10px 20px 6px;background-color:#ffffff;">
            <span style="font-size:21px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#000000;line-height:1.2;">Order #{{order_number}}</span><br>
            <span style="font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;line-height:1.4;">Placed on {{order_date}}</span>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:16px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- EXPECTED DELIVERY & STATUS -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1079bf;border-radius:15px;background-color:#fffafd;border-collapse:separate;">
              <tr>
                <td width="50%" style="padding:14px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;letter-spacing:-0.025em;line-height:1.3;">
                  Expected: <strong>{{estimated_delivery}}</strong>
                </td>
                <td width="50%" style="padding:14px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#000000;letter-spacing:-0.025em;line-height:1.3;">
                  Status: <strong>{{status}}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- PROGRESS TIMELINE -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            {{progress_bar}}
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:20px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ORDER DETAILS (Orange Box) -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ff4500;border-radius:15px;border-collapse:separate;">
              <tr>
                <td class="mobile-stack" width="50%" valign="top" style="padding:30px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#fffafd;line-height:1.5;">
                  <span style="font-weight:400;">Item/s in your order:</span><br><br>
                  <span style="font-weight:700;">{{order_items}}</span>
                </td>
                <td class="mobile-stack" width="50%" valign="top" style="padding:30px 20px;font-size:16px;font-family:Arial,Helvetica,sans-serif;color:#fffafd;line-height:1.5;">
                  <span style="font-weight:400;">Delivery details:</span><br><br>
                  <span style="font-weight:700;">{{customer_name}}<br>{{shipping_address}}</span>
                  <br><br>
                  <span style="font-weight:400;">Contact:</span><br><br>
                  <span style="font-weight:700;"><a href="tel:{{customer_phone}}" style="color:#fffafd;text-decoration:none;">{{customer_phone}}</a><br><a href="mailto:{{customer_email}}" style="color:#fffafd;text-decoration:none;">{{customer_email}}</a></span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CARD DIVIDER -->
        <tr>
          <td style="padding:0;background-color:#f0f1f5;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background-color:#ffffff;height:20px;border-bottom-left-radius:8px;border-bottom-right-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="background-color:#f0f1f5;height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="background-color:#ffffff;height:20px;border-top-left-radius:8px;border-top-right-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- SEEDLINGS IMAGE -->
        <tr>
          <td style="padding:16px 20px;background-color:#ffffff;">
            <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/ea03f5bcb74780176c41a6d5d727c4de.jpg" width="560" alt="ATL Urban Farms seedlings" style="display:block;width:100%;height:auto;max-width:560px;border:0;border-radius:15px;">
          </td>
        </tr>

        <!-- SPACER -->
        <tr><td style="height:8px;background-color:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- SUPPORT BOX (Blue) -->
        <tr>
          <td style="padding:0 20px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1079bf;border-radius:15px;border-collapse:separate;">
              <tr>
                <td style="padding:30px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#fffafd;">
                  <span style="font-weight:700;font-size:16px;">Seedling emergency? Order hiccup?</span><br>
                  <span style="font-size:16px;">Drop us a line and we''''ll nip any problems.</span>
                  <br><br>
                  <a href="tel:{{business_phone}}" target="_blank" style="color:#fffafd;text-decoration:none;font-size:18px;font-weight:700;letter-spacing:0.1em;font-family:Arial,Helvetica,sans-serif;">{{business_phone}}</a>
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
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/f29e3b9ad367f1a8f82714e5f732ffdb.png" width="25" height="25" alt="Facebook" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="{{instagram_url}}" target="_blank" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/f36d90288f1f9862f14a20edd91add5b.png" width="24" height="25" alt="Instagram" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="https://www.atlurbanfarms.com" target="_blank" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/bc2a7c34405156c669640167bb6748f4.png" width="30" height="31" alt="Website" style="display:block;border:0;">
                  </a>
                </td>
                <td style="padding:5px 10px;">
                  <a href="mailto:{{business_email}}" style="text-decoration:none;">
                    <img src="https://povudgtvzggnxwgtjexa.supabase.co/storage/v1/object/public/email-assets/578ad75fa763ee916391600996710372.png" width="23" height="18" alt="Email" style="display:block;border:0;">
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
            You''''re receiving this email because you placed an order with ATL Urban Farms.
          </td>
        </tr>

      </table>

      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>

</body>
</html>',
  variables_schema = '[
    {"key": "customer_name", "label": "Customer Full Name", "example": "John Smith"},
    {"key": "customer_first_name", "label": "Customer First Name", "example": "John"},
    {"key": "customer_email", "label": "Customer Email", "example": "john@example.com"},
    {"key": "customer_phone", "label": "Customer Phone", "example": "(404) 555-9876"},
    {"key": "order_number", "label": "Order Number", "example": "ORD-2026-001234"},
    {"key": "order_date", "label": "Order Date", "example": "Friday, January 24"},
    {"key": "order_items", "label": "Order Items (stacked lines)", "example": "2 x Tomato Seedling<br>1 x Basil Seedling"},
    {"key": "tracking_number", "label": "Tracking Number", "example": "1Z999AA10123456784"},
    {"key": "carrier", "label": "Shipping Carrier", "example": "UPS"},
    {"key": "tracking_url", "label": "Tracking URL", "example": "https://www.ups.com/track?tracknum=1Z999AA10123456784"},
    {"key": "estimated_delivery", "label": "Estimated Delivery Date", "example": "Friday, January 24th"},
    {"key": "shipping_address", "label": "Shipping Address (HTML)", "example": "123 Garden St<br>Atlanta, GA 30318"},
    {"key": "status", "label": "Shipping Status", "example": "Shipped"},
    {"key": "progress_bar", "label": "Progress Bar (auto-generated HTML)", "example": ""}
  ]'::jsonb,
  updated_at = now()
WHERE template_key = 'shipping_notification';

-- Also update the business_phone brand setting if it is empty
UPDATE email_brand_settings
SET setting_value = '770.678.6552'
WHERE setting_key = 'business_phone'
  AND (setting_value IS NULL OR setting_value = '');
