import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Webhooks use POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const GIFTUP_WEBHOOK_SECRET = Deno.env.get("GIFTUP_WEBHOOK_SECRET");

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // --- Verify webhook signature if secret is configured ---
  // Gift Up sends X-GiftUp-Signature header
  if (GIFTUP_WEBHOOK_SECRET) {
    const signature = req.headers.get("X-GiftUp-Signature");
    if (!signature || signature !== GIFTUP_WEBHOOK_SECRET) {
      console.error("Webhook signature mismatch");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, data } = payload;

  if (!event || !data?.code) {
    return new Response("Missing event or code", { status: 400 });
  }

  console.log(`Gift Up webhook: ${event} for code ${data.code}`);

  // --- Derive status (must match CHECK constraint: active, depleted, disabled) ---
  const deriveStatus = (d: any): string => {
    if (d.isVoided) return "disabled";
    if (d.remainingCredit === 0) return "depleted";
    if (d.hasExpired) return "depleted";
    return "active";
  };

  const status = deriveStatus(data);
  const now = new Date().toISOString();

  // --- Upsert gift card ---
  const { data: upserted, error: upsertError } = await supabase
    .from("gift_cards")
    .upsert({
      code: data.code.trim().toUpperCase(),
      initial_balance: data.initialCredit,
      current_balance: data.remainingCredit,
      status,
      recipient_name: data.recipientName || null,
      recipient_email: data.recipientEmail || null,
      purchaser_email: data.purchaserEmail || null,
      message: data.message || null,
      expires_at: data.expiresOn || null,
      purchased_at: data.purchasedOn || null,
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: "code" })
    .select("id")
    .single();

  if (upsertError) {
    console.error("Failed to upsert gift card:", upsertError);
    // Still return 200 so Gift Up doesn't retry indefinitely
    return new Response(JSON.stringify({ received: true, synced: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const giftCardId = upserted?.id;

  // --- Record transaction for balance-changing events ---
  const transactionEvents = [
    "giftcard.redeemed",
    "giftcard.topped_up",
    "giftcard.voided",
    "giftcard.reactivated",
    "giftcard.redemption_undone",
  ];

  if (transactionEvents.includes(event) && giftCardId) {
    // Map to allowed types: purchase, redemption, refund, adjustment
    const transactionType: string = {
      "giftcard.redeemed": "redemption",
      "giftcard.topped_up": "adjustment",
      "giftcard.voided": "adjustment",
      "giftcard.reactivated": "adjustment",
      "giftcard.redemption_undone": "refund",
    }[event] || "adjustment";

    const amount = data.redeemedAmount || data.topUpAmount || 0;

    await supabase.from("gift_card_transactions").insert({
      gift_card_id: giftCardId,
      amount,
      balance_after: data.remainingCredit,
      type: transactionType,
      notes: `Webhook event: ${event}`,
      created_at: now,
    });
  }

  return new Response(JSON.stringify({ received: true, synced: true, status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
