-- Migration: Fix RLS policies for pickup tables
-- Created: 2026-01-26
-- Description: The pickup table RLS policies incorrectly reference a 'profiles' table.
--              This fixes them to use 'admin_user_roles' which is the correct admin auth table.

-- ============================================
-- 1. DROP OLD POLICIES THAT REFERENCE 'profiles'
-- ============================================

-- Pickup Locations
DROP POLICY IF EXISTS "Admins full access to pickup_locations" ON pickup_locations;

-- Pickup Schedules
DROP POLICY IF EXISTS "Admins full access to pickup_schedules" ON pickup_schedules;

-- Pickup Reservations
DROP POLICY IF EXISTS "Admins full access to pickup_reservations" ON pickup_reservations;

-- ============================================
-- 2. CREATE CORRECTED POLICIES USING 'admin_user_roles'
-- ============================================

-- Pickup Locations: Admins can do everything
CREATE POLICY "Admins full access to pickup_locations" ON pickup_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Pickup Schedules: Admins can do everything
CREATE POLICY "Admins full access to pickup_schedules" ON pickup_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Pickup Reservations: Admins can do everything
CREATE POLICY "Admins full access to pickup_reservations" ON pickup_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );
