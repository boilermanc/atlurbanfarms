-- Migration: Add get_customer_segments RPC function
-- Description: Returns all 6 customer segment counts in a single server-side query.
--              Replaces client-side set intersection logic that hit the 1000 row limit.
-- Date: 2026-03-03

CREATE OR REPLACE FUNCTION get_customer_segments()
RETURNS json AS $$
SELECT json_build_object(
  'total', (SELECT COUNT(*) FROM customers),
  'ever_ordered', (SELECT COUNT(DISTINCT customer_id) FROM legacy_orders WHERE customer_id IS NOT NULL),
  'ordered_and_subscribed', (SELECT COUNT(*) FROM customers WHERE newsletter_subscribed = true AND id IN (SELECT DISTINCT customer_id FROM legacy_orders WHERE customer_id IS NOT NULL)),
  'newsletter_only', (SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'active' AND (customer_id IS NULL OR customer_id NOT IN (SELECT DISTINCT customer_id FROM legacy_orders WHERE customer_id IS NOT NULL))),
  'active_since_2024', (SELECT COUNT(DISTINCT customer_id) FROM legacy_orders WHERE customer_id IS NOT NULL AND order_date >= '2024-01-01'),
  'ghost_accounts', (SELECT COUNT(*) FROM customers WHERE newsletter_subscribed = false AND id NOT IN (SELECT DISTINCT customer_id FROM legacy_orders WHERE customer_id IS NOT NULL) AND id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE customer_id IS NOT NULL))
);
$$ LANGUAGE sql SECURITY DEFINER;
