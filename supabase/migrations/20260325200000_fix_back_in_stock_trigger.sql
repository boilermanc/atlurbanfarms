-- ============================================
-- Fix back-in-stock trigger: pg_net schema & body type
-- Issue: #36 - Inventory alerts not sending emails
--
-- Root causes:
-- 1. Used extensions.http_post() but pg_net lives in net schema
-- 2. Passed body as text, pg_net expects jsonb
-- 3. Vault secret may not be configured — add anon key fallback
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_back_in_stock_notify()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INTEGER;
  service_key TEXT;
  anon_key TEXT;
  auth_key TEXT;
BEGIN
  -- Only fire when quantity goes from 0 (or NULL) to > 0
  IF (COALESCE(OLD.quantity_available, 0) = 0) AND (NEW.quantity_available > 0) THEN
    -- Check if there are pending alerts
    SELECT COUNT(*) INTO pending_count
    FROM public.back_in_stock_alerts
    WHERE product_id = NEW.id AND status = 'pending';

    IF pending_count > 0 THEN
      -- Try service role key from Vault first
      BEGIN
        SELECT decrypted_secret INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        service_key := NULL;
      END;

      -- Fall back to anon key if service key not available
      IF service_key IS NULL THEN
        BEGIN
          SELECT decrypted_secret INTO anon_key
          FROM vault.decrypted_secrets
          WHERE name = 'anon_key'
          LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          anon_key := NULL;
        END;
      END IF;

      auth_key := COALESCE(service_key, anon_key);

      -- Call the edge function via pg_net (correct schema: net)
      IF auth_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/back-in-stock-notify',
          body := json_build_object('product_id', NEW.id)::jsonb,
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || auth_key
          )::jsonb
        );
      ELSE
        -- Last resort: call without auth (works if function deployed with --no-verify-jwt)
        PERFORM net.http_post(
          url := 'https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/back-in-stock-notify',
          body := json_build_object('product_id', NEW.id)::jsonb,
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (function replacement is in-place, but ensure trigger exists)
DROP TRIGGER IF EXISTS trg_back_in_stock_notify ON public.products;
CREATE TRIGGER trg_back_in_stock_notify
  AFTER UPDATE OF quantity_available ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_back_in_stock_notify();
