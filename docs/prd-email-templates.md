# PRD: Email Templates Admin System
## ATL Urban Farms E-Commerce Platform

**Version:** 1.0  
**Date:** January 2025  
**Status:** Ready for Development

---

## 1. Overview

### 1.1 Problem Statement
Email templates are currently hardcoded in the `resend-send-email` Edge Function (lines 16-193). Any changes to email content, styling, or structure require:
- Editing TypeScript code
- Redeploying the Edge Function
- Technical knowledge of the codebase

This creates a bottleneck where the business owner (Sheree) cannot customize customer communications without developer involvement.

### 1.2 Solution
Build an Email Templates section in the admin panel that allows:
- Viewing and editing all email templates through a web interface
- Live preview of email HTML
- Storing templates in the database
- Dynamic variable insertion for personalization
- Test email functionality before going live

### 1.3 Success Metrics
- Zero code deploys required for email content changes
- Template changes reflected immediately in outgoing emails
- Business owner can independently manage email communications

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US1 | Admin | View all email templates in one place | I can see what emails the system sends |
| US2 | Admin | Edit email HTML and subject lines | I can customize messaging without code |
| US3 | Admin | Preview emails before saving | I can verify they look correct |
| US4 | Admin | Insert dynamic variables easily | I don't need to remember placeholder syntax |
| US5 | Admin | Send test emails to myself | I can verify emails work in real inboxes |
| US6 | Admin | Revert to previous versions | I can undo mistakes |
| US7 | Admin | Set global brand elements | I maintain consistency across all emails |

---

## 3. Functional Requirements

### 3.1 Template Types

| Template Key | Name | Trigger | Required Variables |
|--------------|------|---------|-------------------|
| `order_confirmation` | Order Confirmation | After successful checkout | customer_name, order_id, order_items, order_total, order_date |
| `shipping_notification` | Shipping Update | When tracking number added | customer_name, order_id, tracking_number, carrier, tracking_url |
| `welcome` | Welcome Email | New account creation | customer_name, login_url |
| `password_reset` | Password Reset | Reset request | customer_name, reset_url, expiry_time |
| `order_ready_pickup` | Ready for Pickup | Order marked ready | customer_name, order_id, pickup_location, pickup_hours |

### 3.2 Template Editor Features

#### 3.2.1 Editor Modes
- **Visual Mode**: Rich text editor for basic formatting (bold, italic, links, images)
- **HTML Mode**: Syntax-highlighted code editor for advanced customization
- Toggle between modes without losing content

#### 3.2.2 Variable System
Available variables per template (displayed in a sidebar picker):

```
Global Variables (all templates):
{{business_name}}        → "ATL Urban Farms"
{{business_email}}       → "hello@atlurbanfarms.com"
{{business_phone}}       → "(404) 555-1234"
{{business_address}}     → Full address
{{logo_url}}             → Logo image URL
{{current_year}}         → "2025"
{{unsubscribe_url}}      → Unsubscribe link

Customer Variables:
{{customer_name}}        → "John Smith"
{{customer_first_name}}  → "John"
{{customer_email}}       → "john@example.com"

Order Variables:
{{order_id}}             → "ORD-2025-001234"
{{order_date}}           → "January 22, 2025"
{{order_total}}          → "$47.99"
{{order_items}}          → HTML table of line items
{{order_subtotal}}       → "$42.99"
{{order_shipping}}       → "$5.00"
{{order_tax}}            → "$0.00"

Shipping Variables:
{{tracking_number}}      → "1Z999AA10123456784"
{{carrier}}              → "UPS"
{{tracking_url}}         → Full tracking link
{{estimated_delivery}}   → "January 25, 2025"

Pickup Variables:
{{pickup_location}}      → "ATL Urban Farms - Westside"
{{pickup_address}}       → Full pickup address
{{pickup_hours}}         → "Mon-Sat 9am-5pm"
{{pickup_instructions}}  → Custom instructions
```

#### 3.2.3 Preview Panel
- Real-time preview updates as user types
- Desktop/Mobile view toggle (600px vs 375px width)
- Sample data auto-populated for preview
- Option to enter custom preview data

