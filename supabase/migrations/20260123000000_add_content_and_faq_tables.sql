-- Create content_pages table for static content like Terms, Privacy, etc.
CREATE TABLE IF NOT EXISTS content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index on slug for fast lookups
CREATE INDEX idx_content_pages_slug ON content_pages(slug);

-- Enable RLS
ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active content pages
CREATE POLICY "Anyone can view active content pages"
  ON content_pages
  FOR SELECT
  USING (is_active = true);

-- Policy: Authenticated users with admin role can manage content pages
CREATE POLICY "Admins can manage content pages"
  ON content_pages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Insert default content pages
INSERT INTO content_pages (slug, title, content, is_active) VALUES
  ('terms', 'Terms of Service', '# Terms of Service

## 1. Introduction

Welcome to ATL Urban Farms. By accessing our website and purchasing our products, you agree to be bound by these Terms of Service.

## 2. Products and Services

We offer locally grown produce and farm products. Product availability may vary based on season and growing conditions.

## 3. Orders and Payment

All orders are subject to availability. We accept major credit cards and other payment methods as displayed at checkout.

## 4. Delivery and Pickup

Delivery schedules and pickup locations are subject to change. We will notify you of any changes to your scheduled delivery.

## 5. Returns and Refunds

Please refer to our Returns Policy for information about returns and refunds.

## 6. Contact Us

If you have questions about these Terms, please contact us.', true),

  ('privacy', 'Privacy Policy', '# Privacy Policy

## Information We Collect

We collect information you provide directly to us, such as:
- Name and contact information
- Delivery address
- Payment information
- Order history

## How We Use Your Information

We use your information to:
- Process and fulfill your orders
- Communicate about your orders and deliveries
- Send promotional communications (with your consent)
- Improve our services

## Data Security

We implement appropriate security measures to protect your personal information.

## Your Rights

You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.

## Contact Us

For privacy-related questions, please contact us.', true),

  ('shipping', 'Shipping & Delivery', '# Shipping & Delivery

## Delivery Areas

We currently deliver to the greater Atlanta metropolitan area. Check our delivery zone map for specific coverage areas.

## Delivery Schedule

- **Weekly Deliveries**: Orders placed by Wednesday midnight are delivered the following week
- **Delivery Windows**: Morning (8am-12pm) or Afternoon (12pm-6pm)
- **Delivery Days**: Vary by zone - check your address for available days

## Local Pickup

Free pickup is available at our farm location and select partner locations. See pickup locations in your account.

## Delivery Fees

- Orders over $50: Free delivery
- Orders under $50: $5 delivery fee

## Handling Fresh Produce

Our produce is harvested fresh for your delivery. Please refrigerate perishable items promptly upon receipt.', true),

  ('returns', 'Returns & Refunds', '# Returns & Refunds

## Our Satisfaction Guarantee

We stand behind the quality of our produce. If you''re not satisfied with any item, please contact us within 48 hours of delivery.

## How to Request a Refund

1. Contact our support team with your order number
2. Describe the issue with your order
3. Include photos if applicable

## Refund Process

- Refunds are processed within 3-5 business days
- Credits are applied to your original payment method
- Store credit is available as an alternative

## Items Not Eligible for Return

Due to the perishable nature of our products, we cannot accept physical returns. However, we will issue refunds or credits for quality issues.

## Contact Us

For return or refund requests, please contact our customer service team.', true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_pages_updated_at
  BEFORE UPDATE ON content_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_content_pages_updated_at();


-- Create faqs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for sorting
CREATE INDEX idx_faqs_sort_order ON faqs(sort_order);
CREATE INDEX idx_faqs_category ON faqs(category);

-- Enable RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active FAQs
CREATE POLICY "Anyone can view active FAQs"
  ON faqs
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can manage FAQs
CREATE POLICY "Admins can manage FAQs"
  ON faqs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Insert some default FAQs
INSERT INTO faqs (question, answer, category, sort_order, is_active) VALUES
  ('How do I place an order?', 'Browse our products, add items to your cart, and proceed to checkout. You can choose delivery or local pickup at checkout.', 'Orders', 1, true),
  ('What areas do you deliver to?', 'We deliver to the greater Atlanta metropolitan area. Enter your address at checkout to see if we deliver to your location.', 'Delivery', 2, true),
  ('When will my order arrive?', 'Orders placed by Wednesday midnight are delivered the following week. You''ll receive a notification with your specific delivery window.', 'Delivery', 3, true),
  ('How is the produce kept fresh during delivery?', 'We use insulated packaging and cold packs for temperature-sensitive items. Our local delivery ensures produce reaches you within hours of harvest.', 'Delivery', 4, true),
  ('Can I modify or cancel my order?', 'You can modify or cancel your order up until Wednesday midnight before your scheduled delivery week. Contact us for changes after this deadline.', 'Orders', 5, true),
  ('What payment methods do you accept?', 'We accept all major credit cards, debit cards, and PayPal through our secure checkout.', 'Payment', 6, true),
  ('Do you offer subscriptions?', 'Yes! Our subscription boxes are delivered weekly or bi-weekly with a curated selection of seasonal produce. Manage your subscription in your account.', 'Subscriptions', 7, true),
  ('What if an item is out of stock?', 'If an item becomes unavailable, we''ll notify you and either substitute a similar item (with your permission) or issue a refund for that item.', 'Orders', 8, true);

-- Create trigger for FAQs updated_at
CREATE OR REPLACE FUNCTION update_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_faqs_updated_at();
