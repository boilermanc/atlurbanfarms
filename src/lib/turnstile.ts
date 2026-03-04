import { supabase } from './supabase';

export async function verifyTurnstileToken(token: string): Promise<true> {
  const { data, error } = await supabase.functions.invoke('verify-turnstile', {
    body: { token },
  });

  if (error) {
    throw 'Verification failed. Please refresh the page and try again.';
  }

  if (!data?.success) {
    throw data?.error?.message || 'CAPTCHA verification failed. Please try again.';
  }

  return true;
}

export function isTurnstileEnabled(): boolean {
  return !!import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;
}
