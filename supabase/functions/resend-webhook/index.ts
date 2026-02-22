import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    // Extract recipient email — Resend sends `to` as an array of strings
    const recipientEmail = (Array.isArray(data.to) ? data.to[0] : data.to)?.toLowerCase();

    if (!recipientEmail) {
      console.warn('Resend webhook missing recipient email:', type);
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: jsonHeaders });
    }

    // Look up subscriber
    const { data: subscriber } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, status, customer_id')
      .eq('email', recipientEmail)
      .maybeSingle();

    if (!subscriber) {
      // Not a newsletter subscriber — could be a transactional email recipient
      console.log(`Resend webhook ${type} for non-subscriber: ${recipientEmail}`);
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: jsonHeaders });
    }

    switch (type) {
      case 'email.bounced': {
        // Hard bounce — mark as bounced to stop future sends
        if (subscriber.status !== 'bounced') {
          await supabaseAdmin
            .from('newsletter_subscribers')
            .update({
              status: 'bounced',
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
        }

        // Log the bounce
        await supabaseAdmin.from('newsletter_consent_log').insert({
          subscriber_id: subscriber.id,
          action: 'bounced',
          source: 'resend_webhook',
          consent_text: `Hard bounce: ${data.bounce_type || 'unknown'}`,
        });

        console.log(`Marked ${recipientEmail} as bounced`);
        break;
      }

      case 'email.complained': {
        // Spam complaint — treat as unsubscribe
        if (subscriber.status !== 'unsubscribed') {
          await supabaseAdmin
            .from('newsletter_subscribers')
            .update({
              status: 'unsubscribed',
              unsubscribed_at: now,
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
        }

        // Log the complaint
        await supabaseAdmin.from('newsletter_consent_log').insert({
          subscriber_id: subscriber.id,
          action: 'complained',
          source: 'resend_webhook',
          consent_text: 'Spam complaint received via Resend',
        });

        console.log(`Unsubscribed ${recipientEmail} due to spam complaint`);
        break;
      }

      default:
        console.log(`Unhandled Resend webhook event: ${type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error('resend-webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
