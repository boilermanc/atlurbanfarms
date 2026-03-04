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
    const { order_id, code, amount } = body;

    // --- Validate inputs ---
    if (!order_id || !code || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "MISSING_PARAMS", message: "order_id, code, and amount are required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "INVALID_AMOUNT", message: "amount must be a positive number" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Check order exists ---
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, gift_card_code, giftup_transaction_id, total")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Guard: already redeemed ---
    if (order.giftup_transaction_id) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyRedeemed: true,
          message: "Gift card already redeemed for this order",
          transactionId: order.giftup_transaction_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Check test mode from config ---
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

    // --- Call Gift Up redeem API ---
    const redeemRes = await fetch(
      `https://api.giftup.app/gift-cards/${encodeURIComponent(code.trim().toUpperCase())}/redeem`,
      {
        method: "POST",
        headers: giftupHeaders,
        body: JSON.stringify({
          amount,
          reason: `Order ${order.order_number} — ATL Urban Farms`,
          metadata: {
            order_id,
            order_number: order.order_number,
            platform: "atlurbanfarms",
          },
        }),
      }
    );

    // --- Handle Gift Up errors ---
    if (!redeemRes.ok) {
      const errorBody = await redeemRes.json().catch(() => ({}));

      // Flag the order for manual review — do NOT fail the order
      await supabase
        .from("orders")
        .update({
          internal_notes: `GIFT CARD REDEMPTION FAILED — code: ${code}, amount: ${amount}, error: ${JSON.stringify(errorBody)}. Requires manual reconciliation.`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: false,
          flaggedForReview: true,
          error: {
            code: "GIFTUP_REDEEM_FAILED",
            message: `Gift Up returned ${redeemRes.status}`,
            details: errorBody,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redeemData = await redeemRes.json();

    // --- Store transaction details on the order ---
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        gift_card_code: code.trim().toUpperCase(),
        gift_card_amount: amount,
        giftup_transaction_id: redeemData.transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    if (updateError) {
      // Redemption succeeded in Gift Up but we failed to save locally
      // Log it but return success — Gift Up already deducted the balance
      console.error("Failed to update order after successful redemption:", updateError);
    }

    // --- Upsert into local gift_cards cache ---
    await supabase
      .from("gift_cards")
      .upsert({
        code: code.trim().toUpperCase(),
        current_balance: redeemData.remainingCredit,
        status: redeemData.remainingCredit === 0 ? "redeemed" : "active",
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "code" });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: redeemData.transactionId,
        redeemedAmount: redeemData.redeemedAmount,
        remainingCredit: redeemData.remainingCredit,
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
