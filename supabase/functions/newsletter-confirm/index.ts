import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SITE_URL = 'https://deux.atlurbanfarms.com';
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** SHA-256 hash a string and return hex */
async function sha256(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only GET requests (clicked from email)
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: jsonHeaders }
    );
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=invalid`, 302);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase credentials');
      return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=error`, 302);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const tokenHash = await sha256(token);

    // Look up subscriber by confirmation token hash
    const { data: subscriber, error: lookupError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, email, first_name, status, source, tags, customer_id, confirmation_token_expires_at')
      .eq('confirmation_token_hash', tokenHash)
      .maybeSingle();

    if (lookupError) {
      console.error('Token lookup error:', lookupError);
      return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=error`, 302);
    }

    if (!subscriber) {
      return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=invalid`, 302);
    }

    // Already confirmed
    if (subscriber.status === 'active') {
      return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=already-active`, 302);
    }

    // Token expired
    if (subscriber.confirmation_token_expires_at) {
      const expiresAt = new Date(subscriber.confirmation_token_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=expired`, 302);
      }
    }

    // Confirm the subscription
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        status: 'active',
        confirmed_at: now,
        confirmation_token_hash: null,
        confirmation_token_expires_at: null,
        unsubscribed_at: null,
        updated_at: now,
      })
      .eq('id', subscriber.id);

    if (updateError) {
      console.error('Confirmation update error:', updateError);
      return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=error`, 302);
    }

    // Sync customer record if linked
    if (subscriber.customer_id) {
      await supabaseAdmin
        .from('customers')
        .update({ newsletter_subscribed: true, updated_at: now })
        .eq('id', subscriber.customer_id);
    }

    // Log consent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || null;

    await supabaseAdmin.from('newsletter_consent_log').insert({
      subscriber_id: subscriber.id,
      action: 'confirm',
      source: 'email_confirmation',
      ip_address: ipAddress,
      user_agent: req.headers.get('user-agent') || null,
    });

    // If this was a lead magnet signup, send the lead magnet email now
    if (subscriber.source === 'lead_magnet' && subscriber.tags?.includes('tower_garden_guide_2026')) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/resend-send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: subscriber.email,
            template: 'lead_magnet_tower_garden',
            templateData: {
              first_name: subscriber.first_name || '',
            },
          }),
        });
      } catch (err) {
        // Don't fail the confirmation if lead magnet email fails
        console.error('Failed to send lead magnet email:', err);
      }
    }

    return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=success`, 302);
  } catch (err) {
    console.error('newsletter-confirm error:', err);
    return Response.redirect(`${SITE_URL}/newsletter/confirmed?status=error`, 302);
  }
});
