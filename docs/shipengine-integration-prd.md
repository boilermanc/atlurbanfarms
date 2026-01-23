# ShipEngine Integration PRD
## ATL Urban Farms E-Commerce Platform

**Version:** 1.0  
**Date:** January 22, 2026  
**Author:** Product Team  

---

## 1. Overview

### 1.1 Purpose
Integrate ShipEngine API into the ATL Urban Farms platform to provide comprehensive shipping functionality including real-time rate calculation, address validation, label generation, and shipment tracking.

### 1.2 Background
ATL Urban Farms sells live plant seedlings in Atlanta. The platform requires specialized shipping handling because:
- Live plants are perishable and time-sensitive
- Plants cannot be replaced quickly if shipping fails
- Address validation is critical to prevent failed deliveries
- Customers need accurate shipping costs at checkout

### 1.3 API Details
- **API Base URL:** `https://api.shipengine.com/v1`
- **Authentication:** Header `API-Key: {your_api_key}`
- **Sandbox Key Format:** `TEST_xxxxx` (already configured)
- **Production Key Format:** Standard key (no TEST_ prefix)

---

## 2. Features

### 2.1 Address Validation

**Purpose:** Validate customer shipping addresses before checkout to prevent failed deliveries.

**Endpoint:** `POST /v1/addresses/validate`

**Request Body:**
```json
[
  {
    "name": "John Smith",
    "address_line1": "123 Main St",
    "address_line2": "Apt 4B",
    "city_locality": "Atlanta",
    "state_province": "GA",
    "postal_code": "30301",
    "country_code": "US",
    "address_residential_indicator": "unknown"
  }
]
```

**Response Fields:**
- `status`: "verified", "unverified", "warning", "error"
- `matched_address`: Corrected/normalized address
- `messages`: Array of validation messages

**Implementation Requirements:**

1. **Create Supabase Edge Function:** `shipengine-validate-address`
   - Accept address object from frontend
   - Call ShipEngine API
   - Return validation status and corrected address

2. **Frontend Integration:**
   - Add address validation to checkout flow
   - Show validation status (green check, yellow warning, red error)
   - Allow customer to accept suggested corrections
   - Block checkout for unverified addresses (configurable)

3. **Database Schema:**
```sql
-- Add to orders table or create addresses table
ALTER TABLE orders ADD COLUMN address_validated boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN address_validation_status text;
ALTER TABLE orders ADD COLUMN address_original jsonb;
ALTER TABLE orders ADD COLUMN address_normalized jsonb;
```

---

### 2.2 Shipping Rates at Checkout

**Purpose:** Display real-time shipping costs to customers before payment.

**Endpoint:** `POST /v1/rates`

**Request Body:**
```json
{
  "rate_options": {
    "carrier_ids": ["se-123456", "se-789012"],
    "service_codes": null
  },
  "shipment": {
    "ship_from": {
      "name": "ATL Urban Farms",
      "address_line1": "123 Farm Road",
      "city_locality": "Atlanta",
      "state_province": "GA",
      "postal_code": "30301",
      "country_code": "US"
    },
    "ship_to": {
      "name": "Customer Name",
      "address_line1": "456 Customer St",
      "city_locality": "Atlanta",
      "state_province": "GA",
      "postal_code": "30302",
      "country_code": "US"
    },
    "packages": [
      {
        "weight": {
          "value": 2.5,
          "unit": "pound"
        },
        "dimensions": {
          "length": 12,
          "width": 8,
          "height": 6,
          "unit": "inch"
        }
      }
    ]
  }
}
```

**Response Fields:**
- `rate_response.rates[]`: Array of available shipping options
  - `rate_id`: Use this to create label later
  - `carrier_id`: Carrier identifier
  - `service_code`: Service type (ground, express, etc.)
  - `service_type`: Human-readable service name
  - `shipping_amount.amount`: Cost in dollars
  - `delivery_days`: Estimated days to delivery
  - `estimated_delivery_date`: ISO date string

**Implementation Requirements:**

1. **Create Supabase Edge Function:** `shipengine-get-rates`
   - Accept ship_to address and package details
   - Load ship_from from config (ATL Urban Farms warehouse)
   - Load carrier_ids from config
   - Return sorted rates (by price or speed)

2. **Admin Configuration:**
   - Store warehouse/ship_from address in config_settings
   - Store enabled carrier_ids in config_settings
   - Store default package dimensions for seedlings

3. **Frontend Integration:**
   - Call rates API when customer enters shipping address
   - Display rates as selectable options
   - Show carrier logo, service name, price, delivery estimate
   - Store selected rate_id for label creation

