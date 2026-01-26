-- Inventory Deduction on Order Creation
-- Creates an atomic function that checks stock and creates orders in a single transaction

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
BEGIN
  -- Phase 1: Check stock for all items (with row locks to prevent race conditions)
  FOREACH v_item IN ARRAY p_order_items LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    SELECT quantity_available, name INTO v_current_stock, v_product_name
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

  -- Phase 2: Create the order
  INSERT INTO orders (
    customer_id, guest_email, guest_phone,
    shipping_first_name, shipping_last_name,
    shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_state, shipping_zip, shipping_country,
    shipping_phone, shipping_method, shipping_cost,
    subtotal, tax, total, status
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
    'pending'
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
    SET quantity_available = quantity_available - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- Return success with order details
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (for checkout)
GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO authenticated;

-- Grant execute permission to anon users (for guest checkout)
GRANT EXECUTE ON FUNCTION create_order_with_inventory_check(JSONB, JSONB[]) TO anon;
