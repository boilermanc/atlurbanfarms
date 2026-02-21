-- Add local_pickup fulfillment field to products
-- Values: 'can_be_picked_up' (default), 'cannot_be_picked_up', 'must_be_picked_up'

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS local_pickup VARCHAR(25) DEFAULT 'can_be_picked_up'
CHECK (local_pickup IN ('can_be_picked_up', 'cannot_be_picked_up', 'must_be_picked_up'));

-- Index for filtering products by pickup eligibility
CREATE INDEX IF NOT EXISTS idx_products_local_pickup ON public.products(local_pickup);

COMMENT ON COLUMN public.products.local_pickup IS 'Local pickup eligibility: can_be_picked_up (both shipping and pickup), cannot_be_picked_up (shipping only), must_be_picked_up (pickup only)';
