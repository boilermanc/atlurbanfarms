-- Migration: Add gift card row, customer details block to order confirmation email
-- Ref: https://github.com/boilermanc/atlurbanfarms/issues/57
-- Adds:
--   {{gift_card_row}}        — after {{discount_row}} in totals table
--   {{customer_details_block}} — after {{DELIVERY_BLOCK}} / {{shipping_note_block}}
--
-- IMPORTANT: Uses REPLACE() to avoid overwriting the template (per project convention).

-- 1. Add gift card row after discount row in the totals section
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  '{{discount_row}}
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Tax</td>',
  '{{discount_row}}
                    {{gift_card_row}}
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Tax</td>'
),
variables_schema = variables_schema || '[
  {"key": "gift_card_row", "label": "Gift Card Row (HTML, empty if no gift card)", "example": "<tr>...</tr>"},
  {"key": "customer_details_block", "label": "Customer Details Block (email, phone, notes)", "example": "<tr>...</tr>"}
]'::jsonb,
updated_at = NOW()
WHERE template_key = 'order_confirmation';

-- 2. Add customer details block after shipping_note_block
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  '{{shipping_note_block}}
        <!-- ═══════════════════════════════════════════════════════════ -->',
  '{{shipping_note_block}}
        {{customer_details_block}}
        <!-- ═══════════════════════════════════════════════════════════ -->'
),
updated_at = NOW()
WHERE template_key = 'order_confirmation';
