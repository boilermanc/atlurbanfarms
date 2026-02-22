import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SITE_URL = 'https://deux.atlurbanfarms.com';
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: jsonHeaders });
    }
    return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=invalid`, 302);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase credentials');
      if (req.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: jsonHeaders });
      }
      return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=error`, 302);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Look up subscriber by unsubscribe token (stored in plaintext)
    const { data: subscriber, error: lookupError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, email, status, customer_id')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (lookupError) {
      console.error('Unsubscribe token lookup error:', lookupError);
      if (req.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: jsonHeaders });
      }
      return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=error`, 302);
    }

    if (!subscriber) {
      if (req.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: jsonHeaders });
      }
      return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=invalid`, 302);
    }

    // Already unsubscribed
    if (subscriber.status === 'unsubscribed') {
      if (req.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
      }
      return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=already`, 302);
    }

    // Process the unsubscribe
    const now = new Date().toISOString();

    await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: now,
        confirmation_token_hash: null,
        confirmation_token_expires_at: null,
        updated_at: now,
      })
      .eq('id', subscriber.id);

    // Sync customer record
    if (subscriber.customer_id) {
      await supabaseAdmin
        .from('customers')
        .update({ newsletter_subscribed: false, updated_at: now })
        .eq('id', subscriber.customer_id);
    }

    // Log consent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || null;

    await supabaseAdmin.from('newsletter_consent_log').insert({
      subscriber_id: subscriber.id,
      action: 'unsubscribe',
      source: req.method === 'POST' ? 'one_click_unsubscribe' : 'email_unsubscribe_link',
      ip_address: ipAddress,
      user_agent: req.headers.get('user-agent') || null,
    });

    // POST = one-click unsubscribe (RFC 8058) — return 200
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
    }

    // GET = clicked link in email — redirect to branded page
    return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=success`, 302);
  } catch (err) {
    console.error('newsletter-unsubscribe error:', err);
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: jsonHeaders });
    }
    return Response.redirect(`${SITE_URL}/newsletter/unsubscribed?status=error`, 302);
  }
});
