-- Rename order status "delivered" → "picked_up"
UPDATE orders SET status = 'picked_up' WHERE status = 'delivered';
UPDATE order_status_history SET status = 'picked_up' WHERE status = 'delivered';
UPDATE order_status_history SET to_status = 'picked_up' WHERE to_status = 'delivered';
UPDATE order_status_history SET from_status = 'picked_up' WHERE from_status = 'delivered';
