import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface PaymentIntentRequest {
  amount: number // in cents
  currency?: string
  customerEmail: string
  orderId?: string
  metadata?: Record<string, string>
  discountAmount?: number // in cents, client-claimed Sproutify credit
  discountDescription?: string
  lifetimeDiscountAmount?: number // in cents, client-claimed lifetime member 10% discount
}

interface SproutifyVerification {
  creditCents: number
  isLifetime: boolean
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

    // Initialize Stripe with the secret key from database
    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Parse request body
    const {
      amount,
      currency = 'usd',
      customerEmail,
      orderId,
      metadata = {},
      discountAmount: clientDiscountCents = 0,
      discountDescription = '',
      lifetimeDiscountAmount: clientLifetimeDiscountCents = 0
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

    // Create or retrieve customer
    let customerId: string | undefined
    if (customerEmail) {
      const customers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
        })
        customerId = customer.id
      }
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount), // Ensure integer cents
      currency,
      customer: customerId,
      metadata: {
        ...metadata,
        orderId: orderId || '',
        ...(verifiedCreditCents > 0 ? {
          sproutifyCreditCents: String(verifiedCreditCents),
        } : {}),
        ...(verifiedLifetimeDiscountCents > 0 ? {
          lifetimeDiscountCents: String(verifiedLifetimeDiscountCents),
        } : {}),
        ...((verifiedCreditCents > 0 || verifiedLifetimeDiscountCents > 0) ? {
          originalAmountCents: String(amount),
        } : {}),
      },
      automatic_payment_methods: {
        enabled: true,
      },
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
