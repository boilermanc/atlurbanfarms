-- Back-in-stock notification alerts table
-- Tracks customers who want to be notified when out-of-stock products become available

CREATE TABLE IF NOT EXISTS public.back_in_stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    UNIQUE(product_id, email)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_back_in_stock_alerts_product_id ON public.back_in_stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_back_in_stock_alerts_email ON public.back_in_stock_alerts(email);
CREATE INDEX IF NOT EXISTS idx_back_in_stock_alerts_status ON public.back_in_stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_back_in_stock_alerts_customer_id ON public.back_in_stock_alerts(customer_id);

-- Enable RLS
ALTER TABLE public.back_in_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Policy for public read/insert (customers can subscribe without being logged in)
CREATE POLICY "Anyone can subscribe to alerts"
    ON public.back_in_stock_alerts
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy for customers to view their own alerts
CREATE POLICY "Customers can view their own alerts"
    ON public.back_in_stock_alerts
    FOR SELECT
    TO public
    USING (
        email = current_setting('request.jwt.claims', true)::json->>'email'
        OR customer_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    );

-- Policy for admin full access
CREATE POLICY "Admins have full access to alerts"
    ON public.back_in_stock_alerts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_user_roles
            WHERE customer_id = auth.uid()
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_user_roles
            WHERE customer_id = auth.uid()
            AND is_active = true
        )
    );

-- Function to mark alerts as notified
CREATE OR REPLACE FUNCTION public.notify_back_in_stock_alerts(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.back_in_stock_alerts
    SET status = 'notified', notified_at = NOW()
    WHERE product_id = p_product_id
    AND status = 'pending';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admins will use this)
GRANT EXECUTE ON FUNCTION public.notify_back_in_stock_alerts(UUID) TO authenticated;

-- View for easy querying with product info
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
    c.first_name AS customer_first_name,
    c.last_name AS customer_last_name
FROM public.back_in_stock_alerts a
LEFT JOIN public.products p ON a.product_id = p.id
LEFT JOIN public.customers c ON a.customer_id = c.id;

-- Grant select on view to authenticated users
GRANT SELECT ON public.back_in_stock_alerts_with_product TO authenticated;
