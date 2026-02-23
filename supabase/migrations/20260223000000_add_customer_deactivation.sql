-- Add customer deactivation support for admin user management
-- Enables soft-disabling accounts (reversible) and supports GDPR data wipe workflow

-- Add deactivation columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES customers(id);

-- Index for filtering active/deactivated customers in admin views
CREATE INDEX IF NOT EXISTS idx_customers_deactivated ON customers(is_deactivated);
