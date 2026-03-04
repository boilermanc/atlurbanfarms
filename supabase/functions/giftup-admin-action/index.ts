import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "sync" | "void" | "topup" | "reactivate" | "add_note";

function deriveStatus(data: any): string {
  if (data.isVoided) return "disabled";
  if (data.remainingValue === 0) return "depleted";
  if (data.hasExpired) return "depleted";
  if (!data.canBeRedeemed) return "disabled";
  return "active";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const GIFTUP_API_KEY = Deno.env.get("GIFTUP_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!GIFTUP_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: { code: "CONFIG_ERROR", message: "Missing required environment variables" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify the caller is authenticated
  const authHeader = req.headers.get("Authorization");
  const { data: { user } } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "") ?? ""
  );
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, code, gift_card_id, amount, note } = body;

    if (!action || !code || !gift_card_id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "MISSING_PARAMS", message: "action, code, and gift_card_id are required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions: Action[] = ["sync", "void", "topup", "reactivate", "add_note"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "INVALID_ACTION", message: `Action must be one of: ${validActions.join(", ")}` } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check test mode from config
    const { data: testModeConfig } = await supabase
      .from("config_settings")
      .select("value")
      .eq("category", "giftup")
      .eq("key", "test_mode")
      .single();

    const testMode = testModeConfig?.value === true;

    const giftupHeaders: Record<string, string> = {
      Authorization: `Bearer ${GIFTUP_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (testMode) {
      giftupHeaders["x-giftup-testmode"] = "true";
    }

    const encodedCode = encodeURIComponent(code.trim().toUpperCase());

    // --- SYNC: fetch latest card data from Gift Up ---
    if (action === "sync") {
      const res = await fetch(`https://api.giftup.app/gift-cards/${encodedCode}`, {
        headers: giftupHeaders,
      });

      if (res.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Gift card not found in Gift Up" } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: { code: "GIFTUP_ERROR", message: `Gift Up returned ${res.status}`, details: errorBody } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const card = await res.json();

      await supabase
        .from("gift_cards")
        .update({
          current_balance: card.remainingValue ?? 0,
          initial_balance: card.initialValue ?? undefined,
          status: deriveStatus(card),
          recipient_name: card.recipientName || undefined,
          recipient_email: card.recipientEmail || undefined,
          purchaser_email: card.purchaserEmail || undefined,
          expires_at: card.expiresOn || null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", gift_card_id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "sync",
          currentBalance: card.remainingValue,
          status: deriveStatus(card),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- VOID: void the gift card ---
    if (action === "void") {
      const res = await fetch(`https://api.giftup.app/gift-cards/${encodedCode}/void`, {
        method: "POST",
        headers: giftupHeaders,
        body: JSON.stringify({
          reason: "Voided by admin — ATL Urban Farms",
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: { code: "GIFTUP_VOID_FAILED", message: `Gift Up returned ${res.status}`, details: errorBody } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();

      await supabase
        .from("gift_cards")
        .update({
          status: "disabled",
          current_balance: data.remainingValue ?? 0,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", gift_card_id);

      return new Response(
        JSON.stringify({ success: true, action: "void" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- TOPUP: add balance ---
    if (action === "topup") {
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "INVALID_AMOUNT", message: "amount must be a positive number" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`https://api.giftup.app/gift-cards/${encodedCode}/top-up`, {
        method: "POST",
        headers: giftupHeaders,
        body: JSON.stringify({
          amount,
          reason: "Admin top-up — ATL Urban Farms",
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: { code: "GIFTUP_TOPUP_FAILED", message: `Gift Up returned ${res.status}`, details: errorBody } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();

      await supabase
        .from("gift_cards")
        .update({
          current_balance: data.remainingValue ?? undefined,
          status: deriveStatus(data),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", gift_card_id);

      // Record transaction locally
      await supabase
        .from("gift_card_transactions")
        .insert({
          gift_card_id,
          amount,
          balance_after: data.remainingValue ?? 0,
          type: "adjustment",
          notes: `Admin top-up: $${amount.toFixed(2)}`,
          created_by: user.id,
        });

      return new Response(
        JSON.stringify({
          success: true,
          action: "topup",
          addedAmount: amount,
          newBalance: data.remainingValue,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- REACTIVATE: reactivate a voided card ---
    if (action === "reactivate") {
      const res = await fetch(`https://api.giftup.app/gift-cards/${encodedCode}/reactivate`, {
        method: "POST",
        headers: giftupHeaders,
        body: JSON.stringify({
          reason: "Reactivated by admin — ATL Urban Farms",
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: { code: "GIFTUP_REACTIVATE_FAILED", message: `Gift Up returned ${res.status}`, details: errorBody } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();

      await supabase
        .from("gift_cards")
        .update({
          status: deriveStatus(data),
          current_balance: data.remainingValue ?? undefined,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", gift_card_id);

      return new Response(
        JSON.stringify({ success: true, action: "reactivate", newBalance: data.remainingValue }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ADD_NOTE: add a note (no balance change) ---
    if (action === "add_note") {
      if (!note || typeof note !== "string" || !note.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "MISSING_NOTE", message: "note is required" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record as a zero-amount transaction locally
      const { data: currentCard } = await supabase
        .from("gift_cards")
        .select("current_balance")
        .eq("id", gift_card_id)
        .single();

      await supabase
        .from("gift_card_transactions")
        .insert({
          gift_card_id,
          amount: 0,
          balance_after: currentCard?.current_balance ?? 0,
          type: "adjustment",
          notes: note.trim(),
          created_by: user.id,
        });

      return new Response(
        JSON.stringify({ success: true, action: "add_note" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: { code: "UNKNOWN_ACTION", message: "Unknown action" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
