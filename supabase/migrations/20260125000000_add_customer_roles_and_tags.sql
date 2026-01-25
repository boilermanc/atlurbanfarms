-- Migration: Add customer roles and tags system
-- Created: 2026-01-25
-- Description: Adds customer role classification and tagging system for customer segmentation

-- ============================================
-- 1. ADD ROLE COLUMN TO CUSTOMERS TABLE
-- ============================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
  CHECK (role IN ('customer', 'subscriber', 'admin'));

-- Add index for role filtering
CREATE INDEX IF NOT EXISTS idx_customers_role ON public.customers(role);

-- Add comment for documentation
COMMENT ON COLUMN public.customers.role IS 'Customer role: customer (default), subscriber (newsletter/blog), admin (staff/admin user)';

-- ============================================
-- 2. CUSTOMER TAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'emerald' CHECK (color IN ('emerald', 'blue', 'purple', 'amber', 'red', 'pink', 'indigo', 'slate', 'teal', 'cyan')),
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Add comments for documentation
COMMENT ON TABLE public.customer_tags IS 'Tags for customer classification and segmentation (VIP, School, Wholesale, etc.)';
COMMENT ON COLUMN public.customer_tags.color IS 'Tailwind color name for badge display';

-- ============================================
-- 3. CUSTOMER TAG ASSIGNMENTS (JUNCTION TABLE)
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_by uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Ensure each customer-tag combo is unique
  CONSTRAINT unique_customer_tag UNIQUE(customer_id, tag_id)
);

-- Add comments for documentation
COMMENT ON TABLE public.customer_tag_assignments IS 'Junction table linking customers to tags with audit tracking';
COMMENT ON COLUMN public.customer_tag_assignments.assigned_by IS 'Admin user who assigned this tag (for accountability)';

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_customer ON public.customer_tag_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_tag ON public.customer_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_name ON public.customer_tags(name);

-- ============================================
-- 5. UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.set_customer_tags_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_tags_updated_at ON public.customer_tags;
CREATE TRIGGER trg_customer_tags_updated_at
  BEFORE UPDATE ON public.customer_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_tags_updated_at();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Admins have full access to tags
DROP POLICY IF EXISTS "Admins full access to customer_tags" ON public.customer_tags;
CREATE POLICY "Admins full access to customer_tags" ON public.customer_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Admins have full access to tag assignments
DROP POLICY IF EXISTS "Admins full access to customer_tag_assignments" ON public.customer_tag_assignments;
CREATE POLICY "Admins full access to customer_tag_assignments" ON public.customer_tag_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tag_assignments TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
GRANT ALL ON public.customer_tag_assignments TO service_role;

-- ============================================
-- 8. SEED DEFAULT TAGS
-- ============================================
INSERT INTO public.customer_tags (name, color, description) VALUES
  ('VIP', 'purple', 'High-value customers requiring special attention'),
  ('School', 'blue', 'Educational institutions and school gardens'),
  ('Wholesale', 'emerald', 'Wholesale or bulk purchase customers'),
  ('Farmer''s Market', 'amber', 'Customers who attend our farmer''s market booth')
ON CONFLICT (name) DO NOTHING;
