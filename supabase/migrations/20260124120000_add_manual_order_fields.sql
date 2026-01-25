-- Add payment tracking fields for manual order creation
-- This migration adds columns to track payment method, status, and admin who created the order

-- Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID;

-- Create index for admin-created orders
CREATE INDEX IF NOT EXISTS idx_orders_created_by_admin
  ON orders(created_by_admin_id)
  WHERE created_by_admin_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN orders.payment_method IS 'Payment method: stripe (customer checkout), cash, check, phone, other (manual orders)';
COMMENT ON COLUMN orders.payment_status IS 'Payment status: pending, paid, partial, refunded';
COMMENT ON COLUMN orders.created_by_admin_id IS 'Admin user who created this order manually (null for customer orders)';

-- Update the RPC function to accept and handle new payment tracking fields
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
BEGIN
  -- Phase 1: Check stock for all items (with row locks to prevent race conditions)
  FOREACH v_item IN ARRAY p_order_items LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    SELECT stock_quantity, name INTO v_current_stock, v_product_name
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;  -- Lock the row to prevent concurrent modifications

    IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
      v_insufficient_items := array_append(
        v_insufficient_items,
        format('%s (requested: %s, available: %s)',
               v_product_name, v_quantity, COALESCE(v_current_stock, 0))
      );
    END IF;
  END LOOP;

  -- If any items have insufficient stock, return error (transaction will rollback)
  IF array_length(v_insufficient_items, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'message', 'Insufficient stock for: ' || array_to_string(v_insufficient_items, ', ')
    );
  END IF;

  -- Determine order status based on payment status
  -- If payment_status is 'paid', set order status to 'paid', otherwise 'pending'
  v_order_status := CASE
    WHEN COALESCE(p_order_data->>'payment_status', 'pending') = 'paid' THEN 'paid'
    ELSE 'pending'
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

    -- Insert order item
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

    -- Decrement stock for this product
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

  -- Return success with order details
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$ LANGUAGE plpgsql;

-- Ensure permissions are still granted
GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO anon;
