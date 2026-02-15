-- Security: Add database-level length constraint on customer_notes
-- Frontend limits to 500 chars, but DB had no constraint.
-- Using 2000 chars to be generous while preventing abuse.

-- Safety: truncate any existing notes that exceed the limit (shouldn't exist, but safe)
UPDATE orders SET customer_notes = LEFT(customer_notes, 2000)
WHERE customer_notes IS NOT NULL AND length(customer_notes) > 2000;

-- Add the constraint
ALTER TABLE orders
ADD CONSTRAINT customer_notes_max_length
CHECK (customer_notes IS NULL OR length(customer_notes) <= 2000);
