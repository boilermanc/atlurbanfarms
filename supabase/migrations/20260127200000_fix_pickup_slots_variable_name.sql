-- Migration: Fix get_available_pickup_slots variable name conflict
-- Created: 2026-01-27
-- Description: The function declares a variable named 'current_date' which conflicts
--              with PostgreSQL's built-in CURRENT_DATE keyword. Inside RETURN QUERY
--              SELECT statements, PostgreSQL resolves 'current_date' to the SQL keyword
--              (always today) instead of the loop variable, causing all date iterations
--              to query for today only. Renaming to 'check_date' fixes this.

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
  check_date date;
  dow integer;
BEGIN
  -- Loop through each date in the range
  check_date := p_start_date;
  WHILE check_date <= p_end_date LOOP
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
$$ LANGUAGE plpgsql STABLE;
