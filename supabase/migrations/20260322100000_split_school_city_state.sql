-- Split city/state into separate columns on school_profiles (issue #21)

ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Backfill from school_district where it looks like "City, ST"
UPDATE public.school_profiles
SET
  city  = TRIM(split_part(school_district, ',', 1)),
  state = TRIM(split_part(school_district, ',', 2))
WHERE school_district IS NOT NULL
  AND school_district LIKE '%,%'
  AND city IS NULL;
