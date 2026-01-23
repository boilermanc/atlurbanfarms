-- Create the missing promotion functions
-- Run this in Supabase SQL Editor

-- Drop if they exist with wrong signature
DROP FUNCTION IF EXISTS calculate_cart_discount(jsonb, text, uuid, text);
DROP FUNCTION IF EXISTS get_active_banners();
DROP FUNCTION IF EXISTS validate_coupon_code(text);

-- ============================================
-- FUNCTION: Calculate cart discount
-- ============================================
CREATE OR REPLACE FUNCTION calculate_cart_discount(
  p_cart_items jsonb,
  p_coupon_code text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_promotion promotions%ROWTYPE;
  v_discount decimal := 0;
  v_subtotal decimal := 0;
  v_item jsonb;
  v_eligible_total decimal := 0;
  v_customer_usage_count integer;
  v_product_id uuid;
  v_item_price decimal;
  v_item_qty integer;
  v_is_product_eligible boolean;
BEGIN
  -- Calculate cart subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'price')::decimal * (v_item->>'quantity')::integer;
  END LOOP;

  -- Find applicable promotion
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_promotion
    FROM promotions
    WHERE UPPER(coupon_code) = UPPER(TRIM(p_coupon_code))
      AND is_active = true
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
      AND (max_uses IS NULL OR times_used < max_uses)
      AND activation_type IN ('coupon', 'both');

    IF v_promotion IS NULL THEN
      RETURN jsonb_build_object(
        'valid', false,
        'discount', 0,
        'message', 'Invalid or expired coupon code'
      );
    END IF;
  ELSE
    -- Find best automatic site-wide promotion
    SELECT * INTO v_promotion
    FROM promotions
    WHERE is_active = true
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
      AND (max_uses IS NULL OR times_used < max_uses)
      AND activation_type IN ('automatic', 'both')
      AND scope = 'site'
      AND (minimum_order_amount IS NULL OR minimum_order_amount <= v_subtotal)
    ORDER BY priority DESC,
             CASE discount_type
               WHEN 'free_shipping' THEN 0
               ELSE discount_value
             END DESC
    LIMIT 1;
  END IF;

  -- No promotion found
  IF v_promotion IS NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'discount', 0,
      'message', NULL
    );
  END IF;

  -- Check minimum order amount
  IF v_promotion.minimum_order_amount IS NOT NULL AND v_subtotal < v_promotion.minimum_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'discount', 0,
      'promotion_id', v_promotion.id,
      'promotion_name', v_promotion.name,
      'message', format('Minimum order of $%s required', v_promotion.minimum_order_amount)
    );
  END IF;

  -- Check per-customer usage limit
  IF v_promotion.max_uses_per_customer IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_usage_count
    FROM promotion_usage
    WHERE promotion_id = v_promotion.id
      AND (
        (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
        OR (p_customer_email IS NOT NULL AND LOWER(customer_email) = LOWER(p_customer_email))
      );

    IF v_customer_usage_count >= v_promotion.max_uses_per_customer THEN
      RETURN jsonb_build_object(
        'valid', false,
        'discount', 0,
        'promotion_id', v_promotion.id,
        'promotion_name', v_promotion.name,
        'message', 'You have already used this promotion'
      );
    END IF;
  END IF;

  -- Calculate eligible total based on scope
  IF v_promotion.scope = 'site' THEN
    v_eligible_total := v_subtotal;
  ELSIF v_promotion.scope = 'category' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
      v_product_id := (v_item->>'product_id')::uuid;
      v_item_price := (v_item->>'price')::decimal;
      v_item_qty := (v_item->>'quantity')::integer;

      SELECT EXISTS (
        SELECT 1
        FROM products prod
        JOIN promotion_categories pc ON pc.category_id = prod.category_id
        WHERE prod.id = v_product_id AND pc.promotion_id = v_promotion.id
      ) INTO v_is_product_eligible;

      IF v_is_product_eligible THEN
        v_eligible_total := v_eligible_total + (v_item_price * v_item_qty);
      END IF;
    END LOOP;
  ELSIF v_promotion.scope = 'product' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
      v_product_id := (v_item->>'product_id')::uuid;
      v_item_price := (v_item->>'price')::decimal;
      v_item_qty := (v_item->>'quantity')::integer;

      SELECT EXISTS (
        SELECT 1 FROM promotion_products
        WHERE promotion_id = v_promotion.id AND product_id = v_product_id
      ) INTO v_is_product_eligible;

      IF v_is_product_eligible THEN
        v_eligible_total := v_eligible_total + (v_item_price * v_item_qty);
      END IF;
    END LOOP;
  ELSE
    v_eligible_total := v_subtotal;
  END IF;

  -- Calculate discount based on type
  CASE v_promotion.discount_type
    WHEN 'percentage' THEN
      v_discount := v_eligible_total * (v_promotion.discount_value / 100);
    WHEN 'fixed_amount' THEN
      v_discount := LEAST(v_promotion.discount_value, v_eligible_total);
    WHEN 'fixed_price' THEN
      v_discount := 0;
    WHEN 'free_shipping' THEN
      v_discount := 0;
    WHEN 'buy_x_get_y' THEN
      v_discount := 0;
    ELSE
      v_discount := 0;
  END CASE;

  v_discount := ROUND(v_discount, 2);

  RETURN jsonb_build_object(
    'valid', true,
    'promotion_id', v_promotion.id,
    'promotion_name', v_promotion.name,
    'promotion_code', v_promotion.coupon_code,
    'discount_type', v_promotion.discount_type,
    'discount_value', v_promotion.discount_value,
    'discount', v_discount,
    'eligible_total', ROUND(v_eligible_total, 2),
    'description', CASE
      WHEN v_promotion.discount_type = 'percentage' THEN format('%s%% off', v_promotion.discount_value::integer)
      WHEN v_promotion.discount_type = 'fixed_amount' THEN format('$%s off', v_promotion.discount_value)
      WHEN v_promotion.discount_type = 'free_shipping' THEN 'Free shipping'
      ELSE v_promotion.name
    END,
    'free_shipping', v_promotion.discount_type = 'free_shipping',
    'message', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get active homepage banners
-- ============================================
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  promotion_id uuid,
  name text,
  banner_text text,
  banner_bg_color text,
  banner_text_color text,
  code text,
  ends_at timestamptz,
  priority integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as promotion_id,
    p.name,
    p.banner_text,
    p.banner_background_color as banner_bg_color,
    p.banner_text_color,
    p.coupon_code as code,
    p.ends_at,
    p.priority
  FROM promotions p
  WHERE p.is_active = true
    AND p.show_banner = true
    AND p.banner_text IS NOT NULL
    AND p.banner_text != ''
    AND p.starts_at <= now()
    AND (p.ends_at IS NULL OR p.ends_at > now())
  ORDER BY p.priority DESC, p.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Validate coupon code
-- ============================================
CREATE OR REPLACE FUNCTION validate_coupon_code(p_coupon_code text)
RETURNS jsonb AS $$
DECLARE
  v_promotion promotions%ROWTYPE;
BEGIN
  IF p_coupon_code IS NULL OR TRIM(p_coupon_code) = '' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Please enter a coupon code'
    );
  END IF;

  SELECT * INTO v_promotion
  FROM promotions
  WHERE UPPER(coupon_code) = UPPER(TRIM(p_coupon_code))
    AND activation_type IN ('coupon', 'both');

  IF v_promotion IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Invalid coupon code'
    );
  END IF;

  IF NOT v_promotion.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is no longer active'
    );
  END IF;

  IF v_promotion.starts_at > now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon is not yet active'
    );
  END IF;

  IF v_promotion.ends_at IS NOT NULL AND v_promotion.ends_at < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon has expired'
    );
  END IF;

  IF v_promotion.max_uses IS NOT NULL AND v_promotion.times_used >= v_promotion.max_uses THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This coupon has reached its usage limit'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'promotion_id', v_promotion.id,
    'promotion_name', v_promotion.name,
    'discount_type', v_promotion.discount_type,
    'discount_value', v_promotion.discount_value,
    'minimum_order_amount', v_promotion.minimum_order_amount,
    'description', CASE
      WHEN v_promotion.discount_type = 'percentage' THEN format('%s%% off', v_promotion.discount_value::integer)
      WHEN v_promotion.discount_type = 'fixed_amount' THEN format('$%s off', v_promotion.discount_value)
      WHEN v_promotion.discount_type = 'free_shipping' THEN 'Free shipping'
      ELSE v_promotion.name
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION calculate_cart_discount(jsonb, text, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_banners() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_coupon_code(text) TO authenticated, anon;

-- Test the functions
SELECT 'Functions created successfully!' as status;
SELECT * FROM get_active_banners();
