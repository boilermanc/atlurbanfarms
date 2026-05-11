const STRIPE_API = 'https://api.stripe.com/v1'

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
 * Patch a Stripe PaymentIntent with the human-readable order number once the
 * order has been created. Sets the description (shown in Stripe dashboard) and
 * adds `orderNumber` to metadata. Safe to call multiple times — same payload.
 */
export async function updatePaymentIntentOrderNumber(
  stripeKey: string,
  paymentIntentId: string,
  orderNumber: string
): Promise<void> {
  await stripeRequest(`/payment_intents/${paymentIntentId}`, stripeKey, {
    method: 'POST',
    params: {
      description: `Order #${orderNumber}`,
      'metadata[orderNumber]': orderNumber,
    },
  })
}