#### 3.2.4 Test Email
- "Send Test" button on each template
- Modal to enter recipient email address
- Uses sample/preview data for test send
- Shows success/error feedback

### 3.3 Global Brand Settings

Separate settings panel for brand elements used across all templates:

| Setting | Type | Description |
|---------|------|-------------|
| Logo URL | URL input | Primary logo for email header |
| Primary Color | Color picker | Brand color (hex) |
| Secondary Color | Color picker | Accent color (hex) |
| Footer Text | Textarea | Copyright, address, etc. |
| Social Links | URL inputs | Facebook, Instagram, etc. |

### 3.4 Version History

- Auto-save creates version on each save
- List of previous versions with timestamps
- Preview any historical version
- "Restore" button to revert to previous version
- Keep last 10 versions per template

---

## 4. Technical Specification

### 4.1 Database Schema

#### New Table: `email_templates`

```sql
CREATE TABLE email_templates (
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
CREATE INDEX idx_email_templates_key ON email_templates(template_key);

-- RLS Policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Admin full access (assuming admin role check)
CREATE POLICY "Admin full access to email_templates"
  ON email_templates
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Edge functions can read templates
CREATE POLICY "Service role can read email_templates"
  ON email_templates
  FOR SELECT
  USING (true);
```

#### New Table: `email_template_versions`

```sql
CREATE TABLE email_template_versions (
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
CREATE INDEX idx_template_versions_template ON email_template_versions(template_id, version_number DESC);
```

#### New Table: `email_brand_settings`

```sql
CREATE TABLE email_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'text',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default brand settings
INSERT INTO email_brand_settings (setting_key, setting_value, setting_type) VALUES
  ('logo_url', '', 'url'),
  ('primary_color', '#2D5A27', 'color'),
  ('secondary_color', '#8B9D83', 'color'),
  ('footer_text', '© {{current_year}} ATL Urban Farms. All rights reserved.', 'textarea'),
  ('facebook_url', '', 'url'),
  ('instagram_url', '', 'url'),
  ('business_name', 'ATL Urban Farms', 'text'),
  ('business_email', 'hello@atlurbanfarms.com', 'email'),
  ('business_phone', '', 'text'),
  ('business_address', 'Atlanta, GA', 'textarea');
```

### 4.2 Edge Function Updates

Modify `resend-send-email` to:

1. **Fetch template from database** instead of using hardcoded HTML
2. **Fetch brand settings** for global variables
3. **Replace variables** using a template engine approach
4. **Fallback to defaults** if database template not found

```typescript
// Pseudocode for updated Edge Function

async function getEmailTemplate(templateKey: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    // Return hardcoded fallback
    return getDefaultTemplate(templateKey);
  }
  
  return data;
}

async function getBrandSettings(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('email_brand_settings')
    .select('setting_key, setting_value');
  
  return Object.fromEntries(data.map(s => [s.setting_key, s.setting_value]));
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}
```

### 4.3 Admin Panel Components

#### File Structure
```
src/
├── pages/
│   └── admin/
│       └── EmailTemplates/
│           ├── index.tsx              # Template list view
│           ├── EmailTemplateEditor.tsx # Edit single template
│           ├── EmailPreview.tsx        # Preview component
│           ├── VariablePicker.tsx      # Variable insertion sidebar
│           ├── BrandSettings.tsx       # Global brand settings
│           └── VersionHistory.tsx      # Version history modal
├── components/
│   └── email/
│       ├── HtmlEditor.tsx             # Code editor component
│       └── TestEmailModal.tsx         # Test send modal
└── hooks/
    └── useEmailTemplates.ts           # Data fetching hooks
```

#### Component Specifications

**EmailTemplatesList (index.tsx)**
- Grid of template cards
- Each card shows: name, description, last updated, status badge
- Click card → navigate to editor
- Quick actions: activate/deactivate, duplicate

