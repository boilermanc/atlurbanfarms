-- RPC function for the n8n pickup reminder workflow.
-- Returns orders with pickups scheduled for tomorrow (relative to America/New_York).
-- Called daily at 9 AM ET by the n8n "Pickup Reminder" workflow.

CREATE OR REPLACE FUNCTION get_tomorrow_pickups()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  customer_email TEXT,
  first_name TEXT,
  last_name TEXT,
  pickup_date DATE,
  pickup_time_start TIME,
  pickup_time_end TIME,
  pickup_location TEXT,
  pickup_address TEXT,
  pickup_instructions TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    o.id AS order_id,
    o.order_number,
    COALESCE(c.email, o.guest_email) AS customer_email,
    COALESCE(c.first_name, o.shipping_first_name) AS first_name,
    COALESCE(c.last_name, o.shipping_last_name) AS last_name,
    o.pickup_date,
    o.pickup_time_start,
    o.pickup_time_end,
    pl.name AS pickup_location,
    CONCAT_WS(', ',
      pl.address_line1,
      NULLIF(pl.address_line2, ''),
      CONCAT(pl.city, ', ', pl.state, ' ', pl.postal_code)
    ) AS pickup_address,
    COALESCE(pl.instructions, 'Please bring a valid ID and your order confirmation.') AS pickup_instructions
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN pickup_locations pl ON pl.id = o.pickup_location_id
  WHERE o.is_pickup = true
    AND o.pickup_date = (CURRENT_DATE AT TIME ZONE 'America/New_York')::date + INTERVAL '1 day'
    AND o.status NOT IN ('cancelled', 'completed', 'refunded')
    AND COALESCE(c.email, o.guest_email) IS NOT NULL;
$$;
