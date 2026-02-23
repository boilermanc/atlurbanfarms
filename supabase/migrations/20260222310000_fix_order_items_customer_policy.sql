-- Fix: Add missing customer SELECT policy on order_items
-- The admin policy already existed, but customers couldn't read their own order items,
-- causing empty order history items and blank invoices.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Customers can view own order items'
  ) THEN
    CREATE POLICY "Customers can view own order items" ON order_items
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND customer_id = auth.uid())
      );
  END IF;
END $$;
