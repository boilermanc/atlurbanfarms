import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface NewsletterPayload {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  customer_id?: string | null;
  source?: string | null;
  status?: 'active' | 'unsubscribed' | 'bounced';
  tags?: string[] | null;
}

const VALID_STATUSES = ['active', 'unsubscribed', 'bounced'];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = (await req.json()) as NewsletterPayload;
    const rawEmail = payload.email?.toLowerCase().trim();

    if (!rawEmail) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = (payload.status ?? 'active').toLowerCase() as NewsletterPayload['status'];
    if (!VALID_STATUSES.includes(status as string)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status value' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, subscribed_at')
      .eq('email', rawEmail)
      .maybeSingle();

    const now = new Date().toISOString();
    const subscriberRecord: Record<string, unknown> = {
      email: rawEmail,
      first_name: payload.first_name?.trim() || null,
      last_name: payload.last_name?.trim() || null,
      customer_id: payload.customer_id || null,
      source: payload.source || (payload.customer_id ? 'account_profile' : 'footer'),
      status,
      subscribed_at: status === 'active' ? (existing?.subscribed_at ?? now) : existing?.subscribed_at ?? now,
      unsubscribed_at: status === 'active' ? null : now,
      updated_at: now,
    };

    // Only include tags if provided (avoids schema cache issues)
    if (payload.tags && payload.tags.length > 0) {
      subscriberRecord.tags = payload.tags;
    }

    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert(subscriberRecord, { onConflict: 'email' })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (payload.customer_id) {
      await supabaseAdmin
        .from('customers')
        .update({ newsletter_subscribed: status === 'active', updated_at: now })
        .eq('id', payload.customer_id);
    }

    return new Response(
      JSON.stringify({ success: true, subscriber: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('newsletter-subscribe error', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to update subscription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
