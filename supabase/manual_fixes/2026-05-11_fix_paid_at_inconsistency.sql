-- Manual SQL fix: paid_at / payment_status inconsistency in orders.
-- Apply via Supabase SQL Editor (NOT a CLI migration — one-off repair).
--
-- BUG SUMMARY
-- 261 rows in `orders` have payment_status='paid' but paid_at IS NULL,
-- accumulating since 2026-03-04 (one day after the create_order_with_inventory_check
-- RPC was introduced on 2026-03-03). The RPC's INSERT column list never
-- contained paid_at, so the field was silently dropped on every checkout
-- despite the client and stripe-webhook both passing it in p_order_data.
-- The webhook's existing-order backfill (stripe-webhook/index.ts:152) was
-- gated behind `payment_status !== 'paid'` and so never repaired the row.
--
-- THIS FILE (atomic, single transaction)
--   1. CREATE OR REPLACE create_order_with_inventory_check — adds paid_at
--      to the column list and the VALUES clause. Body is a verbatim copy
--      of supabase/migrations/20260511100000_add_billing_company_to_orders.sql
--      (the current live version) with paid_at as the only addition.
--   2. Backfill: set paid_at = COALESCE(created_at, NOW()) for every row
--      where payment_status='paid' AND paid_at IS NULL.
--
-- Wrapped in BEGIN/COMMIT — if either statement fails, both roll back.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Redefine RPC with paid_at support
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_order_with_inventory_check(
  p_order_data JSONB,
  p_order_items JSONB[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INT;
  v_current_stock INT;
  v_product_name TEXT;
  v_insufficient_items TEXT[] := '{}';
  v_order_status TEXT;
  v_skip_inventory_check BOOLEAN;
BEGIN
  v_skip_inventory_check := COALESCE((p_order_data->>'skip_inventory_check')::BOOLEAN, false);

  -- Phase 1: Stock check (with row locks)
  IF NOT v_skip_inventory_check THEN
    FOREACH v_item IN ARRAY p_order_items LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INT;

      SELECT quantity_available, name INTO v_current_stock, v_product_name
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

      IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
        v_insufficient_items := array_append(
          v_insufficient_items,
          format('%s (requested: %s, available: %s)',
                 v_product_name, v_quantity, COALESCE(v_current_stock, 0))
        );
      END IF;
    END LOOP;

    IF array_length(v_insufficient_items, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_stock',
        'message', 'Insufficient stock for: ' || array_to_string(v_insufficient_items, ', ')
      );
    END IF;
  END IF;

  v_order_status := COALESCE(
    p_order_data->>'status',
    CASE
      WHEN COALESCE(p_order_data->>'payment_status', 'pending') IN ('paid', 'partial') THEN 'processing'
      WHEN COALESCE(p_order_data->>'payment_status', 'pending') = 'failed' THEN 'failed'
      WHEN COALESCE(p_order_data->>'payment_method', 'stripe') = 'purchase_order' THEN 'processing'
      ELSE 'pending_payment'
    END
  );

  -- Phase 2: Insert order
  INSERT INTO orders (
    customer_id, guest_email, guest_phone,
    shipping_first_name, shipping_last_name, shipping_company,
    shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_state, shipping_zip, shipping_country,
    shipping_phone, shipping_method, shipping_cost,
    subtotal, tax, total, status,
    payment_method, payment_status, paid_at, created_by_admin_id,
    internal_notes, customer_notes, growing_system,
    is_pickup, pickup_location_id, pickup_date,
    pickup_time_start, pickup_time_end,
    shipping_rate_id, shipping_carrier_id, shipping_service_code,
    shipping_method_name, estimated_delivery_date,
    shipping_address_validated, shipping_address_original, shipping_address_normalized,
    promotion_id, promotion_code, discount_amount, discount_description,
    tax_rate_applied, tax_note,
    stripe_payment_intent_id,
    billing_first_name, billing_last_name, billing_company,
    billing_address_line1, billing_address_line2,
    billing_city, billing_state, billing_zip,
    po_number, po_status
  ) VALUES (
    (p_order_data->>'customer_id')::UUID,
    p_order_data->>'guest_email',
    p_order_data->>'guest_phone',
    p_order_data->>'shipping_first_name',
    p_order_data->>'shipping_last_name',
    p_order_data->>'shipping_company',
    p_order_data->>'shipping_address_line1',
    p_order_data->>'shipping_address_line2',
    p_order_data->>'shipping_city',
    p_order_data->>'shipping_state',
    p_order_data->>'shipping_zip',
    COALESCE(p_order_data->>'shipping_country', 'US'),
    p_order_data->>'shipping_phone',
    p_order_data->>'shipping_method',
    (p_order_data->>'shipping_cost')::NUMERIC,
    (p_order_data->>'subtotal')::NUMERIC,
    (p_order_data->>'tax')::NUMERIC,
    (p_order_data->>'total')::NUMERIC,
    v_order_status,
    COALESCE(p_order_data->>'payment_method', 'stripe'),
    COALESCE(p_order_data->>'payment_status', 'pending'),
    -- paid_at: keep in sync with payment_status. Honor caller-supplied value
    -- if present, otherwise default to NOW() when payment was received.
    CASE
      WHEN COALESCE(p_order_data->>'payment_status', 'pending') IN ('paid', 'partial')
        THEN COALESCE((p_order_data->>'paid_at')::TIMESTAMPTZ, NOW())
      ELSE NULL
    END,
    (p_order_data->>'created_by_admin_id')::UUID,
    p_order_data->>'internal_notes',
    p_order_data->>'customer_notes',
    p_order_data->>'growing_system',
    COALESCE((p_order_data->>'is_pickup')::BOOLEAN, false),
    (p_order_data->>'pickup_location_id')::UUID,
    (p_order_data->>'pickup_date')::DATE,
    (p_order_data->>'pickup_time_start')::TIME,
    (p_order_data->>'pickup_time_end')::TIME,
    p_order_data->>'shipping_rate_id',
    p_order_data->>'shipping_carrier_id',
    p_order_data->>'shipping_service_code',
    p_order_data->>'shipping_method_name',
    (p_order_data->>'estimated_delivery_date')::DATE,
    COALESCE((p_order_data->>'shipping_address_validated')::BOOLEAN, false),
    (p_order_data->'shipping_address_original')::JSONB,
    (p_order_data->'shipping_address_normalized')::JSONB,
    (p_order_data->>'promotion_id')::UUID,
    p_order_data->>'promotion_code',
    COALESCE((p_order_data->>'discount_amount')::NUMERIC, 0),
    p_order_data->>'discount_description',
    (p_order_data->>'tax_rate_applied')::NUMERIC,
    p_order_data->>'tax_note',
    p_order_data->>'stripe_payment_intent_id',
    COALESCE(p_order_data->>'billing_first_name', p_order_data->>'shipping_first_name'),
    COALESCE(p_order_data->>'billing_last_name', p_order_data->>'shipping_last_name'),
    COALESCE(p_order_data->>'billing_company', p_order_data->>'shipping_company'),
    COALESCE(p_order_data->>'billing_address_line1', p_order_data->>'shipping_address_line1'),
    COALESCE(p_order_data->>'billing_address_line2', p_order_data->>'shipping_address_line2'),
    COALESCE(p_order_data->>'billing_city', p_order_data->>'shipping_city'),
    COALESCE(p_order_data->>'billing_state', p_order_data->>'shipping_state'),
    COALESCE(p_order_data->>'billing_zip', p_order_data->>'shipping_zip'),
    p_order_data->>'po_number',
    p_order_data->>'po_status'
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Phase 3: Order items + stock decrement
  FOREACH v_item IN ARRAY p_order_items LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    INSERT INTO order_items (
      order_id, product_id, product_name, product_price, quantity, line_total
    ) VALUES (
      v_order_id,
      v_product_id,
      v_item->>'product_name',
      (v_item->>'product_price')::NUMERIC,
      v_quantity,
      (v_item->>'line_total')::NUMERIC
    );

    UPDATE products
    SET quantity_available = quantity_available - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- Phase 4: Pickup reservation if needed
  IF COALESCE((p_order_data->>'is_pickup')::BOOLEAN, false) THEN
    INSERT INTO pickup_reservations (
      order_id,
      location_id,
      schedule_id,
      pickup_date,
      pickup_time_start,
      pickup_time_end,
      status
    ) VALUES (
      v_order_id,
      (p_order_data->>'pickup_location_id')::UUID,
      (p_order_data->>'pickup_schedule_id')::UUID,
      (p_order_data->>'pickup_date')::DATE,
      (p_order_data->>'pickup_time_start')::TIME,
      (p_order_data->>'pickup_time_end')::TIME,
      'scheduled'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'inventory_override_used', v_skip_inventory_check
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Backfill historical rows
-- ──────────────────────────────────────────────────────────────────────
--
-- Expected impact: ~261 rows updated (as of 2026-05-11 investigation).
-- SANITY CHECK before COMMIT: run the SELECT below first in a separate
-- session, confirm the count is close to 261, and only then run this file.
-- If the count is wildly different (0, or thousands), investigate why
-- before committing — this whole transaction can be rolled back with
-- ROLLBACK; instead of COMMIT;.
--
--   SELECT COUNT(*) FROM orders
--   WHERE payment_status = 'paid' AND paid_at IS NULL;

UPDATE orders
SET paid_at = COALESCE(created_at, NOW())
WHERE payment_status = 'paid'
  AND paid_at IS NULL;

COMMIT;
