-- Fix: Add AZ to western states forced shipping override (UPS 3-Day Select)
-- Ref: https://github.com/boilermanc/atlurbanfarms/issues/58
--
-- AZ orders were being quoted UPS Ground at checkout, but AZ is far enough
-- from Atlanta that labels must be purchased as UPS 3-Day Select for plant
-- health. This caused ~$16 undercharges on every AZ order.

UPDATE config_settings
SET value = '{"service_code": "ups_3_day_select", "states": ["OR","CA","NV","UT","NE","WY","ID","ND","SD","WA","MT","AZ"]}'::jsonb,
    updated_at = now()
WHERE category = 'shipping'
  AND key = 'forced_service_overrides';
