import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface NewsletterPayload {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  customer_id?: string | null;
  source?: string | null;
  status?: 'active' | 'unsubscribed' | 'bounced' | 'pending';
  tags?: string[] | null;
  consent_text?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

const VALID_STATUSES = ['active', 'unsubscribed', 'bounced', 'pending'];
// Sources where the user is already authenticated — skip double opt-in
const DIRECT_ACTIVATE_SOURCES = ['account_profile', 'order_confirmation'];
// Minimum seconds between resending confirmation emails to the same address
const RESEND_COOLDOWN_SECONDS = 300; // 5 minutes
// How long confirmation tokens are valid
const TOKEN_EXPIRY_HOURS = 48;

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** Generate a cryptographically random 32-byte hex token and its SHA-256 hash */
async function generateToken(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { raw, hash };
}

/** Generate an unsubscribe token (stored in plaintext — benign action) */
function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Send the double-opt-in confirmation email via resend-send-email */
async function sendConfirmationEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  firstName: string | null,
  confirmationToken: string,
) {
  const confirmUrl = `${supabaseUrl}/functions/v1/newsletter-confirm?token=${confirmationToken}`;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: email,
      template: 'newsletter_confirmation',
      templateData: {
        first_name: firstName || '',
        confirmation_url: confirmUrl,
      },
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    console.error('Failed to send confirmation email:', result);
    throw new Error('Failed to send confirmation email');
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const payload = (await req.json()) as NewsletterPayload;
    const rawEmail = payload.email?.toLowerCase().trim();

    if (!rawEmail) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Extract IP and user-agent from request for consent logging
    const ipAddress = payload.ip_address
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || null;
    const userAgent = payload.user_agent || req.headers.get('user-agent') || null;

    const requestedStatus = (payload.status ?? 'active').toLowerCase() as string;

    // Handle explicit unsubscribe requests (from account profile toggle-off)
    if (requestedStatus === 'unsubscribed') {
      return await handleUnsubscribe(supabaseUrl, serviceKey, rawEmail, payload, ipAddress, userAgent);
    }

    if (!VALID_STATUSES.includes(requestedStatus)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status value' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const source = payload.source || (payload.customer_id ? 'account_profile' : 'footer');
    const skipDoubleOptIn = DIRECT_ACTIVATE_SOURCES.includes(source);

    // Check for existing subscriber
    const { data: existing } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, status, subscribed_at, updated_at, unsubscribe_token')
      .eq('email', rawEmail)
      .maybeSingle();

    const now = new Date().toISOString();

    // --- Case 1: Already active subscriber ---
    if (existing?.status === 'active') {
      // Update name/customer_id if provided, but don't change status
      const updates: Record<string, unknown> = { updated_at: now };
      if (payload.first_name) updates.first_name = payload.first_name.trim();
      if (payload.last_name) updates.last_name = payload.last_name.trim();
      if (payload.customer_id) updates.customer_id = payload.customer_id;

      await supabaseAdmin
        .from('newsletter_subscribers')
        .update(updates)
        .eq('id', existing.id);

      return new Response(
        JSON.stringify({ success: true, status: 'active', message: 'Already subscribed' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // --- Case 2: Pending subscriber — resend confirmation (with cooldown) ---
    if (existing?.status === 'pending' && !skipDoubleOptIn) {
      const lastUpdated = new Date(existing.updated_at).getTime();
      const secondsSinceUpdate = (Date.now() - lastUpdated) / 1000;

      if (secondsSinceUpdate < RESEND_COOLDOWN_SECONDS) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'pending',
            message: 'Confirmation email already sent. Please check your inbox.',
          }),
          { status: 200, headers: jsonHeaders }
        );
      }

      // Generate new confirmation token and resend
      const confirmToken = await generateToken();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      await supabaseAdmin
        .from('newsletter_subscribers')
        .update({
          confirmation_token_hash: confirmToken.hash,
          confirmation_token_expires_at: expiresAt,
          updated_at: now,
        })
        .eq('id', existing.id);

      await sendConfirmationEmail(supabaseUrl, serviceKey, rawEmail, payload.first_name?.trim() || null, confirmToken.raw);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          message: 'Confirmation email resent. Please check your inbox.',
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // --- Case 3: New subscriber or re-subscribing (was unsubscribed/bounced) ---
    const confirmToken = await generateToken();
    const unsubToken = existing?.unsubscribe_token || generateUnsubscribeToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const subscriberRecord: Record<string, unknown> = {
      email: rawEmail,
      first_name: payload.first_name?.trim() || null,
      last_name: payload.last_name?.trim() || null,
      customer_id: payload.customer_id || null,
      source,
      unsubscribe_token: unsubToken,
      updated_at: now,
    };

    if (payload.tags && payload.tags.length > 0) {
      subscriberRecord.tags = payload.tags;
    }

    if (skipDoubleOptIn) {
      // Authenticated context — activate immediately
      subscriberRecord.status = 'active';
      subscriberRecord.subscribed_at = existing?.subscribed_at ?? now;
      subscriberRecord.confirmed_at = now;
      subscriberRecord.unsubscribed_at = null;
      subscriberRecord.confirmation_token_hash = null;
      subscriberRecord.confirmation_token_expires_at = null;
    } else {
      // Public context — require email confirmation
      subscriberRecord.status = 'pending';
      subscriberRecord.subscribed_at = existing?.subscribed_at ?? now;
      subscriberRecord.confirmation_token_hash = confirmToken.hash;
      subscriberRecord.confirmation_token_expires_at = expiresAt;
    }

    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert(subscriberRecord, { onConflict: 'email' })
      .select('id')
      .single();

    if (error) throw error;

    // Sync customer record for authenticated sources
    if (payload.customer_id && skipDoubleOptIn) {
      await supabaseAdmin
        .from('customers')
        .update({ newsletter_subscribed: true, updated_at: now })
        .eq('id', payload.customer_id);
    }

    // Log consent
    await supabaseAdmin.from('newsletter_consent_log').insert({
      subscriber_id: data.id,
      action: 'subscribe',
      source,
      ip_address: ipAddress,
      user_agent: userAgent,
      consent_text: payload.consent_text || 'Receive newsletters, growing tips, and promotional content from ATL Urban Farms',
    });

    // Send confirmation email for non-authenticated sources
    if (!skipDoubleOptIn) {
      await sendConfirmationEmail(supabaseUrl, serviceKey, rawEmail, payload.first_name?.trim() || null, confirmToken.raw);
    }

    const responseStatus = skipDoubleOptIn ? 'active' : 'pending';
    const responseMessage = skipDoubleOptIn
      ? 'Subscribed successfully'
      : 'Please check your email to confirm your subscription.';

    return new Response(
      JSON.stringify({ success: true, status: responseStatus, message: responseMessage }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error('newsletter-subscribe error', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to update subscription' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

/** Handle explicit unsubscribe requests (e.g., account profile toggle-off) */
async function handleUnsubscribe(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  payload: NewsletterPayload,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<Response> {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (!existing) {
    return new Response(
      JSON.stringify({ success: true, message: 'Not subscribed' }),
      { status: 200, headers: jsonHeaders }
    );
  }

  if (existing.status === 'unsubscribed') {
    return new Response(
      JSON.stringify({ success: true, message: 'Already unsubscribed' }),
      { status: 200, headers: jsonHeaders }
    );
  }

  await supabaseAdmin
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: now,
      updated_at: now,
      confirmation_token_hash: null,
      confirmation_token_expires_at: null,
    })
    .eq('id', existing.id);

  if (payload.customer_id) {
    await supabaseAdmin
      .from('customers')
      .update({ newsletter_subscribed: false, updated_at: now })
      .eq('id', payload.customer_id);
  }

  await supabaseAdmin.from('newsletter_consent_log').insert({
    subscriber_id: existing.id,
    action: 'unsubscribe',
    source: payload.source || 'account_profile',
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return new Response(
    JSON.stringify({ success: true, status: 'unsubscribed', message: 'Unsubscribed successfully' }),
    { status: 200, headers: jsonHeaders }
  );
}
