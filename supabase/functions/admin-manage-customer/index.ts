import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

interface ManageRequest {
  action: 'deactivate' | 'reactivate' | 'wipe'
  customer_id: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: adminRole } = await supabase
      .from('admin_user_roles')
      .select('id')
      .eq('customer_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, customer_id }: ManageRequest = await req.json()

    if (!action || !customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'action and customer_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the target customer
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('id', customer_id)
      .single()

    if (custError || !customer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminUserId = user.id

    switch (action) {
      case 'deactivate':
        return await handleDeactivate(supabase, customer, adminUserId)
      case 'reactivate':
        return await handleReactivate(supabase, customer, adminUserId)
      case 'wipe':
        return await handleWipe(supabase, customer, adminUserId)
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('admin-manage-customer error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ─── Deactivate ──────────────────────────────────────────────

async function handleDeactivate(
  supabase: ReturnType<typeof createClient>,
  customer: { id: string; email: string },
  adminUserId: string
) {
  // Prevent admin from deactivating themselves
  if (customer.id === adminUserId) {
    return jsonResponse({ success: false, error: 'Cannot deactivate your own account' }, 400)
  }

  // Update customers table
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      is_deactivated: true,
      deactivated_at: new Date().toISOString(),
      deactivated_by: adminUserId,
    })
    .eq('id', customer.id)

  if (updateError) {
    return jsonResponse({ success: false, error: `Failed to deactivate: ${updateError.message}` }, 500)
  }

  // Ban the auth user (prevent login)
  let authUserHandled = false
  try {
    const { error: banError } = await supabase.auth.admin.updateUserById(customer.id, {
      ban_duration: '876000h', // ~100 years
    })
    authUserHandled = !banError
    if (banError) {
      console.warn('Could not ban auth user:', banError.message)
    }
  } catch (err) {
    console.warn('Auth user may not exist:', err.message)
  }

  return jsonResponse({
    success: true,
    details: {
      auth_user_handled: authUserHandled,
      action: 'deactivated',
    },
  })
}

// ─── Reactivate ──────────────────────────────────────────────

async function handleReactivate(
  supabase: ReturnType<typeof createClient>,
  customer: { id: string; email: string },
  _adminUserId: string
) {
  // Update customers table
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      is_deactivated: false,
      deactivated_at: null,
      deactivated_by: null,
    })
    .eq('id', customer.id)

  if (updateError) {
    return jsonResponse({ success: false, error: `Failed to reactivate: ${updateError.message}` }, 500)
  }

  // Unban the auth user
  let authUserHandled = false
  try {
    const { error: unbanError } = await supabase.auth.admin.updateUserById(customer.id, {
      ban_duration: 'none',
    })
    authUserHandled = !unbanError
    if (unbanError) {
      console.warn('Could not unban auth user:', unbanError.message)
    }
  } catch (err) {
    console.warn('Auth user may not exist:', err.message)
  }

  return jsonResponse({
    success: true,
    details: {
      auth_user_handled: authUserHandled,
      action: 'reactivated',
    },
  })
}

// ─── Wipe All Data (GDPR) ───────────────────────────────────

async function handleWipe(
  supabase: ReturnType<typeof createClient>,
  customer: { id: string; email: string },
  adminUserId: string
) {
  // Prevent admin from wiping themselves
  if (customer.id === adminUserId) {
    return jsonResponse({ success: false, error: 'Cannot wipe your own account' }, 400)
  }

  const tablesAffected: string[] = []
  const warnings: string[] = []

  // Phase 1: Anonymize orders (preserve financial records, strip PII)
  try {
    const { error, count } = await supabase
      .from('orders')
      .update({
        customer_id: null,
        guest_email: '[redacted]',
        guest_phone: null,
        shipping_first_name: '[redacted]',
        shipping_last_name: '',
        shipping_company: null,
        shipping_address_line1: '[redacted]',
        shipping_address_line2: null,
        shipping_city: '[redacted]',
        shipping_state: 'XX',
        shipping_zip: '00000',
        shipping_phone: null,
        customer_notes: null,
        shipping_address_original: null,
        shipping_address_normalized: null,
      })
      .eq('customer_id', customer.id)

    if (error) {
      warnings.push(`orders: ${error.message}`)
    } else if (count && count > 0) {
      tablesAffected.push(`orders (${count} anonymized)`)
    }
  } catch (err) {
    warnings.push(`orders: ${err.message}`)
  }

  // Phase 1b: Anonymize legacy orders
  try {
    const { error, count } = await supabase
      .from('legacy_orders')
      .update({ customer_id: null })
      .eq('customer_id', customer.id)

    if (error) {
      warnings.push(`legacy_orders: ${error.message}`)
    } else if (count && count > 0) {
      tablesAffected.push(`legacy_orders (${count} anonymized)`)
    }
  } catch (err) {
    warnings.push(`legacy_orders: ${err.message}`)
  }

  // Phase 2: Null out FK references in SET NULL tables
  const nullUpdates: Array<{ table: string; column: string }> = [
    { table: 'newsletter_subscribers', column: 'customer_id' },
    { table: 'abandoned_carts', column: 'customer_id' },
    { table: 'back_in_stock_alerts', column: 'customer_id' },
    { table: 'gift_cards', column: 'purchaser_customer_id' },
    { table: 'gift_cards', column: 'created_by' },
    { table: 'order_refunds', column: 'created_by' },
    { table: 'order_status_history', column: 'changed_by' },
    { table: 'promotion_usage', column: 'customer_id' },
    { table: 'seedling_credit_log', column: 'performed_by' },
    { table: 'customer_tag_assignments', column: 'assigned_by' },
  ]

  for (const { table, column } of nullUpdates) {
    try {
      const { error } = await supabase
        .from(table)
        .update({ [column]: null })
        .eq(column, customer.id)

      if (error) {
        warnings.push(`${table}.${column}: ${error.message}`)
      } else {
        tablesAffected.push(`${table}.${column}`)
      }
    } catch (err) {
      warnings.push(`${table}.${column}: ${err.message}`)
    }
  }

  // Phase 3: Delete directly-owned data
  const deleteTables = [
    'customer_addresses',
    'customer_preferences',
    'customer_profiles',
    'customer_tag_assignments',
    'customer_attribution',
    'customer_favorites',
    'carts',
    'promotion_customers',
    'admin_user_roles',
  ]

  for (const table of deleteTables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('customer_id', customer.id)

      if (error) {
        warnings.push(`${table}: ${error.message}`)
      } else {
        tablesAffected.push(table)
      }
    } catch (err) {
      warnings.push(`${table}: ${err.message}`)
    }
  }

  // Phase 4: Delete the customer record
  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', customer.id)

  if (deleteError) {
    return jsonResponse({
      success: false,
      error: `Failed to delete customer record: ${deleteError.message}`,
      details: { tables_affected: tablesAffected, warnings },
    }, 500)
  }
  tablesAffected.push('customers')

  // Phase 5: Delete the auth.users account
  let authUserHandled = false
  try {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(customer.id)
    authUserHandled = !authDeleteError
    if (authDeleteError) {
      warnings.push(`auth.users: ${authDeleteError.message}`)
    }
  } catch (err) {
    // Auth user may not exist (admin-created customers without auth accounts)
    warnings.push(`auth.users: ${err.message}`)
  }

  return jsonResponse({
    success: true,
    details: {
      auth_user_handled: authUserHandled,
      tables_affected: tablesAffected,
      warnings: warnings.length > 0 ? warnings : undefined,
      action: 'wiped',
    },
  })
}
