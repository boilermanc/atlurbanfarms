-- Add fields needed for School Partner signup page

-- school_profiles may have been created via Supabase UI; ensure status + imported columns exist
ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied'));

ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS imported_from_mailchimp BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for admin review queue (future)
CREATE INDEX IF NOT EXISTS idx_school_profiles_status
  ON public.school_profiles (status)
  WHERE status = 'pending';

-- Add referral_source to customers for "how did you hear about us"
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- RLS: allow authenticated users to insert their own school profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_profiles'
      AND policyname = 'Users can insert own school profile'
  ) THEN
    CREATE POLICY "Users can insert own school profile"
      ON public.school_profiles FOR INSERT
      TO authenticated
      WITH CHECK (customer_id = auth.uid());
  END IF;
END $$;

-- RLS: allow users to update their own school profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_profiles'
      AND policyname = 'Users can update own school profile'
  ) THEN
    CREATE POLICY "Users can update own school profile"
      ON public.school_profiles FOR UPDATE
      TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;
END $$;

-- RLS: allow users to read their own school profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_profiles'
      AND policyname = 'Users can read own school profile'
  ) THEN
    CREATE POLICY "Users can read own school profile"
      ON public.school_profiles FOR SELECT
      TO authenticated
      USING (customer_id = auth.uid());
  END IF;
END $$;

-- RLS: admin access to all school profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_profiles'
      AND policyname = 'Admins can manage all school profiles'
  ) THEN
    CREATE POLICY "Admins can manage all school profiles"
      ON public.school_profiles FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_user_roles
          WHERE customer_id = auth.uid() AND is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_user_roles
          WHERE customer_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;
