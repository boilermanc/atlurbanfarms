-- Re-add tags column to newsletter_subscribers
-- The column was in the original migration but is missing from the live DB
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS tags text[];
