import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const TURNSTILE_SECRET_KEY = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY')
    if (!TURNSTILE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'Turnstile secret key not configured' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'MISSING_TOKEN', message: 'Turnstile token is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const verifyResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
        }),
      }
    )

    const verifyResult = await verifyResponse.json()

    if (!verifyResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'CAPTCHA verification failed. Please try again.',
            errorCodes: verifyResult['error-codes'] || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
