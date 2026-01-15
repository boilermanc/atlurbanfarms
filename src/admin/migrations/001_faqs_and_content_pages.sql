-- FAQs Table
-- Stores frequently asked questions with categories and ordering

CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Public can view active FAQs
CREATE POLICY "Public can view active faqs"
  ON faqs FOR SELECT USING (is_active = true);

-- Authenticated users with admin roles can manage FAQs
CREATE POLICY "Admins can manage faqs"
  ON faqs FOR ALL USING (auth.role() = 'authenticated');

-- Create index for sorting
CREATE INDEX idx_faqs_sort_order ON faqs(sort_order);
CREATE INDEX idx_faqs_category ON faqs(category);

-- Auto-update updated_at timestamp
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


-- Content Pages Table
-- Stores static content pages like Terms, Privacy, etc.

CREATE TABLE content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES customers(id)
);

-- Enable RLS
ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;

-- Public can view active content pages
CREATE POLICY "Public can view active content pages"
  ON content_pages FOR SELECT USING (is_active = true);

-- Authenticated users with admin roles can manage content pages
CREATE POLICY "Admins can manage content pages"
  ON content_pages FOR ALL USING (auth.role() = 'authenticated');

-- Create index for slug lookups
CREATE INDEX idx_content_pages_slug ON content_pages(slug);

-- Auto-update updated_at timestamp
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

-- Insert default content pages
INSERT INTO content_pages (slug, title, content) VALUES
  ('terms', 'Terms of Service', '# Terms of Service

Welcome to ATL Urban Farms. By using our services, you agree to these terms.

## 1. Acceptance of Terms

By accessing or using our website and services, you agree to be bound by these Terms of Service.

## 2. Use of Services

You agree to use our services only for lawful purposes and in accordance with these Terms.

## 3. Orders and Payment

All orders are subject to availability. Payment is required at the time of order.

## 4. Contact

For questions about these Terms, please contact us.'),
  ('privacy', 'Privacy Policy', '# Privacy Policy

Your privacy is important to us. This policy explains how we collect, use, and protect your information.

## Information We Collect

We collect information you provide directly to us, such as your name, email, and shipping address.

## How We Use Your Information

We use your information to process orders, communicate with you, and improve our services.

## Data Security

We implement appropriate security measures to protect your personal information.

## Contact

For questions about this Privacy Policy, please contact us.'),
  ('shipping', 'Shipping Policy', '# Shipping Policy

## Delivery Areas

We currently deliver to the greater Atlanta metropolitan area.

## Delivery Times

Orders are typically delivered within 2-3 business days of order placement.

## Shipping Costs

Shipping costs are calculated based on your delivery zone and order size.

## Delivery Instructions

Please ensure someone is available to receive your order, especially for perishable items.'),
  ('returns', 'Refund Policy', '# Refund Policy

## Our Guarantee

We stand behind the quality of our products. If you are not satisfied, please contact us.

## Eligible Returns

Due to the perishable nature of our products, refunds are handled on a case-by-case basis.

## How to Request a Refund

Contact us within 24 hours of delivery with photos of any quality issues.

## Processing Time

Approved refunds will be processed within 5-7 business days.');


-- Attribution Options Table
-- Stores "How did you hear about us?" options

CREATE TABLE IF NOT EXISTS attribution_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE attribution_options ENABLE ROW LEVEL SECURITY;

-- Public can view active attribution options
CREATE POLICY "Public can view active attribution options"
  ON attribution_options FOR SELECT USING (is_active = true);

-- Authenticated users with admin roles can manage attribution options
CREATE POLICY "Admins can manage attribution options"
  ON attribution_options FOR ALL USING (auth.role() = 'authenticated');

-- Create index for sorting
CREATE INDEX idx_attribution_options_sort_order ON attribution_options(sort_order);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_attribution_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attribution_options_updated_at
  BEFORE UPDATE ON attribution_options
  FOR EACH ROW
  EXECUTE FUNCTION update_attribution_options_updated_at();

-- Insert default attribution options
INSERT INTO attribution_options (label, value, sort_order) VALUES
  ('Search Engine (Google, etc.)', 'search_engine', 1),
  ('Social Media', 'social_media', 2),
  ('Friend or Family', 'word_of_mouth', 3),
  ('Local Farmers Market', 'farmers_market', 4),
  ('Newspaper/Magazine', 'print_media', 5),
  ('Other', 'other', 100);
