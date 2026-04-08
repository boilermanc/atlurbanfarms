-- Migration: Add category info to back_in_stock_alerts_with_product view
-- Ref: https://github.com/boilermanc/atlurbanfarms/issues/55
-- Adds product_category_id and product_category_name for filtering alerts by category

CREATE OR REPLACE VIEW public.back_in_stock_alerts_with_product AS
SELECT
    a.id,
    a.product_id,
    a.email,
    a.customer_id,
    a.status,
    a.created_at,
    a.notified_at,
    p.name AS product_name,
    p.quantity_available AS product_quantity,
    p.is_active AS product_is_active,
    p.category_id AS product_category_id,
    pc.name AS product_category_name,
    c.first_name AS customer_first_name,
    c.last_name AS customer_last_name
FROM public.back_in_stock_alerts a
LEFT JOIN public.products p ON a.product_id = p.id
LEFT JOIN public.product_categories pc ON p.category_id = pc.id
LEFT JOIN public.customers c ON a.customer_id = c.id;
