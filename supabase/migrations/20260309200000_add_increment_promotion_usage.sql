-- Migration: Add increment_promotion_usage function
-- This function was referenced in code but never created.
-- It simply increments times_used and total_discount_given on the promotions table.
-- The record_promotion_usage function handles the full flow (insert + increment),
-- but this function exists as a standalone increment for backward compatibility.

CREATE OR REPLACE FUNCTION increment_promotion_usage(
  p_promotion_id uuid,
  p_discount_amount decimal
)
RETURNS void AS $$
BEGIN
  UPDATE promotions
  SET
    times_used = times_used + 1,
    total_discount_given = total_discount_given + COALESCE(p_discount_amount, 0)
  WHERE id = p_promotion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_promotion_usage(uuid, decimal) TO authenticated, anon;
