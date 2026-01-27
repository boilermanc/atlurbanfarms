-- Fix newsletter_subscribers unique constraint (resolves upsert failures)
-- The previous fix migration tried to drop a CONSTRAINT but the original created an INDEX

-- Normalize any mixed-case emails first
UPDATE public.newsletter_subscribers
SET email = lower(email)
WHERE email != lower(email);

-- Drop the problematic unique INDEX on lower(email) that was never removed
DROP INDEX IF EXISTS public.newsletter_subscribers_email_key;

-- Ensure the correct UNIQUE constraint exists on email column
-- (drop first to avoid error if it already exists)
ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_unique;

ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email);