4. **Database Schema:**
```sql
-- Config settings for shipping
INSERT INTO config_settings (category, key, value) VALUES
('shipping', 'warehouse_address', '{"name":"ATL Urban Farms","address_line1":"...","city_locality":"Atlanta","state_province":"GA","postal_code":"30301","country_code":"US"}'),
('shipping', 'default_package', '{"weight":{"value":2,"unit":"pound"},"dimensions":{"length":10,"width":8,"height":6,"unit":"inch"}}'),
('shipping', 'enabled_carriers', '["se-123456"]');

-- Add to orders table
ALTER TABLE orders ADD COLUMN shipping_rate_id text;
ALTER TABLE orders ADD COLUMN shipping_carrier text;
ALTER TABLE orders ADD COLUMN shipping_service text;
ALTER TABLE orders ADD COLUMN shipping_cost decimal(10,2);
ALTER TABLE orders ADD COLUMN estimated_delivery_date date;
```

---

### 2.3 Create Shipping Labels

**Purpose:** Generate shipping labels when Sheree fulfills orders.

**Endpoint:** `POST /v1/labels`

**Request Body (using rate_id):**
```json
{
  "rate_id": "se-rate-123456"
}
```

**Request Body (without rate_id):**
```json
{
  "shipment": {
    "carrier_id": "se-123456",
    "service_code": "usps_priority_mail",
    "ship_from": { ... },
    "ship_to": { ... },
    "packages": [ ... ]
  },
  "label_format": "pdf",
  "label_layout": "4x6"
}
```

**Response Fields:**
- `label_id`: Unique label identifier
- `tracking_number`: Carrier tracking number
- `label_download.pdf`: URL to download PDF label
- `label_download.png`: URL to download PNG label
- `tracking_status`: Current status
- `shipment_cost.amount`: Actual cost charged

**Implementation Requirements:**

1. **Create Supabase Edge Function:** `shipengine-create-label`
   - Accept order_id
   - Load order details from database
   - Use stored rate_id if available, otherwise build shipment
   - Create label via ShipEngine
   - Store label details in database
   - Return label download URL

2. **Admin Panel Integration:**
   - Add "Create Label" button to order detail page
   - Show label preview/download
   - Add "Print Label" functionality
   - Add "Void Label" button (for mistakes)

3. **Database Schema:**
```sql
-- Create shipments table
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  label_id text,
  tracking_number text,
  carrier_id text,
  service_code text,
  label_url text,
  label_format text DEFAULT 'pdf',
  shipment_cost decimal(10,2),
  status text DEFAULT 'label_created',
  voided boolean DEFAULT false,
  voided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage shipments" ON shipments FOR ALL USING (is_admin());
```

4. **Void Label Endpoint:** `PUT /v1/labels/{label_id}/void`

---

### 2.4 Track Shipments

**Purpose:** Provide customers with real-time tracking updates.

**Endpoint:** `GET /v1/tracking?carrier_code={carrier}&tracking_number={number}`

**Response Fields:**
- `tracking_number`: The tracking number
- `status_code`: Current status (IN_TRANSIT, DELIVERED, etc.)
- `status_description`: Human-readable status
- `carrier_status_code`: Carrier-specific status
- `estimated_delivery_date`: Updated ETA
- `actual_delivery_date`: When delivered
- `events[]`: Array of tracking events
  - `occurred_at`: Timestamp
  - `description`: Event description
  - `city_locality`, `state_province`: Location

**Implementation Requirements:**

1. **Create Supabase Edge Function:** `shipengine-track-shipment`
   - Accept tracking_number and carrier_code
   - Return tracking status and events

2. **Webhook for Real-time Updates:**
   - Create webhook endpoint: `shipengine-tracking-webhook`
   - Register webhook with ShipEngine for tracking updates
   - Update shipment status in database
   - Trigger email notification to customer

3. **Frontend Integration:**
   - Add tracking page accessible via order confirmation email
   - Show tracking timeline with events
   - Display map if location data available
   - Auto-refresh or poll for updates

4. **Customer Notifications:**
   - Email when label created (with tracking link)
   - Email when package in transit
   - Email when out for delivery
   - Email when delivered

5. **Database Schema:**
```sql
-- Add tracking fields to shipments
ALTER TABLE shipments ADD COLUMN tracking_status text;
ALTER TABLE shipments ADD COLUMN tracking_status_description text;
ALTER TABLE shipments ADD COLUMN estimated_delivery_date date;
ALTER TABLE shipments ADD COLUMN actual_delivery_date date;
ALTER TABLE shipments ADD COLUMN last_tracking_update timestamptz;

-- Create tracking events table
CREATE TABLE tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES shipments(id),
  occurred_at timestamptz,
  status_code text,
  description text,
  city_locality text,
  state_province text,
  country_code text,
  created_at timestamptz DEFAULT now()
);
```

---

## 3. Edge Functions Summary

| Function Name | Purpose | Auth Required |
|--------------|---------|---------------|
| `shipengine-validate-address` | Validate customer address | Yes (customer) |
| `shipengine-get-rates` | Get shipping rates | Yes (customer) |
| `shipengine-create-label` | Create shipping label | Yes (admin only) |
| `shipengine-void-label` | Void a label | Yes (admin only) |
| `shipengine-track-shipment` | Get tracking info | No (public) |
| `shipengine-tracking-webhook` | Receive tracking updates | No (webhook) |

---

## 4. Admin Panel Updates

