-- Migration: Add customer profile columns to customers table
-- Created: 2026-02-03
-- Description: Adds growing profile fields that were missing from customers table
-- Fixes: "Could not find the 'experience_level' column of 'customers' in the schema cache"

-- ============================================
-- ADD PROFILE COLUMNS TO CUSTOMERS TABLE
-- ============================================

-- Experience level for gardening
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS experience_level TEXT;

-- Growing environment (indoor, outdoor, both)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS growing_environment TEXT;

-- Growing systems used (array of values like 'soil', 'hydroponics', etc.)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS growing_systems TEXT[];

-- Growing interests (array of values like 'vegetables', 'herbs', etc.)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS growing_interests TEXT[];

-- ============================================
-- ADD CONSTRAINT FOR VALID VALUES
-- ============================================

-- Add check constraint for experience_level valid values
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_experience_level_check;

ALTER TABLE customers
ADD CONSTRAINT customers_experience_level_check
CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'advanced', 'expert'));

-- Add check constraint for growing_environment valid values
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_growing_environment_check;

ALTER TABLE customers
ADD CONSTRAINT customers_growing_environment_check
CHECK (growing_environment IS NULL OR growing_environment IN ('indoor', 'outdoor', 'both'));

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN customers.experience_level IS 'Customer gardening experience level: beginner, intermediate, advanced, expert';
COMMENT ON COLUMN customers.growing_environment IS 'Where customer grows: indoor, outdoor, or both';
COMMENT ON COLUMN customers.growing_systems IS 'Array of growing systems used: soil, raised_beds, containers, hydroponics, aquaponics, vertical, greenhouse';
COMMENT ON COLUMN customers.growing_interests IS 'Array of growing interests: vegetables, herbs, fruits, flowers, microgreens, mushrooms, native_plants, succulents';
