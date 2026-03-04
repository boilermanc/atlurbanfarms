import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface CartItemCheck {
  productId: string
  quantity: number
}

interface PaymentIntentRequest {
  amount: number // in cents
  currency?: string
  customerEmail: string
  orderId?: string
  metadata?: Record<string, string>
  discountAmount?: number // in cents, client-claimed Sproutify credit
  discountDescription?: string
  lifetimeDiscountAmount?: number // in cents, client-claimed lifetime member 10% discount
  items?: CartItemCheck[] // cart items for inventory pre-check
}

interface SproutifyVerification {
  creditCents: number
  isLifetime: boolean
}

const STRIPE_API = 'https://api.stripe.com/v1'

/** Make a request to the Stripe REST API */
async function stripeRequest(
  endpoint: string,
  stripeKey: string,
  options: { method?: string; params?: Record<string, string> } = {}
) {
  const { method = 'GET', params } = options
  let url = `${STRIPE_API}${endpoint}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${stripeKey}`,
  }

  let body: string | undefined
  if (params) {
    const encoded = new URLSearchParams(params).toString()
    if (method === 'GET') {
      url += `?${encoded}`
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = encoded
    }
  }

  const response = await fetch(url, { method, headers, body })
  const data = await response.json()

  if (!response.ok) {
    const errMsg = data?.error?.message || `Stripe API error: ${response.status}`
    throw new Error(errMsg)
  }

  return data
}

/**
 * Server-side verification of Sproutify seedling credit and lifetime status.
 * Returns the verified credit amount in cents and whether the customer is a lifetime member.
 */
