import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

interface CreditRequest {
  action: 'check' | 'redeem' | 'grant'
  email: string
  amount?: number
  order_id?: string
  notes?: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Validate API key
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = Deno.env.get('SEEDLING_CREDIT_API_KEY')
  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: 'Invalid API key' }, 401)
  }

  try {
    const { action, email, amount, order_id, notes }: CreditRequest = await req.json()

    if (!action || !email) {
      return jsonResponse({ error: 'action and email are required' }, 400)
    }

    const normalizedEmail = email.toLowerCase().trim()

    // ── CHECK ──────────────────────────────────────────────
    if (action === 'check') {
      const { data: credit } = await supabase
        .from('seedling_credits')
        .select('id, amount, credit_type, subscription_tier, expires_at')
        .eq('email', normalizedEmail)
        .is('redeemed_at', null)
        .gt('amount', 0)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const result = credit
        ? {
            hasCredit: true,
            creditAmount: Number(credit.amount),
            creditId: credit.id,
            isLifetime: credit.subscription_tier === 'lifetime',
          }
        : {
            hasCredit: false,
            creditAmount: 0,
            creditId: null,
            isLifetime: false,
          }

      logActivity(supabase, {
        action: 'check',
        customer_email: normalizedEmail,
        credit_amount: result.creditAmount,
        credit_id: result.creditId,
        status: result.hasCredit ? 'success' : 'not_found',
      })

      return jsonResponse(result)
    }

    // ── REDEEM ─────────────────────────────────────────────
    if (action === 'redeem') {
      const { data: credit } = await supabase
        .from('seedling_credits')
        .select('id, amount')
        .eq('email', normalizedEmail)
        .is('redeemed_at', null)
        .gt('amount', 0)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!credit) {
        logActivity(supabase, {
          action: 'redeem',
          customer_email: normalizedEmail,
          credit_amount: 0,
          order_id: order_id || null,
          status: 'not_found',
        })
        return jsonResponse({ redeemed: false, error: 'No active credit found' }, 404)
      }

      const { error: updateError } = await supabase
        .from('seedling_credits')
        .update({
          redeemed_at: new Date().toISOString(),
          redeemed_order_id: order_id || null,
        })
        .eq('id', credit.id)

      if (updateError) {
        logActivity(supabase, {
          action: 'redeem',
          customer_email: normalizedEmail,
          credit_amount: Number(credit.amount),
          credit_id: credit.id,
          order_id: order_id || null,
          status: 'failed',
          notes: updateError.message,
        })
        throw updateError
      }

      logActivity(supabase, {
        action: 'redeem',
        customer_email: normalizedEmail,
        credit_amount: Number(credit.amount),
        credit_id: credit.id,
        order_id: order_id || null,
        status: 'success',
      })

      return jsonResponse({ redeemed: true, creditId: credit.id, amount: Number(credit.amount) })
    }

    // ── GRANT ──────────────────────────────────────────────
    if (action === 'grant') {
      if (!amount || amount <= 0) {
        return jsonResponse({ error: 'amount must be positive for grant action' }, 400)
      }

      // Look up user in profiles by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1)
        .maybeSingle()

      // Calculate expiration: 12 months from now
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 12)

      const { data: newCredit, error: insertError } = await supabase
        .from('seedling_credits')
        .insert({
          email: normalizedEmail,
          user_id: profile?.id || null,
          amount,
          credit_type: 'manual_grant',
          subscription_tier: 'lifetime',
          expires_at: expiresAt.toISOString(),
        })
        .select('id, amount')
        .single()

      if (insertError) {
        logActivity(supabase, {
          action: 'grant',
          customer_email: normalizedEmail,
          credit_amount: amount,
          status: 'failed',
          notes: notes || insertError.message,
        })
        throw insertError
      }

      logActivity(supabase, {
        action: 'grant',
        customer_email: normalizedEmail,
        credit_amount: Number(newCredit.amount),
        credit_id: newCredit.id,
        status: 'success',
        notes,
      })

      return jsonResponse({ granted: true, credit_id: newCredit.id, amount: Number(newCredit.amount) })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)

  } catch (error) {
    console.error('check-seedling-credit error:', error)
    return jsonResponse({ error: error.message || 'Internal server error' }, 500)
  }
})

// ── Helpers ────────────────────────────────────────────────

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

interface LogEntry {
  action: string
  customer_email: string
  credit_amount: number
  credit_id?: string | null
  order_id?: string | null
  notes?: string | null
  status: 'success' | 'failed' | 'not_found'
}

function logActivity(client: ReturnType<typeof createClient>, entry: LogEntry) {
  try {
    // Fire-and-forget: don't await, don't block the response
    client
      .from('seedling_credit_log')
      .insert({
        action: entry.action,
        customer_email: entry.customer_email,
        credit_amount: entry.credit_amount,
        credit_id: entry.credit_id ?? null,
        order_id: entry.order_id ?? null,
        performed_by: null,
        status: entry.status,
        notes: entry.notes ?? null,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to log seedling credit activity:', error)
      })
  } catch (e) {
    console.error('Failed to log seedling credit activity:', e)
  }
}
