-- Migration: Add local pickup tables for location and schedule management
-- Created: 2026-01-22

-- 1. Pickup Locations Table
CREATE TABLE IF NOT EXISTS pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  phone text,
  instructions text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Pickup Schedules Table
CREATE TABLE IF NOT EXISTS pickup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES pickup_locations(id) ON DELETE CASCADE,
  schedule_type text NOT NULL CHECK (schedule_type IN ('recurring', 'one_time')),
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  specific_date date,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_orders integer, -- null means unlimited
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_recurring_schedule CHECK (
    (schedule_type = 'recurring' AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (schedule_type = 'one_time' AND specific_date IS NOT NULL AND day_of_week IS NULL)
  ),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- 3. Pickup Reservations Table
CREATE TABLE IF NOT EXISTS pickup_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES pickup_locations(id),
  schedule_id uuid REFERENCES pickup_schedules(id),
  pickup_date date NOT NULL,
  pickup_time_start time NOT NULL,
  pickup_time_end time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'picked_up', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One reservation per order
  CONSTRAINT unique_order_reservation UNIQUE (order_id)
);

-- 4. Add pickup fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_pickup boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location_id uuid REFERENCES pickup_locations(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time_start time;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time_end time;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_pickup_locations_active ON pickup_locations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pickup_locations_sort ON pickup_locations(sort_order);

CREATE INDEX IF NOT EXISTS idx_pickup_schedules_location ON pickup_schedules(location_id);
CREATE INDEX IF NOT EXISTS idx_pickup_schedules_active ON pickup_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pickup_schedules_recurring ON pickup_schedules(location_id, day_of_week) WHERE schedule_type = 'recurring';
CREATE INDEX IF NOT EXISTS idx_pickup_schedules_one_time ON pickup_schedules(location_id, specific_date) WHERE schedule_type = 'one_time';

CREATE INDEX IF NOT EXISTS idx_pickup_reservations_order ON pickup_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_pickup_reservations_location ON pickup_reservations(location_id);
CREATE INDEX IF NOT EXISTS idx_pickup_reservations_date ON pickup_reservations(pickup_date);
CREATE INDEX IF NOT EXISTS idx_pickup_reservations_status ON pickup_reservations(status);

CREATE INDEX IF NOT EXISTS idx_orders_pickup ON orders(is_pickup) WHERE is_pickup = true;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_location ON orders(pickup_location_id) WHERE pickup_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date) WHERE pickup_date IS NOT NULL;

-- 6. RLS Policies
ALTER TABLE pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_reservations ENABLE ROW LEVEL SECURITY;

-- Pickup Locations: Admins can do everything, public can read active locations
CREATE POLICY "Admins full access to pickup_locations" ON pickup_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public read active pickup_locations" ON pickup_locations
  FOR SELECT USING (is_active = true);

-- Pickup Schedules: Admins can do everything, public can read active schedules
CREATE POLICY "Admins full access to pickup_schedules" ON pickup_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public read active pickup_schedules" ON pickup_schedules
  FOR SELECT USING (
    is_active = true AND
    EXISTS (SELECT 1 FROM pickup_locations WHERE id = location_id AND is_active = true)
  );

-- Pickup Reservations: Admins can do everything, users can read their own
CREATE POLICY "Admins full access to pickup_reservations" ON pickup_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users read own pickup_reservations" ON pickup_reservations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid())
  );

CREATE POLICY "Insert pickup reservations for own orders" ON pickup_reservations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid())
  );

-- 7. Update triggers
CREATE OR REPLACE FUNCTION update_pickup_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pickup_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pickup_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pickup_locations_updated_at ON pickup_locations;
CREATE TRIGGER pickup_locations_updated_at
  BEFORE UPDATE ON pickup_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_pickup_locations_updated_at();

DROP TRIGGER IF EXISTS pickup_schedules_updated_at ON pickup_schedules;
CREATE TRIGGER pickup_schedules_updated_at
  BEFORE UPDATE ON pickup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_pickup_schedules_updated_at();

DROP TRIGGER IF EXISTS pickup_reservations_updated_at ON pickup_reservations;
CREATE TRIGGER pickup_reservations_updated_at
  BEFORE UPDATE ON pickup_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_pickup_reservations_updated_at();

-- 8. Function to count reservations for a specific slot
CREATE OR REPLACE FUNCTION get_pickup_slot_count(
  p_location_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM pickup_reservations
    WHERE location_id = p_location_id
      AND pickup_date = p_date
      AND pickup_time_start = p_start_time
      AND pickup_time_end = p_end_time
      AND status NOT IN ('cancelled')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Function to get available pickup slots for a location within a date range
CREATE OR REPLACE FUNCTION get_available_pickup_slots(
  p_location_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  schedule_id uuid,
  slot_date date,
  start_time time,
  end_time time,
  max_orders integer,
  current_count integer,
  slots_available integer
) AS $$
DECLARE
  current_date date;
  dow integer;
BEGIN
  -- Loop through each date in the range
  current_date := p_start_date;
  WHILE current_date <= p_end_date LOOP
    dow := EXTRACT(DOW FROM current_date)::integer;

    -- Get recurring schedules for this day of week
    RETURN QUERY
    SELECT
      ps.id as schedule_id,
      current_date as slot_date,
      ps.start_time,
      ps.end_time,
      ps.max_orders,
      get_pickup_slot_count(p_location_id, current_date, ps.start_time, ps.end_time) as current_count,
      CASE
        WHEN ps.max_orders IS NULL THEN 999999
        ELSE ps.max_orders - get_pickup_slot_count(p_location_id, current_date, ps.start_time, ps.end_time)
      END as slots_available
    FROM pickup_schedules ps
    WHERE ps.location_id = p_location_id
      AND ps.is_active = true
      AND ps.schedule_type = 'recurring'
      AND ps.day_of_week = dow
      AND (ps.max_orders IS NULL OR
           ps.max_orders > get_pickup_slot_count(p_location_id, current_date, ps.start_time, ps.end_time));

    -- Get one-time schedules for this specific date
    RETURN QUERY
    SELECT
      ps.id as schedule_id,
      ps.specific_date as slot_date,
      ps.start_time,
      ps.end_time,
      ps.max_orders,
      get_pickup_slot_count(p_location_id, ps.specific_date, ps.start_time, ps.end_time) as current_count,
      CASE
        WHEN ps.max_orders IS NULL THEN 999999
        ELSE ps.max_orders - get_pickup_slot_count(p_location_id, ps.specific_date, ps.start_time, ps.end_time)
      END as slots_available
    FROM pickup_schedules ps
    WHERE ps.location_id = p_location_id
      AND ps.is_active = true
      AND ps.schedule_type = 'one_time'
      AND ps.specific_date = current_date
      AND (ps.max_orders IS NULL OR
           ps.max_orders > get_pickup_slot_count(p_location_id, ps.specific_date, ps.start_time, ps.end_time));

    current_date := current_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. Seed sample data (optional - comment out for production)
-- INSERT INTO pickup_locations (name, address_line1, city, state, postal_code, phone, instructions, is_active, sort_order) VALUES
--   ('ATL Urban Farms - Cumming', '123 Farm Road', 'Cumming', 'GA', '30041', '(770) 555-0100', 'Park in the gravel lot behind the greenhouse. Ring the doorbell at the main entrance.', true, 1),
--   ('Peachtree Farmers Market', '456 Market Street', 'Atlanta', 'GA', '30309', null, 'Find us at Booth #12 in the main hall. Look for the green ATL Urban Farms banner!', true, 2)
-- ON CONFLICT DO NOTHING;
