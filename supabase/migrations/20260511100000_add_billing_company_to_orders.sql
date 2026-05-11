-- Add billing_company to orders so admins can record the company/school
-- on the billing side, mirroring shipping_company. Used for business and
-- school orders where the entity (not the contact) is the legal payer.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_company TEXT;

-- Recreate the order-creation RPC so it accepts and persists shipping_company
-- AND billing_company. Without this, the value sent from OrderCreatePage would
-- be silently dropped on insert. Mirrors the structure of the previous version
-- (20260414200000_fix_pickup_reservation_column_names) and only adds the two
-- company columns plus a billing-falls-back-to-shipping COALESCE.

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
    payment_method, payment_status, created_by_admin_id,
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
