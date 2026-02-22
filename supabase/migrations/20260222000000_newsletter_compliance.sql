-- Newsletter Email Compliance Migration
-- Adds double opt-in, unsubscribe tokens, and consent logging
-- Existing active subscribers are grandfathered (no re-confirmation required)

-- 1. Add 'pending' to the status CHECK constraint
-- The original CHECK was inline: CHECK (status IN ('active','unsubscribed','bounced'))
-- PostgreSQL auto-names these; drop all possible names then re-add
DO $$
BEGIN
  -- Drop the inline check constraint (auto-named by postgres)
  EXECUTE (
    SELECT 'ALTER TABLE public.newsletter_subscribers DROP CONSTRAINT ' || quote_ident(conname)
    FROM pg_constraint
    WHERE conrelid = 'public.newsletter_subscribers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No status check constraint found to drop: %', SQLERRM;
END;
$$;

ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_status_check
  CHECK (status IN ('active', 'unsubscribed', 'bounced', 'pending'));

-- 2. Add confirmation and unsubscribe token columns
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token_hash text,
  ADD COLUMN IF NOT EXISTS confirmation_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text;

-- 3. Indexes for token lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_confirmation_token
  ON public.newsletter_subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token
  ON public.newsletter_subscribers (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;

-- 4. Index for cleaning up expired pending subscribers
CREATE INDEX IF NOT EXISTS idx_newsletter_pending_expires
  ON public.newsletter_subscribers (confirmation_token_expires_at)
  WHERE status = 'pending';

-- 5. Generate unsubscribe tokens for existing active subscribers
-- so they can receive unsubscribe links in future emails
UPDATE public.newsletter_subscribers
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE status = 'active' AND unsubscribe_token IS NULL;

-- 6. Create consent log table
CREATE TABLE IF NOT EXISTS public.newsletter_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('subscribe', 'confirm', 'unsubscribe', 'resubscribe', 'bounced', 'complained')),
  source text,
  ip_address inet,
  user_agent text,
  consent_text text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_consent_log_subscriber
  ON public.newsletter_consent_log (subscriber_id);

CREATE INDEX IF NOT EXISTS idx_consent_log_action
  ON public.newsletter_consent_log (action);

-- 7. RLS for consent_log
ALTER TABLE public.newsletter_consent_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access implicitly; add admin read policy
CREATE POLICY "Admins can read consent_log"
  ON public.newsletter_consent_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Grant permissions
GRANT SELECT ON public.newsletter_consent_log TO authenticated;
GRANT ALL ON public.newsletter_consent_log TO service_role;

-- 8. Document grandfathering decision
COMMENT ON TABLE public.newsletter_subscribers IS
  'Newsletter subscriber management. Existing active subscribers as of 2026-02-22 are grandfathered without double opt-in. All new subscribers require email confirmation.';
