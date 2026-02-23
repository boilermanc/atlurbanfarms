import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

/** A cart item common to both sources */
interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
}

/** Unified reminder entry from either source */
interface CartReminder {
  source: 'checkout' | 'persistent'
  id: string
  customerId: string | null
  email: string
  firstName: string | null
  cartItems: CartItem[]
  cartTotal: number
  itemCount: number
}

/** Config settings for abandoned cart reminders */
interface ReminderConfig {
  enabled: boolean
  checkoutHours: number
  persistentHours: number
  maxAgeDays: number
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1. Fetch config settings ──────────────────────────────────────
    const config = await fetchConfig(supabaseClient)
    if (!config.enabled) {
      return jsonResponse({ success: true, message: 'Abandoned cart reminders are disabled', sent: 0 })
    }

    const now = Date.now()
    const checkoutThreshold = new Date(now - config.checkoutHours * 60 * 60 * 1000).toISOString()
    const persistentThreshold = new Date(now - config.persistentHours * 60 * 60 * 1000).toISOString()
    const maxAgeThreshold = new Date(now - config.maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

    // ── 2. Source 1: Checkout-initiated abandoned carts ────────────────
    const checkoutReminders = await fetchCheckoutAbandoned(supabaseClient, checkoutThreshold, maxAgeThreshold)

    // Track emails from Source 1 for cross-source dedup
    const checkoutEmails = new Set(checkoutReminders.map(r => r.email.toLowerCase()))

    // ── 3. Source 2: Persistent authenticated user carts ──────────────
    const persistentReminders = await fetchPersistentAbandoned(supabaseClient, persistentThreshold, maxAgeThreshold)

    // Deduplicate: if email appears in both sources, Source 1 wins
    const dedupedPersistent = persistentReminders.filter(r => !checkoutEmails.has(r.email.toLowerCase()))

    const allReminders = [...checkoutReminders, ...dedupedPersistent]

    if (allReminders.length === 0) {
      return jsonResponse({ success: true, message: 'No abandoned carts to process', sent: 0 })
    }

    // ── 4. Check recent orders to skip converted customers ────────────
    const allEmails = allReminders.map(r => r.email.toLowerCase())
    const allCustomerIds = allReminders
      .filter(r => r.customerId)
      .map(r => r.customerId as string)

    const completedEmails = new Set<string>()
    const completedCustomerIds = new Set<string>()

    // Check by guest_email
    const { data: ordersByEmail } = await supabaseClient
      .from('orders')
      .select('guest_email')
      .gte('created_at', maxAgeThreshold)
      .in('guest_email', allEmails)

    for (const o of ordersByEmail ?? []) {
      if (o.guest_email) completedEmails.add(o.guest_email.toLowerCase())
    }

    // Check by customer_id
    if (allCustomerIds.length > 0) {
      const { data: ordersByCustomer } = await supabaseClient
        .from('orders')
        .select('customer_id')
        .gte('created_at', maxAgeThreshold)
        .in('customer_id', allCustomerIds)

      for (const o of ordersByCustomer ?? []) {
        if (o.customer_id) completedCustomerIds.add(o.customer_id)
      }
    }

    // ── 5. Send emails ────────────────────────────────────────────────
    let sentCount = 0
    const errors: string[] = []
    const shopUrl = 'https://deux.atlurbanfarms.com/shop'

    for (const reminder of allReminders) {
      // Skip if customer has a recent order
      if (completedEmails.has(reminder.email.toLowerCase()) ||
          (reminder.customerId && completedCustomerIds.has(reminder.customerId))) {
        // Mark as converted so we don't process again
        await markConverted(supabaseClient, reminder)
        continue
      }

      try {
        const cartItemsHtml = reminder.cartItems.map(item =>
          `<p style="color: #333; font-size: 14px; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">` +
          `<strong>${escapeHtml(item.name)}</strong> x${item.quantity} &mdash; ` +
          `$${(item.price * item.quantity).toFixed(2)}` +
          `</p>`
        ).join('')

        const cartTotal = `$${Number(reminder.cartTotal).toFixed(2)}`

        const { error: emailError } = await supabaseClient
          .functions.invoke('send-email', {
            body: {
              to: reminder.email,
              template: 'abandoned_cart',
              templateData: {
                first_name: reminder.firstName || 'there',
                item_count: String(reminder.itemCount),
                cart_total: cartTotal,
                cart_items_html: cartItemsHtml,
                checkout_url: shopUrl
              }
            }
          })

        if (emailError) {
          console.error(`Failed to send to ${reminder.email}:`, emailError.message)
          errors.push(`${reminder.email}: ${emailError.message}`)
          continue
        }

        await markReminderSent(supabaseClient, reminder)
        sentCount++
        console.log(`Sent abandoned cart reminder to ${reminder.email} (source: ${reminder.source})`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error processing ${reminder.source} cart ${reminder.id}:`, msg)
        errors.push(`${reminder.id}: ${msg}`)
      }
    }

    return jsonResponse({
      success: true,
      processed: allReminders.length,
      sent: sentCount,
      sources: {
        checkout: checkoutReminders.length,
        persistent: dedupedPersistent.length
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Abandoned cart reminder error:', msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helper functions ──────────────────────────────────────────────────

/** Fetch config settings with fallback defaults */
async function fetchConfig(supabase: ReturnType<typeof createClient>): Promise<ReminderConfig> {
  const defaults: ReminderConfig = {
    enabled: true,
    checkoutHours: 2,
    persistentHours: 24,
    maxAgeDays: 7
  }

  try {
    const { data } = await supabase
      .from('config_settings')
      .select('key, value')
      .eq('category', 'marketing')
      .in('key', [
        'abandoned_cart_enabled',
        'abandoned_cart_checkout_hours',
        'abandoned_cart_persistent_hours',
        'abandoned_cart_max_age_days'
      ])

    if (!data || data.length === 0) return defaults

    const settings = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
    return {
      enabled: settings.abandoned_cart_enabled !== 'false',
      checkoutHours: Number(settings.abandoned_cart_checkout_hours) || defaults.checkoutHours,
      persistentHours: Number(settings.abandoned_cart_persistent_hours) || defaults.persistentHours,
      maxAgeDays: Number(settings.abandoned_cart_max_age_days) || defaults.maxAgeDays
    }
  } catch (err) {
    console.warn('Failed to fetch config, using defaults:', err)
    return defaults
  }
}

/** Source 1: Query abandoned_carts table for checkout-initiated carts */
async function fetchCheckoutAbandoned(
  supabase: ReturnType<typeof createClient>,
  staleThreshold: string,
  maxAgeThreshold: string
): Promise<CartReminder[]> {
  // Try RPC first, fall back to direct query
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_abandoned_carts_for_reminder', {
      p_stale_before: staleThreshold,
      p_created_after: maxAgeThreshold,
      p_limit: 50
    })

  let rows = rpcData ?? []
  if (rpcError) {
    console.log('RPC not available, using direct query:', rpcError.message)
    const { data, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .is('reminder_sent_at', null)
      .is('converted_at', null)
      .lt('updated_at', staleThreshold)
      .gt('created_at', maxAgeThreshold)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error
    rows = data ?? []
  }

  // Deduplicate by email: keep most recent per email
  const seenEmails = new Set<string>()
  const deduped = rows.filter((cart: { email: string }) => {
    const email = cart.email.toLowerCase()
    if (seenEmails.has(email)) return false
    seenEmails.add(email)
    return true
  })

  return deduped.map((cart: {
    id: string
    customer_id: string | null
    email: string
    first_name: string | null
    cart_items: CartItem[]
    cart_total: number
    item_count: number
  }) => ({
    source: 'checkout' as const,
    id: cart.id,
    customerId: cart.customer_id,
    email: cart.email,
    firstName: cart.first_name,
    cartItems: cart.cart_items ?? [],
    cartTotal: cart.cart_total,
    itemCount: cart.item_count
  }))
}

/** Source 2: Query persistent carts for authenticated users who never started checkout */
async function fetchPersistentAbandoned(
  supabase: ReturnType<typeof createClient>,
  staleThreshold: string,
  maxAgeThreshold: string
): Promise<CartReminder[]> {
  // Step A: Fetch stale carts that haven't been reminded
  const { data: staleCarts, error: cartsError } = await supabase
    .from('carts')
    .select('id, customer_id, updated_at')
    .is('abandoned_reminder_sent_at', null)
    .lt('updated_at', staleThreshold)
    .gt('updated_at', maxAgeThreshold)
    .limit(50)

  if (cartsError) {
    console.error('Failed to fetch persistent carts:', cartsError.message)
    return []
  }
  if (!staleCarts || staleCarts.length === 0) return []

  const cartIds = staleCarts.map((c: { id: string }) => c.id)
  const customerIds = staleCarts.map((c: { customer_id: string }) => c.customer_id).filter(Boolean) as string[]

  // Step B: Fetch cart items with product details
  const { data: allItems, error: itemsError } = await supabase
    .from('cart_items')
    .select('cart_id, quantity, products(id, name, price)')
    .in('cart_id', cartIds)

  if (itemsError) {
    console.error('Failed to fetch cart items:', itemsError.message)
    return []
  }

  // Step C: Fetch customer emails
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, email, first_name')
    .in('id', customerIds)

  if (custError) {
    console.error('Failed to fetch customers:', custError.message)
    return []
  }

  // Build lookup maps
  interface CustomerRecord { id: string; email: string; first_name: string | null }
  const customerMap = new Map<string, CustomerRecord>(
    (customers ?? []).map((c: CustomerRecord) => [c.id, c])
  )
  const itemsByCart = new Map<string, Array<{ quantity: number; product: { id: string; name: string; price: number } }>>()
  for (const item of allItems ?? []) {
    const list = itemsByCart.get(item.cart_id) ?? []
    // products is returned as an object (single FK relationship)
    const product = item.products as unknown as { id: string; name: string; price: number } | null
    if (product) {
      list.push({ quantity: item.quantity, product })
    }
    itemsByCart.set(item.cart_id, list)
  }

  // Assemble reminders, skipping carts with no items or no customer email
  const reminders: CartReminder[] = []
  for (const cart of staleCarts) {
    const customer = customerMap.get(cart.customer_id)
    if (!customer?.email) continue

    const items = itemsByCart.get(cart.id)
    if (!items || items.length === 0) continue

    const cartItems: CartItem[] = items.map(i => ({
      id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity
    }))

    reminders.push({
      source: 'persistent',
      id: cart.id,
      customerId: cart.customer_id,
      email: customer.email,
      firstName: customer.first_name,
      cartItems,
      cartTotal: cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0)
    })
  }

  return reminders
}

/** Mark a cart as converted (has a recent order) */
async function markConverted(supabase: ReturnType<typeof createClient>, reminder: CartReminder) {
  if (reminder.source === 'checkout') {
    await supabase
      .from('abandoned_carts')
      .update({ converted_at: new Date().toISOString() })
      .eq('id', reminder.id)
  } else {
    // For persistent carts, mark reminder sent to stop processing
    await supabase
      .from('carts')
      .update({ abandoned_reminder_sent_at: new Date().toISOString() })
      .eq('id', reminder.id)
  }
}

/** Mark reminder as sent after successful email delivery */
async function markReminderSent(supabase: ReturnType<typeof createClient>, reminder: CartReminder) {
  const timestamp = new Date().toISOString()
  if (reminder.source === 'checkout') {
    await supabase
      .from('abandoned_carts')
      .update({ reminder_sent_at: timestamp })
      .eq('id', reminder.id)
  } else {
    await supabase
      .from('carts')
      .update({ abandoned_reminder_sent_at: timestamp })
      .eq('id', reminder.id)
  }
}

/** JSON response helper */
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/** Escape HTML special characters to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
