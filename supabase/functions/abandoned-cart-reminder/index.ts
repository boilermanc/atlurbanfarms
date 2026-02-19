import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

interface AbandonedCart {
  id: string
  session_id: string
  customer_id: string | null
  email: string
  first_name: string | null
  cart_items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    image?: string
  }>
  cart_total: number
  item_count: number
  updated_at: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Find abandoned carts: updated 2+ hours ago, not yet reminded, not converted,
    // created within last 7 days. Pick the most recent cart per email to avoid
    // duplicate emails when a user has multiple sessions.
    const { data: carts, error: fetchError } = await supabaseClient
      .rpc('get_abandoned_carts_for_reminder', {
        p_stale_before: twoHoursAgo,
        p_created_after: sevenDaysAgo,
        p_limit: 50
      })

    // Fallback to direct query if RPC doesn't exist yet
    let abandonedCarts: AbandonedCart[] = carts ?? []
    if (fetchError) {
      console.log('RPC not available, using direct query:', fetchError.message)
      const { data: directCarts, error: directError } = await supabaseClient
        .from('abandoned_carts')
        .select('*')
        .is('reminder_sent_at', null)
        .is('converted_at', null)
        .lt('updated_at', twoHoursAgo)
        .gt('created_at', sevenDaysAgo)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (directError) throw directError
      abandonedCarts = directCarts ?? []

      // Deduplicate by email: keep only the most recent cart per email
      const seenEmails = new Set<string>()
      abandonedCarts = abandonedCarts.filter(cart => {
        const email = cart.email.toLowerCase()
        if (seenEmails.has(email)) return false
        seenEmails.add(email)
        return true
      })
    }

    if (abandonedCarts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No abandoned carts to process', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Also check for recently completed orders to skip those emails
    const emails = abandonedCarts.map(c => c.email.toLowerCase())
    const { data: recentOrders } = await supabaseClient
      .from('orders')
      .select('guest_email, customer_id')
      .gte('created_at', sevenDaysAgo)
      .in('guest_email', emails)

    const completedEmails = new Set(
      (recentOrders ?? []).map(o => o.guest_email?.toLowerCase()).filter(Boolean)
    )

    let sentCount = 0
    const errors: string[] = []
    const shopUrl = 'https://deux.atlurbanfarms.com/shop'

    for (const cart of abandonedCarts) {
      // Skip if the customer already has a recent order
      if (completedEmails.has(cart.email.toLowerCase())) {
        // Mark as converted so we don't process again
        await supabaseClient
          .from('abandoned_carts')
          .update({ converted_at: new Date().toISOString() })
          .eq('id', cart.id)
        continue
      }

      try {
        // Build cart items HTML for the email template
        const items = cart.cart_items ?? []
        const cartItemsHtml = items.map(item =>
          `<p style="color: #333; font-size: 14px; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">` +
          `<strong>${escapeHtml(item.name)}</strong> x${item.quantity} &mdash; ` +
          `$${(item.price * item.quantity).toFixed(2)}` +
          `</p>`
        ).join('')

        const cartTotal = `$${Number(cart.cart_total).toFixed(2)}`

        // Send email via the existing resend-send-email edge function
        const { error: emailError } = await supabaseClient
          .functions.invoke('resend-send-email', {
            body: {
              to: cart.email,
              template: 'abandoned_cart',
              templateData: {
                first_name: cart.first_name || 'there',
                item_count: String(cart.item_count),
                cart_total: cartTotal,
                cart_items_html: cartItemsHtml,
                checkout_url: shopUrl
              }
            }
          })

        if (emailError) {
          console.error(`Failed to send to ${cart.email}:`, emailError.message)
          errors.push(`${cart.email}: ${emailError.message}`)
          continue
        }

        // Mark reminder as sent
        await supabaseClient
          .from('abandoned_carts')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', cart.id)

        sentCount++
        console.log(`Sent abandoned cart reminder to ${cart.email}`)
      } catch (cartError) {
        const msg = cartError instanceof Error ? cartError.message : String(cartError)
        console.error(`Error processing cart ${cart.id}:`, msg)
        errors.push(`${cart.id}: ${msg}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: abandonedCarts.length,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Abandoned cart reminder error:', msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/** Escape HTML special characters to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
