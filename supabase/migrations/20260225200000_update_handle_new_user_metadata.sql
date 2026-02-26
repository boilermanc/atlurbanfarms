-- Update handle_new_user() to capture first_name, last_name, and newsletter_subscribed
-- from the user's raw_user_meta_data (set via auth.signUp options.data).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.customers (id, email, first_name, last_name, newsletter_subscribed)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE((NEW.raw_user_meta_data->>'newsletter_subscribed')::boolean, true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
