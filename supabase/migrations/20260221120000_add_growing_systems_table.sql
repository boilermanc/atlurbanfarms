-- Add growing_systems table for managing hydroponic/aeroponic system types.
-- Referenced by customer profiles, checkout, reviews, and account profile.

CREATE TABLE IF NOT EXISTS growing_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  website_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE growing_systems ENABLE ROW LEVEL SECURITY;

-- Anyone can read active growing systems (storefront, checkout, etc.)
CREATE POLICY "Public read growing_systems" ON growing_systems
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins manage growing_systems" ON growing_systems
  FOR ALL USING (
    EXISTS (SELECT 1 FROM customers WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default systems
INSERT INTO growing_systems (name, slug, sort_order) VALUES
  ('Tower Garden', 'tower-garden', 1),
  ('Aerospring', 'aerospring', 2),
  ('Lettuce Grow', 'lettuce-grow', 3),
  ('Gardyn', 'gardyn', 4),
  ('DIY', 'diy', 5),
  ('Other', 'other', 99)
ON CONFLICT (name) DO NOTHING;
