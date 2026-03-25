import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendShippingEmail } from '../_shared/shipping-emails.ts'

/**
 * Send Scheduled Shipping Emails
 *
 * Called on a cron schedule (e.g. hourly via n8n).
 * Finds shipments where the 24-hour delay has elapsed and sends
 * the shipping_notification email with tracking info.
 */

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find shipments due for email notification
    const { data: pendingShipments, error: queryError } = await supabaseClient
      .from('shipments')
      .select('id, order_id, tracking_number, carrier_code')
      .lte('shipping_email_send_at', new Date().toISOString())
      .is('shipping_email_sent_at', null)
      .eq('voided', false)
      .limit(50)

    if (queryError) {
      console.error('Failed to query pending shipments:', queryError)
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingShipments || pendingShipments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No pending shipping emails' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingShipments.length} pending shipping emails to send`)

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const shipment of pendingShipments) {
      try {
        const emailResult = await sendShippingEmail(
          supabaseClient,
          'shipping_notification',
          shipment.order_id,
          {
            tracking_number: shipment.tracking_number,
            carrier_code: shipment.carrier_code,
          }
        )

        if (emailResult.success) {
          // Mark as sent
          await supabaseClient
            .from('shipments')
            .update({ shipping_email_sent_at: new Date().toISOString() })
            .eq('id', shipment.id)

          sent++
          console.log(`Sent shipping email for shipment ${shipment.id}`)
        } else {
          failed++
          errors.push(`Shipment ${shipment.id}: ${emailResult.error}`)
          console.warn(`Failed to send email for shipment ${shipment.id}:`, emailResult.error)
        }
      } catch (err: any) {
        failed++
        errors.push(`Shipment ${shipment.id}: ${err.message}`)
        console.error(`Error processing shipment ${shipment.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: pendingShipments.length,
        ...(errors.length > 0 ? { errors } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Scheduled shipping email error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
