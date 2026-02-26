-- Migration: Add promotion excluded categories
-- Created: 2026-02-26
-- Purpose: Allow promotions to exclude specific categories from discounts

-- ============================================
-- TABLE: promotion_excluded_categories
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_excluded_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES product_categories(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, category_id)
);

ALTER TABLE promotion_excluded_categories ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage excluded categories"
  ON promotion_excluded_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM customers WHERE id = auth.uid() AND role = 'admin'));

-- Public read for active promotions (needed for storefront discount calculation)
CREATE POLICY "Public can read excluded categories"
  ON promotion_excluded_categories FOR SELECT
  USING (true);

-- ============================================
-- UPDATE: calculate_cart_discount to respect excluded categories
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
  v_is_excluded boolean;
  v_has_exclusions boolean;
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

  -- Check if this promotion has any excluded categories
  SELECT EXISTS (
    SELECT 1 FROM promotion_excluded_categories
    WHERE promotion_id = v_promotion.id
  ) INTO v_has_exclusions;

  -- Calculate eligible total based on scope
  IF v_promotion.scope = 'site' THEN
    IF v_has_exclusions THEN
      -- Site-wide but with excluded categories: iterate items
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
      LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_item_price := (v_item->>'price')::decimal;
        v_item_qty := (v_item->>'quantity')::integer;

        SELECT EXISTS (
          SELECT 1
          FROM products prod
          JOIN promotion_excluded_categories pec ON pec.category_id = prod.category_id
          WHERE prod.id = v_product_id AND pec.promotion_id = v_promotion.id
        ) INTO v_is_excluded;

        IF NOT v_is_excluded THEN
          v_eligible_total := v_eligible_total + (v_item_price * v_item_qty);
        END IF;
      END LOOP;
    ELSE
      v_eligible_total := v_subtotal;
    END IF;
  ELSIF v_promotion.scope = 'category' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
      v_product_id := (v_item->>'product_id')::uuid;
      v_item_price := (v_item->>'price')::decimal;
      v_item_qty := (v_item->>'quantity')::integer;

      -- Check if product is in an included category
      SELECT EXISTS (
        SELECT 1
        FROM products prod
        JOIN promotion_categories pc ON pc.category_id = prod.category_id
        WHERE prod.id = v_product_id AND pc.promotion_id = v_promotion.id
      ) INTO v_is_product_eligible;

      -- Also check if product is in an excluded category
      IF v_is_product_eligible AND v_has_exclusions THEN
        SELECT EXISTS (
          SELECT 1
          FROM products prod
          JOIN promotion_excluded_categories pec ON pec.category_id = prod.category_id
          WHERE prod.id = v_product_id AND pec.promotion_id = v_promotion.id
        ) INTO v_is_excluded;

        IF v_is_excluded THEN
          v_is_product_eligible := false;
        END IF;
      END IF;

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

      -- Also check excluded categories for product-scoped promotions
      IF v_is_product_eligible AND v_has_exclusions THEN
        SELECT EXISTS (
          SELECT 1
          FROM products prod
          JOIN promotion_excluded_categories pec ON pec.category_id = prod.category_id
          WHERE prod.id = v_product_id AND pec.promotion_id = v_promotion.id
        ) INTO v_is_excluded;

        IF v_is_excluded THEN
          v_is_product_eligible := false;
        END IF;
      END IF;

      IF v_is_product_eligible THEN
        v_eligible_total := v_eligible_total + (v_item_price * v_item_qty);
      END IF;
    END LOOP;
  ELSE
    -- customer scope or fallback
    IF v_has_exclusions THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
      LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_item_price := (v_item->>'price')::decimal;
        v_item_qty := (v_item->>'quantity')::integer;

        SELECT EXISTS (
          SELECT 1
          FROM products prod
          JOIN promotion_excluded_categories pec ON pec.category_id = prod.category_id
          WHERE prod.id = v_product_id AND pec.promotion_id = v_promotion.id
        ) INTO v_is_excluded;

        IF NOT v_is_excluded THEN
          v_eligible_total := v_eligible_total + (v_item_price * v_item_qty);
        END IF;
      END LOOP;
    ELSE
      v_eligible_total := v_subtotal;
    END IF;
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
-- UPDATE: get_product_promotions to respect excluded categories
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
    AND (p.max_uses IS NULL OR p.times_used < p.max_uses)
    AND p.activation_type IN ('automatic', 'both')
    AND p.discount_type IN ('percentage', 'fixed_amount', 'fixed_price')
    AND (
      p.scope = 'site'
      OR (p.scope = 'product' AND pp.product_id = p_product_id)
      OR (p.scope = 'category' AND pc.category_id = prod.category_id)
    )
    -- Exclude products in excluded categories
    AND NOT EXISTS (
      SELECT 1
      FROM promotion_excluded_categories pec
      WHERE pec.promotion_id = p.id AND pec.category_id = prod.category_id
    )
  ORDER BY p.priority DESC, p.discount_value DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE: get_products_promotions to respect excluded categories
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
    AND (p.max_uses IS NULL OR p.times_used < p.max_uses)
    AND p.activation_type IN ('automatic', 'both')
    AND p.discount_type IN ('percentage', 'fixed_amount', 'fixed_price')
  )
  LEFT JOIN promotion_products pp ON pp.promotion_id = p.id AND pp.product_id = prod.id
  LEFT JOIN promotion_categories pc ON pc.promotion_id = p.id AND pc.category_id = pr.category_id
  WHERE p.id IS NOT NULL
    AND (
      p.scope = 'site'
      OR (p.scope = 'product' AND pp.product_id IS NOT NULL)
      OR (p.scope = 'category' AND pc.category_id IS NOT NULL)
    )
    -- Exclude products in excluded categories
    AND NOT EXISTS (
      SELECT 1
      FROM promotion_excluded_categories pec
      WHERE pec.promotion_id = p.id AND pec.category_id = pr.category_id
    )
  ORDER BY prod.id, p.priority DESC, p.discount_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions (unchanged signatures, but just to be safe)
GRANT EXECUTE ON FUNCTION get_product_promotions(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_products_promotions(uuid[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_cart_discount(jsonb, text, uuid, text) TO authenticated, anon;
