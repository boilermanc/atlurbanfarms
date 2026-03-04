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

  try {
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "MISSING_PARAMS", message: "order_id is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Load order ---
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, gift_card_code, gift_card_amount, giftup_transaction_id")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Guard: no gift card on this order ---
    if (!order.gift_card_code || !order.giftup_transaction_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "NO_GIFT_CARD", message: "This order has no gift card redemption to undo" }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Check test mode ---
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

    // --- Call Gift Up undo-redemption ---
    const undoRes = await fetch(
      `https://api.giftup.app/gift-cards/${encodeURIComponent(order.gift_card_code)}/undo-redemption`,
      {
        method: "POST",
        headers: giftupHeaders,
        body: JSON.stringify({
          transactionId: order.giftup_transaction_id,
          reason: `Order ${order.order_number} cancelled/refunded — ATL Urban Farms`,
          metadata: {
            order_id,
            order_number: order.order_number,
            platform: "atlurbanfarms",
          },
        }),
      }
    );

    if (!undoRes.ok) {
      const errorBody = await undoRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "GIFTUP_UNDO_FAILED",
            message: `Gift Up returned ${undoRes.status}`,
            details: errorBody,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const undoData = await undoRes.json();

    // --- Clear gift card fields on order if fully reversed ---
    if (!undoData.alreadyReversed) {
      await supabase
        .from("orders")
        .update({
          giftup_transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      // --- Update local gift_cards cache ---
      await supabase
        .from("gift_cards")
        .update({
          current_balance: undoData.remainingCredit,
          status: "active",
          last_synced_at: new Date().toISOString(),
        })
        .eq("code", order.gift_card_code);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alreadyReversed: undoData.alreadyReversed,
        amountReversed: undoData.amountReversed,
        remainingCredit: undoData.remainingCredit,
        giftCardCode: order.gift_card_code,
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
