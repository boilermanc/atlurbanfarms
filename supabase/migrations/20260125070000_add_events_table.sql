-- Events table for public calendar (workshops, farm events, open hours, shipping dates)
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL CHECK (event_type IN ('workshop', 'open_hours', 'farm_event', 'shipping')),
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  location text,
  max_attendees integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public read access for active events
CREATE POLICY "Anyone can view active events"
  ON events FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

-- Insert some sample events
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, location) VALUES
  ('Weekly Shipping', 'Regular shipping day for online orders', 'shipping', CURRENT_DATE + INTERVAL '2 days', NULL, '09:00', '17:00', NULL),
  ('Farm Open Hours', 'Visit our urban farm! Browse seedlings and get growing tips', 'open_hours', CURRENT_DATE + INTERVAL '5 days', NULL, '10:00', '14:00', 'ATL Urban Farms - Main Location'),
  ('Container Gardening Workshop', 'Learn how to grow vegetables in small spaces', 'workshop', CURRENT_DATE + INTERVAL '10 days', NULL, '11:00', '13:00', 'ATL Urban Farms - Education Center'),
  ('Spring Plant Sale', 'Annual spring plant sale with special discounts', 'farm_event', CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '15 days', '09:00', '16:00', 'ATL Urban Farms - Main Location');
