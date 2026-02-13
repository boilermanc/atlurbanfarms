-- Migration: Fix gift_cards RLS policies that reference auth.users
-- Problem: The "Users can view gift cards sent to them" and
-- "Users can view transactions for their gift cards" policies query
-- auth.users directly, which the authenticated role cannot access.
-- This causes "permission denied for table users" errors.
-- Fix: Replace auth.users lookups with auth.jwt() ->> 'email'

-- ============================================
-- 1. FIX GIFT_CARDS USER POLICY
-- ============================================

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view gift cards sent to them" ON gift_cards;

-- Recreate using JWT claims instead of auth.users table
CREATE POLICY "Users can view gift cards sent to them" ON gift_cards
  FOR SELECT USING (
    recipient_email = (auth.jwt() ->> 'email')
    OR purchaser_customer_id = auth.uid()
  );

-- ============================================
-- 2. FIX GIFT_CARD_TRANSACTIONS USER POLICY
-- ============================================

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view transactions for their gift cards" ON gift_card_transactions;

-- Recreate using JWT claims instead of auth.users table
CREATE POLICY "Users can view transactions for their gift cards" ON gift_card_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gift_cards gc
      WHERE gc.id = gift_card_transactions.gift_card_id
      AND (
        gc.recipient_email = (auth.jwt() ->> 'email')
        OR gc.purchaser_customer_id = auth.uid()
      )
    )
  );

-- ============================================
-- 3. FIX MISSING GRANTS FOR ADMIN OPERATIONS
-- ============================================

-- Admins need INSERT/UPDATE (not just SELECT) for creating and managing gift cards
GRANT INSERT, UPDATE ON gift_cards TO authenticated;
GRANT INSERT ON gift_card_transactions TO authenticated;
