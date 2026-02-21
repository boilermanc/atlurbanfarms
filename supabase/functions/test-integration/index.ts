import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

type IntegrationType = 'stripe' | 'resend' | 'shipstation' | 'trellis' | 'gemini'

interface TestRequest {
  integration: IntegrationType
}

interface TestResult {
  success: boolean
  message: string
  details?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { integration }: TestRequest = await req.json()

    let result: TestResult

    switch (integration) {
      case 'stripe':
        result = await testStripe(supabaseClient)
        break
      case 'resend':
        result = await testResend(supabaseClient)
        break
      case 'shipstation':
        result = await testShipStation(supabaseClient)
        break
      case 'trellis':
        result = await testTrellis(supabaseClient)
        break
      case 'gemini':
        result = await testGemini(supabaseClient)
        break
      default:
        result = { success: false, message: `Unknown integration: ${integration}` }
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Test integration error:', error)
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Test failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function testStripe(supabaseClient: any): Promise<TestResult> {
  const settings = await getIntegrationSettings(supabaseClient, [
    'stripe_enabled',
    'stripe_secret_key'
  ])

  if (!settings.stripe_enabled) {
    return { success: false, message: 'Stripe is not enabled' }
  }

  if (!settings.stripe_secret_key) {
    return { success: false, message: 'Stripe secret key is not configured' }
  }

  try {
    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Test by fetching account balance
    const balance = await stripe.balance.retrieve()

    return {
      success: true,
      message: 'Connected to Stripe successfully',
      details: {
        available: balance.available.map(b => ({ currency: b.currency, amount: b.amount / 100 })),
        pending: balance.pending.map(b => ({ currency: b.currency, amount: b.amount / 100 }))
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Stripe connection failed: ${error.message}`
    }
  }
}

async function testResend(supabaseClient: any): Promise<TestResult> {
  const settings = await getIntegrationSettings(supabaseClient, [
    'resend_enabled',
    'resend_api_key'
  ])

  if (!settings.resend_enabled) {
    return { success: false, message: 'Resend is not enabled' }
  }

  if (!settings.resend_api_key) {
    return { success: false, message: 'Resend API key is not configured' }
  }

  try {
    // Test by fetching API key info
    const response = await fetch('https://api.resend.com/api-keys', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Invalid API key')
    }

    return {
      success: true,
      message: 'Connected to Resend successfully'
    }
  } catch (error) {
    return {
      success: false,
      message: `Resend connection failed: ${error.message}`
    }
  }
}

async function testShipStation(supabaseClient: any): Promise<TestResult> {
  const settings = await getIntegrationSettings(supabaseClient, [
    'shipstation_enabled',
    'shipengine_api_key'
  ])

  if (!settings.shipstation_enabled) {
    return { success: false, message: 'ShipEngine is not enabled' }
  }

  if (!settings.shipengine_api_key) {
    return { success: false, message: 'ShipEngine API key is not configured' }
  }

  try {
    // Test by fetching carriers from ShipEngine API
    const response = await fetch('https://api.shipengine.com/v1/carriers', {
      method: 'GET',
      headers: {
        'API-Key': settings.shipengine_api_key,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorBody}`)
    }

    const data = await response.json()

    return {
      success: true,
      message: 'Connected to ShipEngine successfully',
      details: {
        carrierCount: data.carriers?.length || 0
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `ShipEngine connection failed: ${error.message}`
    }
  }
}

async function testTrellis(supabaseClient: any): Promise<TestResult> {
  const settings = await getIntegrationSettings(supabaseClient, [
    'trellis_enabled',
    'trellis_api_endpoint',
    'trellis_api_key'
  ])

  if (!settings.trellis_enabled) {
    return { success: false, message: 'Trellis is not enabled' }
  }

  if (!settings.trellis_api_endpoint || !settings.trellis_api_key) {
    return { success: false, message: 'Trellis API settings are not configured' }
  }

  try {
    // Test by making a simple API call
    const response = await fetch(`${settings.trellis_api_endpoint}/ping`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.trellis_api_key}`,
        'Content-Type': 'application/json'
      }
    })

    // If endpoint doesn't have a ping, just check we can reach it
    if (response.status === 404) {
      // Try the base endpoint
      const baseResponse = await fetch(settings.trellis_api_endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.trellis_api_key}`
        }
      })

      if (baseResponse.ok || baseResponse.status === 401) {
        // 401 means the endpoint is reachable but might need different auth
        return {
          success: baseResponse.ok,
          message: baseResponse.ok ? 'Connected to Trellis successfully' : 'Trellis endpoint reachable but authentication failed'
        }
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return {
      success: true,
      message: 'Connected to Trellis successfully'
    }
  } catch (error) {
    return {
      success: false,
      message: `Trellis connection failed: ${error.message}`
    }
  }
}

async function testGemini(supabaseClient: any): Promise<TestResult> {
  const settings = await getIntegrationSettings(supabaseClient, [
    'gemini_enabled',
    'gemini_api_key'
  ])

  if (!settings.gemini_enabled) {
    return { success: false, message: 'Gemini is not enabled' }
  }

  if (!settings.gemini_api_key) {
    return { success: false, message: 'Gemini API key is not configured' }
  }

  try {
    // Test by listing models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.gemini_api_key}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Invalid API key')
    }

    const data = await response.json()

    return {
      success: true,
      message: 'Connected to Google Gemini successfully',
      details: {
        availableModels: data.models?.slice(0, 3).map((m: any) => m.name) || []
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Gemini connection failed: ${error.message}`
    }
  }
}
