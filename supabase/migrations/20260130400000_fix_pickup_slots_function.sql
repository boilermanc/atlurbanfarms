-- Migration: Fix get_available_pickup_slots function
-- Created: 2026-01-30
-- Description: This migration ensures the pickup slots RPC function works correctly by:
--   1. Fixing the variable name conflict (check_date instead of current_date)
--   2. Adding SECURITY DEFINER to bypass RLS complications (function has its own is_active checks)
--   3. Setting search_path for security
--
-- Issue: Admin > Orders > Create Order shows "No available pickup slots" even though
--        schedules exist in Admin > Shipping > Pickup > Schedules

-- Drop and recreate the helper function first
DROP FUNCTION IF EXISTS get_pickup_slot_count(uuid, date, time, time);

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Drop and recreate the main function
DROP FUNCTION IF EXISTS get_available_pickup_slots(uuid, date, date);

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
  -- IMPORTANT: Using 'check_date' instead of 'current_date' to avoid conflict
  -- with PostgreSQL's built-in CURRENT_DATE keyword
  check_date date;
  dow integer;
BEGIN
  -- Validate location exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM pickup_locations
    WHERE id = p_location_id AND is_active = true
  ) THEN
    RETURN; -- Return empty if location doesn't exist or is inactive
  END IF;

  -- Loop through each date in the range
  check_date := p_start_date;
  WHILE check_date <= p_end_date LOOP
    -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    dow := EXTRACT(DOW FROM check_date)::integer;

    -- Get recurring schedules for this day of week
    RETURN QUERY
    SELECT
      ps.id as schedule_id,
      check_date as slot_date,
      ps.start_time,
      ps.end_time,
      ps.max_orders,
      get_pickup_slot_count(p_location_id, check_date, ps.start_time, ps.end_time) as current_count,
      CASE
        WHEN ps.max_orders IS NULL THEN 999999
        ELSE ps.max_orders - get_pickup_slot_count(p_location_id, check_date, ps.start_time, ps.end_time)
      END as slots_available
    FROM pickup_schedules ps
    WHERE ps.location_id = p_location_id
      AND ps.is_active = true
      AND ps.schedule_type = 'recurring'
      AND ps.day_of_week = dow
      AND (ps.max_orders IS NULL OR
           ps.max_orders > get_pickup_slot_count(p_location_id, check_date, ps.start_time, ps.end_time));

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
      AND ps.specific_date = check_date
      AND (ps.max_orders IS NULL OR
           ps.max_orders > get_pickup_slot_count(p_location_id, ps.specific_date, ps.start_time, ps.end_time));

    check_date := check_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pickup_slot_count(uuid, date, time, time) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_available_pickup_slots(uuid, date, date) TO authenticated, anon;

-- Add a comment explaining the function
COMMENT ON FUNCTION get_available_pickup_slots IS 'Returns available pickup slots for a location within a date range. Handles both recurring (weekly) and one-time schedules.';
