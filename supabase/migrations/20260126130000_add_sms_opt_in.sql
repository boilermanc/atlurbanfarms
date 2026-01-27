-- Add SMS opt-in column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opt_in boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN customers.sms_opt_in IS 'Customer consent to receive SMS notifications about orders';
