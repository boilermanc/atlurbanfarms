-- Drop the foreign key constraint that requires customers.id to reference auth.users(id)
-- This allows admin-created customers (manual orders, guest checkout) to exist
-- without a corresponding auth.users account.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_id_fkey;
