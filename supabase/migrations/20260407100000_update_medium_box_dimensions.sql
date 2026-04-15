-- Migration: Update medium box dimensions to 12x9x5 and quantity range to 11-20
-- Ref: https://github.com/boilermanc/atlurbanfarms/issues/62
-- Adjusts all box quantity ranges to remain contiguous:
--   Small:  1-10
--   Medium: 11-20
--   Large:  21-24

-- Update Medium Box dimensions and quantity range
UPDATE shipping_packages
SET length = 12,
    width = 9,
    height = 5,
    min_quantity = 11,
    max_quantity = 20,
    updated_at = now()
WHERE name = 'Medium Box';

-- Expand Small Box range to cover 1-10 (was 1-4)
UPDATE shipping_packages
SET max_quantity = 10,
    updated_at = now()
WHERE name = 'Small Box';

-- Shift Large Box range to start at 21 (was 13)
UPDATE shipping_packages
SET min_quantity = 21,
    updated_at = now()
WHERE name = 'Large Box';
