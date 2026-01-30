-- Migration: Add gift cards tables
-- Created: 2026-01-30

-- ============================================
-- 1. GIFT CARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Gift Card Code
  code TEXT NOT NULL UNIQUE,                       -- Unique redemption code (e.g., "GIFT-ABC123")

  -- Balance Information
  initial_balance DECIMAL(10,2) NOT NULL,          -- Original amount loaded
  current_balance DECIMAL(10,2) NOT NULL,          -- Remaining balance

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'disabled')),

  -- Purchaser Information
  purchaser_email TEXT,                            -- Email of person who bought the gift card
  purchaser_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Recipient Information
  recipient_email TEXT,                            -- Email where gift card was sent
  recipient_name TEXT,                             -- Name of recipient (for personalization)
  message TEXT,                                    -- Personal message from purchaser

  -- Dates
  purchased_at TIMESTAMPTZ,                        -- When the gift card was purchased (NULL for manual issuance)
  expires_at TIMESTAMPTZ,                          -- Expiration date (NULL = never expires)

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES customers(id)         -- Admin who created (for manual issuance)
);

-- ============================================
-- 2. GIFT CARD TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,  -- For redemptions linked to orders

  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,                   -- Positive for additions, negative for redemptions
  balance_after DECIMAL(10,2) NOT NULL,            -- Balance after this transaction
  type TEXT NOT NULL CHECK (type IN ('purchase', 'redemption', 'refund', 'adjustment')),
  notes TEXT,                                      -- Reason for adjustment, etc.

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES customers(id)         -- Admin who made the transaction
);

-- ============================================
-- 3. ADD GIFT CARD FIELDS TO ORDERS TABLE
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES gift_cards(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2) DEFAULT 0;

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

-- Gift cards table indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser_email ON gift_cards(purchaser_email) WHERE purchaser_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_email ON gift_cards(recipient_email) WHERE recipient_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_cards_created_at ON gift_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_cards_expires_at ON gift_cards(expires_at) WHERE expires_at IS NOT NULL;

-- Gift card transactions table indexes
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_order ON gift_card_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_type ON gift_card_transactions(type);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_created_at ON gift_card_transactions(created_at DESC);

-- Orders table gift card index
CREATE INDEX IF NOT EXISTS idx_orders_gift_card ON orders(gift_card_id) WHERE gift_card_id IS NOT NULL;

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on gift card tables
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- Admins: Full access to gift_cards
CREATE POLICY "Admins full access to gift_cards" ON gift_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Public: Read own gift cards (by email or customer_id)
CREATE POLICY "Users can view gift cards sent to them" ON gift_cards
  FOR SELECT USING (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR purchaser_customer_id = auth.uid()
  );

-- Admins: Full access to gift_card_transactions
CREATE POLICY "Admins full access to gift_card_transactions" ON gift_card_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Users: Read transactions for their gift cards
CREATE POLICY "Users can view transactions for their gift cards" ON gift_card_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gift_cards gc
      WHERE gc.id = gift_card_transactions.gift_card_id
      AND (
        gc.recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR gc.purchaser_customer_id = auth.uid()
      )
    )
  );

-- ============================================
-- 6. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_gift_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_cards_updated_at ON gift_cards;
CREATE TRIGGER gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_gift_cards_updated_at();

-- ============================================
-- 7. HELPER FUNCTION: Generate unique gift card code
-- ============================================

CREATE OR REPLACE FUNCTION generate_gift_card_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a code like "GIFT-XXXX-XXXX" where X is alphanumeric
    new_code := 'GIFT-' ||
      upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
      upper(substring(md5(random()::text) from 1 for 4));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM gift_cards WHERE code = new_code) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. HELPER FUNCTION: Update gift card balance and status
-- ============================================

CREATE OR REPLACE FUNCTION update_gift_card_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the gift card's current balance
  UPDATE gift_cards
  SET current_balance = NEW.balance_after,
      status = CASE
        WHEN NEW.balance_after <= 0 THEN 'depleted'
        ELSE status
      END
  WHERE id = NEW.gift_card_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_card_transaction_balance_update ON gift_card_transactions;
CREATE TRIGGER gift_card_transaction_balance_update
  AFTER INSERT ON gift_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_gift_card_balance();

-- ============================================
-- 9. GRANT PERMISSIONS
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT ON gift_cards TO authenticated;
GRANT SELECT ON gift_card_transactions TO authenticated;

-- Grant full permissions to service role (for admin operations via RLS)
GRANT ALL ON gift_cards TO service_role;
GRANT ALL ON gift_card_transactions TO service_role;
