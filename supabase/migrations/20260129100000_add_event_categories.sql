-- Event Categories table for organizing events
CREATE TABLE IF NOT EXISTS event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#10b981', -- Tailwind emerald-500 as default
  icon text, -- Optional icon identifier (e.g., 'calendar', 'truck', 'users')
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for sorting
CREATE INDEX IF NOT EXISTS idx_event_categories_sort_order ON event_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_event_categories_is_active ON event_categories(is_active);

-- Enable RLS
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Public read access for active categories
DROP POLICY IF EXISTS "Anyone can view active event categories" ON event_categories;
CREATE POLICY "Anyone can view active event categories"
  ON event_categories FOR SELECT
  USING (is_active = true);

-- Admin full access
DROP POLICY IF EXISTS "Admins can manage event categories" ON event_categories;
CREATE POLICY "Admins can manage event categories"
  ON event_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_event_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_categories_updated_at ON event_categories;
CREATE TRIGGER event_categories_updated_at
  BEFORE UPDATE ON event_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_event_categories_updated_at();

-- Add category_id to events table (optional foreign key - events can still use event_type)
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES event_categories(id) ON DELETE SET NULL;

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);

-- Insert default categories matching existing event_type values
INSERT INTO event_categories (name, description, color, icon, sort_order) VALUES
  ('Workshop', 'Educational workshops and classes', '#8b5cf6', 'graduation-cap', 1),
  ('Open Hours', 'Farm visiting hours for the public', '#3b82f6', 'clock', 2),
  ('Farm Event', 'Special farm events and activities', '#f59e0b', 'calendar', 3),
  ('Shipping Day', 'Regular shipping and delivery days', '#10b981', 'truck', 4)
ON CONFLICT (name) DO NOTHING;
