-- Migration: Add admin RLS policy for customers table
-- Created: 2026-01-25
-- Description: Allows admin users to INSERT new customers (for manual order creation)

-- ============================================
-- 1. ENSURE RLS IS ENABLED ON CUSTOMERS TABLE
-- ============================================
-- This is idempotent - if RLS is already enabled, this does nothing
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP EXISTING POLICIES (IF ANY) TO AVOID CONFLICTS
-- ============================================
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can read all customers" ON public.customers;
DROP POLICY IF EXISTS "Users can read own customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
DROP POLICY IF EXISTS "Anyone can read customers for auth" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers for registration" ON public.customers;
DROP POLICY IF EXISTS "Service role full access to customers" ON public.customers;

-- ============================================
-- 3. CREATE RLS POLICIES FOR CUSTOMERS TABLE
-- ============================================

-- Allow users to read their own customer record (for profile pages)
CREATE POLICY "Users can read own customer record" ON public.customers
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to read all customers
CREATE POLICY "Admins can read all customers" ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow admins to INSERT new customers (for manual order creation)
CREATE POLICY "Admins can insert customers" ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow admins to UPDATE customers
CREATE POLICY "Admins can update customers" ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow users to update their own customer record
CREATE POLICY "Users can update own customer record" ON public.customers
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow service role full access (for edge functions, etc.)
CREATE POLICY "Service role full access to customers" ON public.customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to insert (for guest checkout/registration)
-- This is important for new user sign-ups
CREATE POLICY "Anyone can insert customers for registration" ON public.customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT SELECT, INSERT ON public.customers TO anon;
GRANT ALL ON public.customers TO service_role;
