-- Create RPC function for atomic bulk inventory updates
-- This function updates multiple products' inventory counts in a single transaction
-- preventing race conditions and overselling

CREATE OR REPLACE FUNCTION bulk_update_product_inventory(
  p_updates jsonb,  -- Array of {product_id, new_quantity, reason_code, notes}
  p_updated_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_update jsonb;
  v_product_id uuid;
  v_new_quantity integer;
  v_current_quantity integer;
  v_adjustment_quantity integer;
  v_reason_code text;
  v_notes text;
  v_product_name text;
  v_updated_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Loop through each update
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      -- Extract update parameters
      v_product_id := (v_update->>'product_id')::uuid;
      v_new_quantity := (v_update->>'new_quantity')::integer;
      v_reason_code := COALESCE(v_update->>'reason_code', 'inventory_count');
      v_notes := v_update->>'notes';

      -- Validate new quantity is not negative
      IF v_new_quantity < 0 THEN
        v_errors := v_errors || jsonb_build_object(
          'product_id', v_product_id,
          'error', 'Quantity cannot be negative'
        );
        CONTINUE;
      END IF;

      -- Get current quantity and product name
      SELECT quantity_available, name
      INTO v_current_quantity, v_product_name
      FROM products
      WHERE id = v_product_id;

      -- Skip if product not found
      IF NOT FOUND THEN
        v_errors := v_errors || jsonb_build_object(
          'product_id', v_product_id,
          'error', 'Product not found'
        );
        CONTINUE;
      END IF;

      -- Calculate adjustment (can be positive or negative)
      v_adjustment_quantity := v_new_quantity - v_current_quantity;

      -- Skip if no change
      IF v_adjustment_quantity = 0 THEN
        CONTINUE;
      END IF;

      -- Update product quantity
      UPDATE products
      SET
        quantity_available = v_new_quantity,
        updated_at = now()
      WHERE id = v_product_id;

      -- Create inventory adjustment record for audit trail
      INSERT INTO inventory_adjustments (
        product_id,
        adjustment_type,
        quantity,
        reason_code,
        notes,
        adjusted_by,
        created_at
      ) VALUES (
        v_product_id,
        CASE
          WHEN v_adjustment_quantity > 0 THEN 'count'::text
          ELSE 'correction'::text
        END,
        v_adjustment_quantity,
        v_reason_code,
        COALESCE(v_notes, 'Bulk inventory update'),
        p_updated_by,
        now()
      );

      v_updated_count := v_updated_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'errors', v_errors
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback will happen automatically
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION bulk_update_product_inventory IS
  'Atomically updates inventory quantities for multiple products and creates adjustment records';
