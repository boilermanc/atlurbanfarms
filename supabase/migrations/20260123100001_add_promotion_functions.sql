-- Migration: Add promotion database functions
-- Created: 2026-01-23

-- ============================================
-- FUNCTION: Get best promotion for a product
-- Returns the highest-priority applicable promotion for a given product
-- ============================================
CREATE OR REPLACE FUNCTION get_product_promotions(p_product_id uuid)
RETURNS TABLE (
  promotion_id uuid,
  name text,
  discount_type text,
  discount_value decimal,
  badge_text text,
  priority integer,
  ends_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id as promotion_id,
    p.name,
    p.discount_type,
    p.discount_value,
    p.badge_text,
    p.priority,
    p.ends_at
  FROM promotions p
  LEFT JOIN promotion_products pp ON pp.promotion_id = p.id
  LEFT JOIN promotion_categories pc ON pc.promotion_id = p.id
  LEFT JOIN products prod ON prod.id = p_product_id
  WHERE p.is_active = true
    AND p.starts_at <= now()
    AND (p.ends_at IS NULL OR p.ends_at > now())
    AND (p.usage_limit_total IS NULL OR p.usage_count < p.usage_limit_total)
    AND p.activation_type IN ('automatic', 'both')
    AND p.discount_type IN ('percentage', 'fixed_amount', 'fixed_price')
    AND (
      -- Site-wide promotion
      p.scope = 'site_wide'
      -- Product-specific promotion
      OR (p.scope = 'product' AND pp.product_id = p_product_id)
      -- Category promotion (match product's category)
      OR (p.scope = 'category' AND pc.category_id = prod.category_id)
    )
  ORDER BY p.priority DESC, p.discount_value DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get all promotions for multiple products (batch)
-- More efficient for loading product lists with promotions
-- ============================================
CREATE OR REPLACE FUNCTION get_products_promotions(p_product_ids uuid[])
RETURNS TABLE (
  product_id uuid,
  promotion_id uuid,
  name text,
  discount_type text,
  discount_value decimal,
  badge_text text,
  priority integer,
  ends_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (prod.id)
    prod.id as product_id,
    p.id as promotion_id,
    p.name,
    p.discount_type,
    p.discount_value,
    p.badge_text,
    p.priority,
    p.ends_at
  FROM unnest(p_product_ids) AS prod(id)
  LEFT JOIN products pr ON pr.id = prod.id
  LEFT JOIN promotions p ON (
    p.is_active = true
    AND p.starts_at <= now()
    AND (p.ends_at IS NULL OR p.ends_at > now())
    AND (p.usage_limit_total IS NULL OR p.usage_count < p.usage_limit_total)
    AND p.activation_type IN ('automatic', 'both')
    AND p.discount_type IN ('percentage', 'fixed_amount', 'fixed_price')
  )
  LEFT JOIN promotion_products pp ON pp.promotion_id = p.id AND pp.product_id = prod.id
  LEFT JOIN promotion_categories pc ON pc.promotion_id = p.id AND pc.category_id = pr.category_id
  WHERE p.id IS NOT NULL
    AND (
      p.scope = 'site_wide'
      OR (p.scope = 'product' AND pp.product_id IS NOT NULL)
      OR (p.scope = 'category' AND pc.category_id IS NOT NULL)
    )
  ORDER BY prod.id, p.priority DESC, p.discount_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate cart discount
-- Validates and calculates discount for checkout
-- ============================================
CREATE OR REPLACE FUNCTION calculate_cart_discount(
  p_cart_items jsonb,           -- [{product_id, quantity, price}]
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
    -- Code-based promotion lookup
    SELECT * INTO v_promotion
    FROM promotions
    WHERE UPPER(code) = UPPER(TRIM(p_coupon_code))
      AND is_active = true
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
      AND (usage_limit_total IS NULL OR usage_count < usage_limit_total)
      AND activation_type IN ('code', 'both');

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
      AND (usage_limit_total IS NULL OR usage_count < usage_limit_total)
      AND activation_type IN ('automatic', 'both')
      AND scope = 'site_wide'
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
      'message', format('Minimum order of $%s required (current: $%s)', v_promotion.minimum_order_amount, ROUND(v_subtotal, 2))
    );
  END IF;

  -- Check minimum quantity
  IF v_promotion.minimum_quantity IS NOT NULL THEN
    DECLARE
      v_total_qty integer := 0;
    BEGIN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
      LOOP
        v_total_qty := v_total_qty + (v_item->>'quantity')::integer;
      END LOOP;

      IF v_total_qty < v_promotion.minimum_quantity THEN
        RETURN jsonb_build_object(
          'valid', false,
          'discount', 0,
          'promotion_id', v_promotion.id,
          'promotion_name', v_promotion.name,
          'message', format('Minimum of %s items required', v_promotion.minimum_quantity)
        );
      END IF;
    END;
  END IF;

  -- Check per-customer usage limit
  IF v_promotion.usage_limit_per_customer IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_usage_count
    FROM promotion_usage
    WHERE promotion_id = v_promotion.id
      AND (
        (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
        OR (p_customer_email IS NOT NULL AND LOWER(customer_email) = LOWER(p_customer_email))
      );

    IF v_customer_usage_count >= v_promotion.usage_limit_per_customer THEN
      RETURN jsonb_build_object(
        'valid', false,
        'discount', 0,
        'promotion_id', v_promotion.id,
        'promotion_name', v_promotion.name,
        'message', 'You have already used this promotion'
      );
    END IF;
  END IF;

  -- Check customer-specific promotions
  IF v_promotion.scope = 'customer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM promotion_customers
      WHERE promotion_id = v_promotion.id
        AND (
          (p_customer_id IS NOT NULL AND customer_id = p_customer_id)
          OR (p_customer_email IS NOT NULL AND LOWER(customer_email) = LOWER(p_customer_email))
        )
    ) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'discount', 0,
        'message', 'This promotion is not available for your account'
      );
    END IF;
  END IF;

  -- Calculate eligible total based on scope
  IF v_promotion.scope = 'site_wide' THEN
    v_eligible_total := v_subtotal;
  ELSIF v_promotion.scope = 'category' THEN
    -- Sum items in matching categories
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
    -- Sum items that are specifically included
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

  -- If no eligible items, return no discount
  IF v_eligible_total = 0 AND v_promotion.discount_type != 'free_shipping' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'discount', 0,
      'promotion_id', v_promotion.id,
      'promotion_name', v_promotion.name,
      'message', 'No eligible items in cart for this promotion'
    );
  END IF;

  -- Calculate discount based on type
  CASE v_promotion.discount_type
    WHEN 'percentage' THEN
      v_discount := v_eligible_total * (v_promotion.discount_value / 100);
      -- Apply maximum discount cap if set
      IF v_promotion.maximum_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_promotion.maximum_discount_amount);
      END IF;
    WHEN 'fixed_amount' THEN
      v_discount := LEAST(v_promotion.discount_value, v_eligible_total);
    WHEN 'fixed_price' THEN
      -- Fixed price is typically per-item, calculate savings
      -- This requires more complex logic per item - for cart level, treat as fixed amount off
      v_discount := 0;
    WHEN 'free_shipping' THEN
      v_discount := 0;  -- Handled separately in checkout
    WHEN 'buy_x_get_y' THEN
      -- Complex logic for buy X get Y - simplified for now
      v_discount := 0;
    ELSE
      v_discount := 0;
  END CASE;

  -- Round to 2 decimal places
  v_discount := ROUND(v_discount, 2);

  RETURN jsonb_build_object(
    'valid', true,
    'promotion_id', v_promotion.id,
    'promotion_name', v_promotion.name,
    'promotion_code', v_promotion.code,
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
-- Returns promotions configured to show on homepage
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
    p.banner_bg_color,
    p.banner_text_color,
    p.code,
    p.ends_at,
    p.priority
  FROM promotions p
  WHERE p.is_active = true
    AND p.show_on_homepage = true
    AND p.banner_text IS NOT NULL
    AND p.banner_text != ''
    AND p.starts_at <= now()
    AND (p.ends_at IS NULL OR p.ends_at > now())
  ORDER BY p.priority DESC, p.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Record promotion usage
-- Called after successful order creation
-- ============================================
CREATE OR REPLACE FUNCTION record_promotion_usage(
  p_promotion_id uuid,
  p_order_id uuid,
  p_customer_id uuid,
  p_customer_email text,
  p_discount_amount decimal
)
RETURNS jsonb AS $$
BEGIN
  -- Insert usage record
  INSERT INTO promotion_usage (
    promotion_id,
    order_id,
    customer_id,
    customer_email,
    discount_amount
  )
  VALUES (
    p_promotion_id,
    p_order_id,
    p_customer_id,
    LOWER(TRIM(p_customer_email)),
    p_discount_amount
  );

  -- Increment usage count on promotion
  UPDATE promotions
  SET usage_count = usage_count + 1
  WHERE id = p_promotion_id;

  RETURN jsonb_build_object(
    'success', true,
    'promotion_id', p_promotion_id,
    'order_id', p_order_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Validate coupon code (quick check)
-- Lightweight validation without full cart calculation
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
  WHERE UPPER(code) = UPPER(TRIM(p_coupon_code))
    AND activation_type IN ('code', 'both');

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

  IF v_promotion.usage_limit_total IS NOT NULL AND v_promotion.usage_count >= v_promotion.usage_limit_total THEN
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
-- GRANT EXECUTE PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION get_product_promotions(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_products_promotions(uuid[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_cart_discount(jsonb, text, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_banners() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_promotion_usage(uuid, uuid, uuid, text, decimal) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_coupon_code(text) TO authenticated, anon;
