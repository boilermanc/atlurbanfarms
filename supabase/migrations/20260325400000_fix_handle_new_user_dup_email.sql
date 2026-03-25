-- Fix handle_new_user() to handle pre-existing customer records with the same email
-- (e.g., from WooCommerce import or guest checkout).
-- Instead of failing on email unique constraint, claim the existing record for the auth user.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- First check if a customer with this email already exists (e.g., from WooCommerce import)
  IF EXISTS (SELECT 1 FROM public.customers WHERE email = NEW.email) THEN
    -- Claim the existing customer record for this auth account
    UPDATE public.customers
    SET
      id = NEW.id,
      first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
      last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
      newsletter_subscribed = COALESCE((NEW.raw_user_meta_data->>'newsletter_subscribed')::boolean, newsletter_subscribed),
      updated_at = now()
    WHERE email = NEW.email;
  ELSE
    INSERT INTO public.customers (id, email, first_name, last_name, newsletter_subscribed)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      COALESCE((NEW.raw_user_meta_data->>'newsletter_subscribed')::boolean, true)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
