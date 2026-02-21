-- Fix: upsert on abandoned_carts requires SELECT for ON CONFLICT resolution.
-- Without this policy, anonymous users get 403 on the upsert.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandoned_carts' AND policyname = 'Anyone can select abandoned carts for upsert') THEN
    CREATE POLICY "Anyone can select abandoned carts for upsert"
        ON public.abandoned_carts
        FOR SELECT
        TO public
        USING (true);
  END IF;
END $$;
