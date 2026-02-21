-- Add tax exemption fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt_reason TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt_certificate TEXT;

-- Add tax audit fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate_applied NUMERIC(5,4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_note TEXT;

-- Seed tax configuration settings
INSERT INTO config_settings (category, key, value, data_type, description)
VALUES
  ('tax', 'tax_enabled', 'true', 'boolean', 'Whether sales tax collection is enabled'),
  ('tax', 'default_tax_rate', '0.07', 'number', 'Tax rate for nexus states (e.g., 0.07 for 7%)'),
  ('tax', 'nexus_states', '["GA"]', 'json', 'State abbreviations where sales tax applies'),
  ('tax', 'tax_label', '"Sales Tax"', 'string', 'Label shown on the tax line item')
ON CONFLICT (category, key) DO NOTHING;

-- Recreate order RPC to include tax_rate_applied and tax_note
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
  -- Check if inventory check should be skipped (admin override)
  v_skip_inventory_check := COALESCE((p_order_data->>'skip_inventory_check')::BOOLEAN, false);

  -- Phase 1: Check stock for all items (with row locks to prevent race conditions)
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
      ELSE 'pending_payment'
    END
  );

  -- Phase 2: Create the order
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
    -- ShipEngine shipping details
    shipping_rate_id, shipping_carrier_id, shipping_service_code,
    shipping_method_name, estimated_delivery_date,
    shipping_address_validated, shipping_address_original, shipping_address_normalized,
    -- Promotion details
    promotion_id, promotion_code, discount_amount, discount_description,
    -- Tax audit
    tax_rate_applied, tax_note
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
    -- ShipEngine shipping details
    p_order_data->>'shipping_rate_id',
    p_order_data->>'shipping_carrier_id',
    p_order_data->>'shipping_service_code',
    p_order_data->>'shipping_method_name',
    (p_order_data->>'estimated_delivery_date')::DATE,
    COALESCE((p_order_data->>'shipping_address_validated')::BOOLEAN, false),
    (p_order_data->'shipping_address_original')::JSONB,
    (p_order_data->'shipping_address_normalized')::JSONB,
    -- Promotion details
    (p_order_data->>'promotion_id')::UUID,
    p_order_data->>'promotion_code',
    COALESCE((p_order_data->>'discount_amount')::NUMERIC, 0),
    p_order_data->>'discount_description',
    -- Tax audit
    (p_order_data->>'tax_rate_applied')::NUMERIC,
    p_order_data->>'tax_note'
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
    SET quantity_available = quantity_available - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- Phase 4: Create pickup reservation if needed
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
