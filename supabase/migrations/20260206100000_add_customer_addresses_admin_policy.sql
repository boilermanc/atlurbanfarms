-- Add admin RLS policy for customer_addresses table
-- Fixes: Admin > Customer > Details > Add Address fails with "failed to save address"
-- Root cause: Only user-self policies existed (auth.uid() = customer_id),
-- blocking admin operations on other customers' addresses.

DROP POLICY IF EXISTS "Admins can manage customer addresses" ON customer_addresses;

CREATE POLICY "Admins can manage customer addresses"
  ON customer_addresses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE admin_user_roles.customer_id = auth.uid()
        AND admin_user_roles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE admin_user_roles.customer_id = auth.uid()
        AND admin_user_roles.is_active = true
    )
  );
