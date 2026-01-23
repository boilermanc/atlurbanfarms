-- Migration: Add shipping-related tables and columns for ShipEngine integration
-- Created: 2026-01-22

-- 1. Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  label_id text UNIQUE,
  tracking_number text,
  carrier_id text,
  carrier_code text,
  service_code text,
  label_url text,
  label_format text DEFAULT 'pdf',
  shipment_cost decimal(10,2),
  status text DEFAULT 'pending',
  tracking_status text,
  tracking_status_description text,
  estimated_delivery_date date,
  actual_delivery_date date,
  last_tracking_update timestamptz,
  voided boolean DEFAULT false,
  voided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tracking events table
CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  status_code text,
  description text,
  city_locality text,
  state_province text,
  country_code text,
  raw_event jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Add shipping fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_validated boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_original jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_normalized jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_rate_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date date;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_id ON tracking_events(shipment_id);

-- 5. RLS Policies
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- Shipments: admins can do everything, customers can view their own
CREATE POLICY "Admins full access to shipments" ON shipments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

CREATE POLICY "Customers view own shipments" ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipments.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- Tracking events: public read access (needed for tracking pages)
CREATE POLICY "Anyone can view tracking events" ON tracking_events
  FOR SELECT USING (true);

-- Admin access to tracking events
CREATE POLICY "Admins full access to tracking events" ON tracking_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- 6. Shipping config defaults
INSERT INTO config_settings (category, key, value, description, data_type) VALUES
('shipping', 'warehouse_address', '{
  "name": "ATL Urban Farms",
  "company_name": "ATL Urban Farms",
  "phone": "",
  "address_line1": "",
  "city_locality": "Atlanta",
  "state_province": "GA",
  "postal_code": "",
  "country_code": "US"
}', 'Ship-from warehouse address', 'json'),
('shipping', 'default_package', '{
  "weight": {"value": 2, "unit": "pound"},
  "dimensions": {"length": 10, "width": 8, "height": 6, "unit": "inch"}
}', 'Default package dimensions for rate calculation', 'json'),
('shipping', 'free_shipping_threshold', '75', 'Order total for free shipping (0 to disable)', 'number'),
('shipping', 'shipping_markup_percent', '0', 'Markup percentage on shipping rates', 'number')
ON CONFLICT (category, key) DO NOTHING;

-- 7. Update trigger for shipments updated_at
CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_shipments_updated_at();
