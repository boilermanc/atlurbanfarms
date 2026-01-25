BEGIN;

-- Ensure order status history has the status column our app expects
DO $$
DECLARE
  has_status boolean;
  has_to_status boolean;
  has_from_status boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'status'
  )
  INTO has_status;

  IF NOT has_status THEN
    EXECUTE 'ALTER TABLE order_status_history ADD COLUMN status TEXT';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'to_status'
  )
  INTO has_to_status;

  IF has_to_status THEN
    EXECUTE '
      UPDATE order_status_history
      SET status = COALESCE(status, to_status)
      WHERE status IS NULL AND to_status IS NOT NULL
    ';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'from_status'
  )
  INTO has_from_status;

  IF has_from_status THEN
    EXECUTE '
      UPDATE order_status_history
      SET status = COALESCE(status, from_status)
      WHERE status IS NULL AND from_status IS NOT NULL
    ';
  END IF;
END $$;

-- 1. Map legacy order statuses to the new workflow
UPDATE orders
SET status = CASE
  WHEN status = 'pending' THEN 'pending_payment'
  WHEN status IN ('paid', 'allocated', 'picking', 'packed', 'shipped') THEN 'processing'
  WHEN status = 'delivered' THEN 'completed'
  WHEN status = 'partial_refund' THEN 'refunded'
  ELSE status
END
WHERE status IN ('pending', 'paid', 'allocated', 'picking', 'packed', 'shipped', 'delivered', 'partial_refund');

-- Apply the same mapping to the status history table
UPDATE order_status_history
SET status = CASE
  WHEN status = 'pending' THEN 'pending_payment'
  WHEN status IN ('paid', 'allocated', 'picking', 'packed', 'shipped') THEN 'processing'
  WHEN status = 'delivered' THEN 'completed'
  WHEN status = 'partial_refund' THEN 'refunded'
  ELSE status
END
WHERE status IN ('pending', 'paid', 'allocated', 'picking', 'packed', 'shipped', 'delivered', 'partial_refund');

-- 2. Normalize payment status values that were using partial_refund
UPDATE orders
SET payment_status = 'partial'
WHERE payment_status = 'partial_refund';

-- Default null/blank payment statuses back to pending for data integrity
UPDATE orders
SET payment_status = 'pending'
WHERE payment_status IS NULL OR payment_status = '';

-- 3. Update the status column metadata and validation
ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'pending_payment';

COMMENT ON COLUMN orders.status IS 'Order workflow status: pending_payment, processing, on_hold, completed, cancelled, refunded, failed';

DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed'));
END $$;

DO $$
BEGIN
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_status_check;
  ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_to_status_check;
  ALTER TABLE order_status_history
    ADD CONSTRAINT order_status_history_status_check
    CHECK (status IN ('pending_payment','processing','on_hold','completed','cancelled','refunded','failed'));
END $$;

-- 4. Keep RPC logic in sync with the new statuses
CREATE OR REPLACE FUNCTION create_order_with_inventory_check(
  p_order_data JSONB,
  p_order_items JSONB[]
)
RETURNS JSONB AS $$
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
  v_payment_state TEXT := LOWER(COALESCE(p_order_data->>'payment_status', 'pending'));
BEGIN
  -- Phase 1: Check stock for all items (with row locks to prevent race conditions)
  FOREACH v_item IN ARRAY p_order_items LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    SELECT stock_quantity, name INTO v_current_stock, v_product_name
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

  -- Determine order status based on payment status
  v_order_status := CASE
    WHEN v_payment_state IN ('paid', 'partial') THEN 'processing'
    WHEN v_payment_state = 'failed' THEN 'failed'
    ELSE 'pending_payment'
  END;

  -- Phase 2: Create the order
  INSERT INTO orders (
    customer_id, guest_email, guest_phone,
    shipping_first_name, shipping_last_name,
    shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_state, shipping_zip, shipping_country,
    shipping_phone, shipping_method, shipping_cost,
    subtotal, tax, total, status,
    payment_method, payment_status, created_by_admin_id,
    internal_notes,
    is_pickup, pickup_location_id, pickup_date,
    pickup_time_start, pickup_time_end
  ) VALUES (
    (p_order_data->>'customer_id')::UUID,
    p_order_data->>'guest_email',
    p_order_data->>'guest_phone',
    p_order_data->>'shipping_first_name',
    p_order_data->>'shipping_last_name',
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
    (p_order_data->>'created_by_admin_id')::UUID,
    p_order_data->>'internal_notes',
    COALESCE((p_order_data->>'is_pickup')::BOOLEAN, false),
    (p_order_data->>'pickup_location_id')::UUID,
    (p_order_data->>'pickup_date')::DATE,
    p_order_data->>'pickup_time_start',
    p_order_data->>'pickup_time_end'
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Phase 3: Create order items and decrement stock
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
    SET stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- Phase 4: Create pickup reservation if needed
  IF COALESCE((p_order_data->>'is_pickup')::BOOLEAN, false) THEN
    INSERT INTO pickup_reservations (
      order_id,
      pickup_location_id,
      pickup_date,
      pickup_time_start,
      pickup_time_end,
      status,
      customer_email,
      customer_phone
    ) VALUES (
      v_order_id,
      (p_order_data->>'pickup_location_id')::UUID,
      (p_order_data->>'pickup_date')::DATE,
      p_order_data->>'pickup_time_start',
      p_order_data->>'pickup_time_end',
      'scheduled',
      COALESCE(p_order_data->>'guest_email', p_order_data->>'customer_email'),
      COALESCE(p_order_data->>'guest_phone', p_order_data->>'customer_phone')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO anon;

COMMIT;
