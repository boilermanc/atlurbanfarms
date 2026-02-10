-- Fix: Admin cannot delete customers because no DELETE RLS policy exists.
-- Also adds admin policy on customer_favorites (was missing entirely).

-- 1. Allow admins to DELETE from customers table
CREATE POLICY "Admins can delete customers"
  ON customers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles
      WHERE admin_user_roles.customer_id = auth.uid()
        AND admin_user_roles.is_active = true
    )
  );

-- 2. Allow admins to manage customer_favorites (needed for cascade delete)
CREATE POLICY "Admins can manage customer favorites"
  ON customer_favorites
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
