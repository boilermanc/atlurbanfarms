import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

interface AdminRequest {
  action: 'check' | 'grant'
  email: string
  amount?: number
  notes?: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: adminRole } = await supabaseClient
      .from('admin_user_roles')
      .select('id')
      .eq('customer_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Sproutify credentials from env
    const functionUrl = Deno.env.get('SPROUTIFY_FUNCTION_URL')
    const anonKey = Deno.env.get('SPROUTIFY_ANON_KEY')
    const apiKey = Deno.env.get('SPROUTIFY_API_KEY')

    if (!functionUrl || !anonKey || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Sproutify integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, email, amount, notes }: AdminRequest = await req.json()

    if (!action || !email) {
      return new Response(
        JSON.stringify({ error: 'action and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'grant' && (!amount || amount <= 0)) {
      return new Response(
        JSON.stringify({ error: 'amount must be positive for grant action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build Sproutify request body
    const sproutifyBody: Record<string, any> = { action, email }
    if (action === 'grant') {
      sproutifyBody.amount = amount
    }

    // Call Sproutify API
    let sproutifyData: Record<string, any> = {}
    let logStatus: 'success' | 'failed' = 'success'

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sproutifyBody)
      })

      sproutifyData = await response.json()

      if (!response.ok) {
        logStatus = 'failed'
      }
    } catch (err) {
      logStatus = 'failed'
      sproutifyData = { error: err.message || 'Sproutify API call failed' }
    }

    // Log to seedling_credit_log
    await supabaseClient
      .from('seedling_credit_log')
      .insert({
        action,
        customer_email: email,
        credit_amount: action === 'grant' ? amount : (sproutifyData.creditAmount || 0),
        credit_id: sproutifyData.creditId || null,
        performed_by: user.id,
        status: logStatus,
        notes: notes || null,
        sproutify_response: sproutifyData
      })

    return new Response(
      JSON.stringify({
        success: logStatus === 'success',
        data: sproutifyData
      }),
      {
        status: logStatus === 'success' ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Sproutify admin error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
