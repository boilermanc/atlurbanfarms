import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GIFTUP_API_KEY = Deno.env.get("GIFTUP_API_KEY");
    if (!GIFTUP_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "CONFIG_ERROR", message: "Gift Up API key not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Connection test (no body needed) ---
    // Called from Integrations page: GET /giftup-validate?action=ping
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "ping") {
      const res = await fetch("https://api.giftup.app/company", {
        headers: {
          Authorization: `Bearer ${GIFTUP_API_KEY}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "API_ERROR", message: `Gift Up returned ${res.status}` } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const company = await res.json();
      return new Response(
        JSON.stringify({ success: true, company }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Validate a gift card code ---
    // Called from checkout or admin test panel: POST with { code, testMode? }
    const body = await req.json();
    const { code, testMode = false } = body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "MISSING_CODE", message: "Gift card code is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const giftupHeaders: Record<string, string> = {
      Authorization: `Bearer ${GIFTUP_API_KEY}`,
      Accept: "application/json",
    };
    if (testMode) {
      giftupHeaders["x-giftup-testmode"] = "true";
    }

    const giftupRes = await fetch(
      `https://api.giftup.app/gift-cards/${encodeURIComponent(code.trim().toUpperCase())}`,
      { headers: giftupHeaders }
    );

    if (giftupRes.status === 404) {
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          error: { code: "NOT_FOUND", message: "Gift card code not found" },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!giftupRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "API_ERROR", message: `Gift Up returned ${giftupRes.status}` },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const card = await giftupRes.json();

    // Determine user-facing status message
    let errorMessage: string | null = null;
    if (card.isVoided) {
      errorMessage = "This gift card has been voided and is no longer valid.";
    } else if (card.notYetValid) {
      errorMessage = "This gift card is not yet valid.";
    } else if (!card.canBeRedeemed && card.remainingValue === 0) {
      errorMessage = "This gift card has already been fully redeemed.";
    } else if (!card.canBeRedeemed) {
      errorMessage = "This gift card cannot be redeemed.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: card.canBeRedeemed && !card.isVoided && !card.notYetValid,
        canBeRedeemed: card.canBeRedeemed,
        hasExpired: card.hasExpired,
        notYetValid: card.notYetValid,
        isVoided: card.isVoided,
        code: card.code,
        remainingValue: card.remainingValue,
        initialValue: card.initialValue,
        title: card.title,
        recipientName: card.recipientName,
        expiresOn: card.expiresOn,
        errorMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