### 4.1 Shipping Settings Page
Add new admin section for shipping configuration:
- Warehouse/Ship-from address
- Default package dimensions and weight
- Enable/disable carriers
- Shipping markup percentage (optional)
- Free shipping threshold

### 4.2 Order Detail Enhancements
- Display shipping information section
- Show selected shipping method and cost
- "Create Label" button (if not created)
- "View/Download Label" button (if created)
- "Void Label" button
- Tracking status with link to full tracking
- Timeline of tracking events

### 4.3 Orders List Enhancements
- Add "Shipping Status" column
- Filter by shipping status (pending, label_created, in_transit, delivered)
- Bulk label creation (select multiple orders)

---

## 5. Checkout Flow Updates

### 5.1 Updated Checkout Steps
1. Cart Review
2. **Shipping Address** (with validation)
3. **Shipping Method** (with real-time rates)
4. Payment
5. Confirmation

### 5.2 Address Step
- Form fields: name, address_line1, address_line2, city, state, zip
- "Validate Address" button or auto-validate on blur
- Show validation status
- Offer corrected address if different
- Store both original and normalized address

### 5.3 Shipping Method Step
- Display available shipping options from rates API
- Show: carrier logo, service name, price, delivery estimate
- Highlight fastest and cheapest options
- Allow selection
- Update order total with shipping cost

---

## 6. Database Migration Script

```sql
-- Run this migration to add all shipping-related schema changes

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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost decimal(10,2) DEFAULT 0;
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
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Customers view own shipments" ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = shipments.order_id 
      AND orders.customer_id = auth.uid()
    )
  );

-- Tracking events: public read access
CREATE POLICY "Anyone can view tracking events" ON tracking_events
  FOR SELECT USING (true);

-- 6. Shipping config defaults
INSERT INTO config_settings (category, key, value, description) VALUES
('shipping', 'warehouse_address', '{
  "name": "ATL Urban Farms",
  "company_name": "ATL Urban Farms",
  "phone": "",
  "address_line1": "",
  "city_locality": "Atlanta",
  "state_province": "GA",
  "postal_code": "",
  "country_code": "US"
}', 'Ship-from warehouse address'),
('shipping', 'default_package', '{
  "weight": {"value": 2, "unit": "pound"},
  "dimensions": {"length": 10, "width": 8, "height": 6, "unit": "inch"}
}', 'Default package dimensions for rate calculation'),
('shipping', 'free_shipping_threshold', '75', 'Order total for free shipping (0 to disable)'),
('shipping', 'shipping_markup_percent', '0', 'Markup percentage on shipping rates')
ON CONFLICT (category, key) DO NOTHING;
```

---

## 7. Implementation Order

### Phase 1: Foundation (Week 1)
1. Run database migration
2. Create `shipengine-validate-address` edge function
3. Create `shipengine-get-rates` edge function
4. Add shipping settings to admin panel

### Phase 2: Checkout Integration (Week 2)
5. Integrate address validation into checkout
6. Integrate shipping rates into checkout
7. Update order creation to store shipping details

### Phase 3: Fulfillment (Week 3)
8. Create `shipengine-create-label` edge function
9. Create `shipengine-void-label` edge function
10. Add label management to admin order detail page

### Phase 4: Tracking (Week 4)
11. Create `shipengine-track-shipment` edge function
12. Create `shipengine-tracking-webhook` edge function
13. Create customer-facing tracking page
14. Set up tracking notification emails

---

## 8. Testing Checklist

### Address Validation
- [ ] Valid address returns "verified"
- [ ] Invalid address returns appropriate error
- [ ] Corrected address is suggested
- [ ] Residential indicator is detected

### Shipping Rates
- [ ] Rates returned for valid address
- [ ] Multiple carrier options shown
- [ ] Prices and delivery dates accurate
- [ ] Selected rate stored with order

### Label Creation
- [ ] Label created successfully
- [ ] PDF downloads correctly
- [ ] Tracking number returned
- [ ] Label can be voided

### Tracking
- [ ] Status retrieved for valid tracking number
- [ ] Events displayed in order
- [ ] Webhook updates status in database
- [ ] Customer notification sent

---

## 9. Environment Variables

Add these to Supabase Edge Function secrets:

```
SHIPENGINE_API_KEY=TEST_xxx (sandbox) or production key
```

---

## 10. Error Handling

All edge functions should handle:
- Invalid API key (401)
- Rate limiting (429)
- Invalid request (400)
- Server errors (500)

Return consistent error format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Address could not be validated",
    "details": { ... }
  }
}
```

---

## 11. Notes for Live Plants

### Special Considerations
1. **No weekend delivery** - Plants shouldn't sit in a warehouse over the weekend
2. **Expedited shipping recommended** - For temperature-sensitive plants
3. **Seasonal restrictions** - May need to disable shipping during extreme weather
4. **Packaging weight** - Account for soil, water, and packaging materials
5. **Carrier selection** - Prioritize carriers with good plant shipping track record

### Future Enhancements
- Weather-based shipping restrictions
- Plant-specific packaging options
- Saturday delivery options
- Local delivery/pickup integration
