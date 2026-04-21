-- Migration: Update Large Box dimensions to 12x9x10 and extend quantity range to 21-40
-- Ref: https://github.com/boilermanc/atlurbanfarms/issues/80
--
-- Previously Large Box topped out at max_quantity=24 with 16x12x8 dimensions.
-- Orders above 24 seedlings fell back to the Medium Box (is_default) — visibly
-- undersized for larger shipments. New policy per Sheree:
--   Small:  1-10    (8x6x4)    — unchanged
--   Medium: 11-20   (12x9x5)   — unchanged
--   Large:  21-40   (12x9x10)  — this migration
--   41+             handled as multi-box shipments (manual for now)

UPDATE shipping_packages
SET length = 12,
    width = 9,
    height = 10,
    max_quantity = 40,
    updated_at = now()
WHERE name = 'Large Box';