async function verifySproutifyCredit(customerEmail: string): Promise<SproutifyVerification> {
  const functionUrl = Deno.env.get('SPROUTIFY_FUNCTION_URL')
  const anonKey = Deno.env.get('SPROUTIFY_ANON_KEY')
  const apiKey = Deno.env.get('SPROUTIFY_API_KEY')

  if (!functionUrl || !anonKey || !apiKey) {
    console.warn('Sproutify credentials not configured, skipping credit verification')
    return { creditCents: 0, isLifetime: false }
  }

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'check', email: customerEmail })
    })

    if (!response.ok) {
      console.error(`Sproutify credit check failed: ${response.status}`)
      return { creditCents: 0, isLifetime: false }
    }

    const data = await response.json()

    return {
      creditCents: (data.hasCredit && data.creditAmount > 0) ? Math.round(data.creditAmount * 100) : 0,
      isLifetime: !!data.isLifetime
    }
  } catch (err) {
    console.error('Sproutify credit verification error:', err)
    return { creditCents: 0, isLifetime: false }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Create Supabase client with service role for accessing settings
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Stripe settings from database
    const settings = await getIntegrationSettings(supabaseClient, [
      'stripe_enabled',
      'stripe_secret_key'
    ])

    if (!settings.stripe_enabled) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not enabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!settings.stripe_secret_key) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key is not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const stripeKey = settings.stripe_secret_key

    // Parse request body
    const {
      amount,
      currency = 'usd',
      customerEmail,
      orderId,
      metadata = {},
      discountAmount: clientDiscountCents = 0,
      discountDescription = '',
      lifetimeDiscountAmount: clientLifetimeDiscountCents = 0,
      items: cartItems = []
    }: PaymentIntentRequest = await req.json()

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Server-side verification: check Sproutify for credit and lifetime status
    let verifiedCreditCents = 0
    let verifiedLifetimeDiscountCents = 0
    const needsSproutifyCheck = (clientDiscountCents > 0 && discountDescription?.includes('Sproutify')) ||
                                 clientLifetimeDiscountCents > 0

    if (needsSproutifyCheck && customerEmail) {
      const sproutify = await verifySproutifyCredit(customerEmail)

      // Verify Sproutify credit
      if (clientDiscountCents > 0 && discountDescription?.includes('Sproutify')) {
        verifiedCreditCents = sproutify.creditCents
        if (verifiedCreditCents > 0) {
          console.log(`Verified Sproutify credit: ${verifiedCreditCents} cents for ${customerEmail}`)
        } else {
          console.warn(`Sproutify credit not verified for ${customerEmail}, charging full amount`)
        }
      }

      // Verify lifetime member 10% discount — cap at 10% of total as a safe upper bound
      if (clientLifetimeDiscountCents > 0 && sproutify.isLifetime) {
        verifiedLifetimeDiscountCents = Math.min(clientLifetimeDiscountCents, Math.round(amount * 0.10))
        console.log(`Verified lifetime discount: ${verifiedLifetimeDiscountCents} cents for ${customerEmail}`)
      } else if (clientLifetimeDiscountCents > 0) {
        console.warn(`Lifetime discount not verified for ${customerEmail} (isLifetime=${sproutify.isLifetime}), ignoring`)
      }
    }

    // Cap total discount to order amount minus Stripe minimum (50 cents)
    const totalDiscountCents = Math.min(
      verifiedCreditCents + verifiedLifetimeDiscountCents,
      amount - 50
    )
    // Apportion back: lifetime discount first, then credit with remainder
    verifiedLifetimeDiscountCents = Math.min(verifiedLifetimeDiscountCents, Math.max(totalDiscountCents, 0))
    verifiedCreditCents = Math.min(verifiedCreditCents, Math.max(totalDiscountCents - verifiedLifetimeDiscountCents, 0))

    // Apply verified discounts
    const finalAmount = amount - verifiedLifetimeDiscountCents - verifiedCreditCents

    // Inventory pre-check: verify all cart items have sufficient stock
    if (cartItems.length > 0) {
      const productIds = cartItems.map(item => item.productId)
      const { data: products, error: productsError } = await supabaseClient
        .from('products')
        .select('id, name, quantity_available')
        .in('id', productIds)

      if (productsError) {
        console.error('Inventory check query failed:', productsError)
        return new Response(
          JSON.stringify({ success: false, error: { code: 'INVENTORY_CHECK_FAILED', message: 'Unable to verify inventory. Please try again.' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const productMap = new Map(products?.map(p => [p.id, p]) || [])

      for (const item of cartItems) {
        const product = productMap.get(item.productId)
        if (!product) {
          return new Response(
            JSON.stringify({ success: false, error: { code: 'INSUFFICIENT_INVENTORY', message: `Sorry, a product in your cart is no longer available.` } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if ((product.quantity_available ?? 0) < item.quantity) {
          const availableMsg = product.quantity_available > 0
            ? `Only ${product.quantity_available} left in stock.`
            : 'It is currently out of stock.'
          return new Response(
            JSON.stringify({ success: false, error: { code: 'INSUFFICIENT_INVENTORY', message: `Sorry, ${product.name} is no longer available in the requested quantity. ${availableMsg}` } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Create or retrieve customer
    let customerId: string | undefined
    if (customerEmail) {
      const customers = await stripeRequest('/customers', stripeKey, {
        method: 'GET',
        params: { email: customerEmail, limit: '1' },
      })

      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      } else {
        const customer = await stripeRequest('/customers', stripeKey, {
          method: 'POST',
          params: { email: customerEmail },
        })
        customerId = customer.id
      }
    }

    // Build payment intent params
    const piParams: Record<string, string> = {
      amount: String(Math.round(finalAmount)),
      currency,
      'automatic_payment_methods[enabled]': 'true',
    }

    if (customerId) {
      piParams.customer = customerId
    }

    // Add metadata
    const allMetadata: Record<string, string> = {
      ...metadata,
      orderId: orderId || '',
    }
    if (verifiedCreditCents > 0) {
      allMetadata.sproutifyCreditCents = String(verifiedCreditCents)
    }
    if (verifiedLifetimeDiscountCents > 0) {
      allMetadata.lifetimeDiscountCents = String(verifiedLifetimeDiscountCents)
    }
    if (verifiedCreditCents > 0 || verifiedLifetimeDiscountCents > 0) {
      allMetadata.originalAmountCents = String(amount)
    }

    for (const [key, value] of Object.entries(allMetadata)) {
      piParams[`metadata[${key}]`] = value
    }

    // Create PaymentIntent
    const paymentIntent = await stripeRequest('/payment_intents', stripeKey, {
      method: 'POST',
      params: piParams,
    })

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        verifiedDiscountCents: verifiedCreditCents,
        verifiedLifetimeDiscountCents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Stripe PaymentIntent error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create payment intent' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
