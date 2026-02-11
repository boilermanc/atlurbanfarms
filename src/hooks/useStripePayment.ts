import { useState, useEffect, useCallback } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { supabase } from '../lib/supabase'
import { useSetting } from '../admin/hooks/useSettings'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Hook to get the Stripe publishable key from settings
 */
export function useStripeKey() {
  const { value: publishableKey, loading, error } = useSetting('integrations', 'stripe_publishable_key')
  const { value: stripeEnabled } = useSetting('integrations', 'stripe_enabled')

  return {
    publishableKey: publishableKey as string | null,
    stripeEnabled: stripeEnabled as boolean,
    loading,
    error
  }
}

/**
 * Hook to load and manage Stripe instance
 */
export function useStripe() {
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { publishableKey, stripeEnabled, loading: keyLoading } = useStripeKey()

  useEffect(() => {
    if (keyLoading) return

    if (!stripeEnabled) {
      setLoading(false)
      setError('Stripe is not enabled')
      return
    }

    if (!publishableKey) {
      setLoading(false)
      setError('Stripe publishable key not configured')
      return
    }

    const initStripe = async () => {
      try {
        // Cache the promise so we don't reload Stripe multiple times
        if (!stripePromise) {
          stripePromise = loadStripe(publishableKey)
        }
        const stripeInstance = await stripePromise
        setStripe(stripeInstance)
        setError(null)
      } catch (err: any) {
        setError(err.message || 'Failed to load Stripe')
      } finally {
        setLoading(false)
      }
    }

    initStripe()
  }, [publishableKey, stripeEnabled, keyLoading])

  return { stripe, loading: loading || keyLoading, error }
}

interface CreatePaymentIntentParams {
  amount: number // Total in dollars
  customerEmail: string
  orderId?: string
  metadata?: Record<string, string>
  discountAmount?: number // Sproutify credit in dollars (for server-side verification)
  discountDescription?: string
  lifetimeDiscount?: number // Lifetime member 10% discount in dollars
}

interface PaymentIntentResult {
  clientSecret: string
  paymentIntentId: string
}

/**
 * Hook for Stripe payment operations
 */
export function useStripePayment() {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPaymentIntent = useCallback(async (
    params: CreatePaymentIntentParams
  ): Promise<PaymentIntentResult | null> => {
    setProcessing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      // Convert dollars to cents
      const amountInCents = Math.round(params.amount * 100)

      const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          amount: amountInCents,
          customerEmail: params.customerEmail,
          orderId: params.orderId,
          metadata: params.metadata,
          discountAmount: params.discountAmount ? Math.round(params.discountAmount * 100) : undefined,
          discountDescription: params.discountDescription,
          lifetimeDiscountAmount: params.lifetimeDiscount ? Math.round(params.lifetimeDiscount * 100) : undefined
        })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || 'Failed to create payment intent')
        return null
      }

      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Payment initialization failed'
      setError(errorMessage)
      return null
    } finally {
      setProcessing(false)
    }
  }, [])

  return { createPaymentIntent, processing, error }
}
