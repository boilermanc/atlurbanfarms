-- Add growing_interest_options table for managing plant interest categories.
-- Referenced by customer profiles on the storefront and admin panel.

CREATE TABLE IF NOT EXISTS growing_interest_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE growing_interest_options ENABLE ROW LEVEL SECURITY;

-- Anyone can read (storefront ProfileSettings needs this)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growing_interest_options' AND policyname = 'Public read growing_interest_options') THEN
    CREATE POLICY "Public read growing_interest_options" ON growing_interest_options
      FOR SELECT USING (true);
  END IF;
END $$;

-- Only admins can insert/update/delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growing_interest_options' AND policyname = 'Admins manage growing_interest_options') THEN
    CREATE POLICY "Admins manage growing_interest_options" ON growing_interest_options
      FOR ALL USING (
        EXISTS (SELECT 1 FROM customers WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Seed default interests (superset of all values used across codebase)
INSERT INTO growing_interest_options (label, value, sort_order) VALUES
  ('Vegetables', 'vegetables', 1),
  ('Herbs', 'herbs', 2),
  ('Fruits', 'fruits', 3),
  ('Flowers', 'flowers', 4),
  ('Microgreens', 'microgreens', 5),
  ('Mushrooms', 'mushrooms', 6),
  ('Native Plants', 'native_plants', 7),
  ('Succulents', 'succulents', 8)
ON CONFLICT (value) DO NOTHING;