**EmailTemplateEditor**
- Top bar: Template name, Save button, Send Test button
- Left panel: Subject line input, HTML editor (with mode toggle)
- Right panel: Live preview (desktop/mobile toggle)
- Bottom drawer: Variable picker

**VariablePicker**
- Categorized list of available variables
- Click to insert at cursor position
- Shows description on hover
- Filters based on template type

**EmailPreview**
- iframe-based preview for accurate rendering
- Device frame visualization
- Refresh button to re-render

### 4.4 API Endpoints

Using Supabase client directly (no custom endpoints needed):

| Operation | Method | Table |
|-----------|--------|-------|
| List templates | SELECT | email_templates |
| Get template | SELECT | email_templates |
| Update template | UPDATE | email_templates |
| Create version | INSERT | email_template_versions |
| List versions | SELECT | email_template_versions |
| Get brand settings | SELECT | email_brand_settings |
| Update brand setting | UPDATE | email_brand_settings |

### 4.5 Test Email Endpoint

Create new Edge Function: `send-test-email`

```typescript
// Request body
{
  template_key: string,
  recipient_email: string,
  preview_data?: Record<string, string>  // Optional custom data
}

// Response
{
  success: boolean,
  message_id?: string,
  error?: string
}
```

---

## 5. UI/UX Design

### 5.1 Template List View

