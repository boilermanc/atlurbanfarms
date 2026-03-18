-- Migration: Patch order confirmation template with discount, shipping, and note variables
-- Date: 2026-03-17
-- Uses REPLACE() for targeted edits to preserve Sheree's custom template design.
-- NEVER use SET html_content = ... on templates customized via the admin UI.

-- 1. Replace hardcoded Shipping row with {{shipping_row}} (hidden for pickup orders)
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  '<tr>
                      <td style="padding:4px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Shipping</td>
                      <td align="right" style="padding:4px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">{{shipping_cost}}</td>
                    </tr>',
  '{{shipping_row}}'
),
updated_at = NOW()
WHERE template_key = 'order_confirmation';

-- 2. Add {{discount_row}} between Subtotal and Tax rows
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  '{{subtotal}}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Tax</td>',
  '{{subtotal}}</td>
                    </tr>
                    {{discount_row}}
                    <tr>
                      <td style="padding:8px 0;font-size:15px;font-family:Arial,Helvetica,sans-serif;color:#333333;">Tax</td>'
),
updated_at = NOW()
WHERE template_key = 'order_confirmation';

-- 3. Add {{shipping_note_block}} after {{DELIVERY_BLOCK}}
UPDATE email_templates
SET html_content = REPLACE(
  html_content,
  '{{DELIVERY_BLOCK}}
        <!-- ═══════════════════════════════════════════════════════════ -->',
  '{{DELIVERY_BLOCK}}
        {{shipping_note_block}}
        <!-- ═══════════════════════════════════════════════════════════ -->'
),
updated_at = NOW()
WHERE template_key = 'order_confirmation';
