-- Fix newsletter_subscribers unique constraint
-- The upsert requires a UNIQUE constraint on the column, not just a unique index on lower(email)

-- First, normalize all existing emails to lowercase to prevent duplicates
UPDATE public.newsletter_subscribers
SET email = lower(email)
WHERE email != lower(email);

-- Drop the existing unique INDEX (not constraint) on lower(email)
-- The original migration created an INDEX, not a CONSTRAINT
DROP INDEX IF EXISTS public.newsletter_subscribers_email_key;

-- Add a proper UNIQUE constraint directly on the email column
-- (edge function already normalizes emails to lowercase before storing)
ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_unique;

ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email);