```
┌─────────────────────────────────────────────────────────────────┐
│ Email Templates                              [Brand Settings ⚙️] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 📧          │  │ 📦          │  │ 👋          │             │
│  │ Order       │  │ Shipping    │  │ Welcome     │             │
│  │ Confirmation│  │ Update      │  │ Email       │             │
│  │             │  │             │  │             │             │
│  │ ✅ Active   │  │ ✅ Active   │  │ ✅ Active   │             │
│  │ Updated 2d  │  │ Updated 5d  │  │ Updated 1w  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ 🔑          │  │ 📍          │                              │
│  │ Password    │  │ Ready for   │                              │
│  │ Reset       │  │ Pickup      │                              │
│  │             │  │             │                              │
│  │ ✅ Active   │  │ ⚪ Inactive │                              │
│  │ Updated 2w  │  │ Not setup   │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Template Editor View

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back    Order Confirmation              [Send Test] [Save ✓] │
├─────────────────────────────────────────────────────────────────┤
│ Subject: Your ATL Urban Farms Order #{{order_id}} is Confirmed │
├───────────────────────────────┬─────────────────────────────────┤
│ [Visual] [HTML]               │ Preview        [🖥️] [📱]       │
│                               │                                 │
│ <!DOCTYPE html>               │ ┌─────────────────────────┐    │
│ <html>                        │ │    🌱 ATL Urban Farms   │    │
│ <head>                        │ │                         │    │
│   <style>                     │ │ Hi John,                │    │
│     .header {                 │ │                         │    │
│       background: #2D5A27;    │ │ Thank you for your      │    │
│     }                         │ │ order #ORD-2025-001234! │    │
│   </style>                    │ │                         │    │
│ </head>                       │ │ ┌─────────────────────┐ │    │
│ <body>                        │ │ │ Tomato Seedling x2  │ │    │
│   <div class="header">        │ │ │ Basil Seedling x1   │ │    │
│     {{logo}}                  │ │ └─────────────────────┘ │    │
│   </div>                      │ │                         │    │
│   <p>Hi {{customer_name}},    │ │ Total: $47.99           │    │
│ ...                           │ │                         │    │
│                               │ └─────────────────────────┘    │
├───────────────────────────────┴─────────────────────────────────┤
│ Variables (click to insert)                    [Version History]│
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│ │{{customer_  │ │{{order_id}} │ │{{order_     │ │              │
│ │name}}       │ │             │ │total}}      │ │ ...          │
│ └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Default Templates

Seed the database with professionally designed default templates for each type. These should:

- Use ATL Urban Farms branding (green color scheme)
- Include plant/garden imagery where appropriate
- Be mobile-responsive
- Follow email best practices (600px max width, inline CSS)

See Appendix A for default HTML templates.

---

## 7. Implementation Plan

### Phase 1: Foundation (This Sprint)
1. ✅ Create database schema (migrations)
2. ✅ Seed default templates
3. ✅ Update Edge Function to read from database
4. ✅ Basic admin list view
5. ✅ Basic editor with HTML mode
6. ✅ Live preview

### Phase 2: Enhanced Editing
1. Variable picker component
2. Visual/WYSIWYG mode
3. Mobile preview toggle
4. Send test email

### Phase 3: Advanced Features
1. Version history
2. Brand settings panel
3. Plain text auto-generation
4. Template duplication

---

## 8. Testing Requirements

### 8.1 Unit Tests
- Variable replacement function
- Template validation
- HTML sanitization

### 8.2 Integration Tests
- Save template → verify database update
- Edit template → verify Edge Function uses new content
- Send test email → verify delivery

### 8.3 Manual Testing Checklist
- [ ] Create new template
- [ ] Edit existing template
- [ ] Preview updates in real-time
- [ ] Variables render correctly in preview
- [ ] Variables render correctly in sent email
- [ ] Mobile preview shows responsive layout
- [ ] Test email delivers successfully
- [ ] Version history shows changes
- [ ] Restore previous version works
- [ ] Brand settings apply to all templates

---

## 9. Security Considerations

- **Input Sanitization**: Sanitize HTML to prevent XSS (allow safe email tags only)
- **Access Control**: Only admin users can edit templates (RLS policies)
- **Audit Trail**: Version history provides accountability
- **Rate Limiting**: Test email endpoint should be rate-limited

---

## 10. Future Enhancements (Out of Scope)

- Drag-and-drop email builder
- A/B testing for subject lines
- Email analytics (open rates, click rates)
- Scheduled sends
- Multi-language templates
- AI-powered subject line suggestions

---

## Appendix A: Default Template HTML

### Order Confirmation Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: #2D5A27; padding: 20px; text-align: center;">
        <img src="{{logo_url}}" alt="{{business_name}}" style="max-width: 200px; height: auto;">
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h1 style="color: #2D5A27; margin: 0 0 20px; font-size: 24px;">Thank You for Your Order!</h1>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Hi {{customer_first_name}},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          We've received your order and are getting your plants ready with care. Here's a summary of what you ordered:
        </p>
        
        <!-- Order Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                <strong>Order Number:</strong> {{order_id}}<br>
                <strong>Order Date:</strong> {{order_date}}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Order Items -->
        {{order_items}}
        
        <!-- Order Total -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 2px solid #2D5A27; margin-top: 20px; padding-top: 20px;">
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
            <td style="text-align: right; padding: 10px 0;">
              <span style="color: #2D5A27; font-size: 18px; font-weight: bold;">Total:</span>
              <span style="color: #2D5A27; font-size: 18px; font-weight: bold; margin-left: 20px;">{{order_total}}</span>
            </td>
          </tr>
        </table>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5; margin-top: 30px;">
          We'll send you another email when your order ships. If you have any questions, just reply to this email!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Happy growing! 🌱<br>
          <strong>The ATL Urban Farms Team</strong>
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #2D5A27; padding: 30px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">
          {{business_address}}
        </p>
        <p style="color: #ffffff; font-size: 14px; margin: 0;">
          {{footer_text}}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Appendix B: Sample Preview Data

```json
{
  "customer_name": "John Smith",
  "customer_first_name": "John",
  "customer_email": "john@example.com",
  "order_id": "ORD-2025-001234",
  "order_date": "January 22, 2025",
  "order_total": "$47.99",
  "order_subtotal": "$42.99",
  "order_shipping": "$5.00",
  "order_tax": "$0.00",
  "order_items": "<table>...</table>",
  "tracking_number": "1Z999AA10123456784",
  "carrier": "UPS",
  "tracking_url": "https://ups.com/track?num=1Z999AA10123456784",
  "business_name": "ATL Urban Farms",
  "business_email": "hello@atlurbanfarms.com",
  "logo_url": "https://atlurbanfarms.com/logo.png",
  "current_year": "2025"
}
```
