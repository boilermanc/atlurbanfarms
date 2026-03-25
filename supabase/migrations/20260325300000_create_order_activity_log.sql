-- Create order_activity_log table for comprehensive order timeline
CREATE TABLE IF NOT EXISTS order_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'order_created',
    'items_updated',
    'shipping_address_updated',
    'billing_address_updated',
    'tracking_updated',
    'note_added',
    'payment_status_changed',
    'converted_to_ship',
    'refund_issued',
    'order_cancelled',
    'marked_picked_up',
    'notes_updated'
  )),
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by order
CREATE INDEX idx_order_activity_log_order_id ON order_activity_log(order_id);
CREATE INDEX idx_order_activity_log_created_at ON order_activity_log(created_at);

-- Enable RLS
ALTER TABLE order_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to read and insert
CREATE POLICY "Admins can read order activity" ON order_activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert order activity" ON order_activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Backfill: create 'order_created' entries from existing orders
INSERT INTO order_activity_log (order_id, activity_type, description, created_by_name, created_at)
SELECT id, 'order_created', 'Order placed', 'System', created_at
FROM orders
ON CONFLICT DO NOTHING;
