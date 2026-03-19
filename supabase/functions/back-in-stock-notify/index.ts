import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

interface NotifyRequest {
  product_id: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase credentials' }),
        { status: 500, headers: jsonHeaders }
      )
    }

    const { product_id } = (await req.json()) as NotifyRequest

    if (!product_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'product_id is required' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Fetch pending alerts for this product with product info
    const { data: alerts, error: alertsError } = await supabase
      .from('back_in_stock_alerts')
      .select('id, email, customer_id')
      .eq('product_id', product_id)
      .eq('status', 'pending')

    if (alertsError) throw alertsError

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No pending alerts for this product' }),
        { status: 200, headers: jsonHeaders }
      )
    }

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name, slug, image_url, price, quantity_available')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: jsonHeaders }
      )
    }

    // Fetch customer names for personalization
    const customerIds = alerts.filter(a => a.customer_id).map(a => a.customer_id!)
    const customerMap = new Map<string, string>()

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, first_name')
        .in('id', customerIds)

      for (const c of customers || []) {
        if (c.first_name) customerMap.set(c.id, c.first_name)
      }
    }

    // Build the shop URL from branding/config
    const { data: siteUrlRow } = await supabase
      .from('config_settings')
      .select('value')
      .eq('category', 'business')
      .eq('key', 'site_url')
      .maybeSingle()

    const siteUrl = siteUrlRow?.value?.replace(/^"|"$/g, '') || 'https://deux.atlurbanfarms.com'
    const productUrl = `${siteUrl}/shop/${product.slug || ''}`

    // Send emails to all pending subscribers
    let sentCount = 0
    const errors: string[] = []

    for (const alert of alerts) {
      const firstName = alert.customer_id
        ? customerMap.get(alert.customer_id) || 'there'
        : 'there'

      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: alert.email,
            template: 'back_in_stock',
            templateData: {
              first_name: firstName,
              product_name: product.name,
              product_url: productUrl,
              product_image: product.image_url || '',
              product_price: product.price ? `$${Number(product.price).toFixed(2)}` : '',
            },
          }),
        })

        if (emailResponse.ok) {
          sentCount++
        } else {
          const result = await emailResponse.json().catch(() => ({}))
          errors.push(`${alert.email}: ${result.error || 'Send failed'}`)
        }
      } catch (err: any) {
        errors.push(`${alert.email}: ${err.message}`)
      }
    }

    // Mark all pending alerts as notified
    const { error: updateError } = await supabase
      .from('back_in_stock_alerts')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('product_id', product_id)
      .eq('status', 'pending')

    if (updateError) {
      console.error('Failed to update alert statuses:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: sentCount,
        total: alerts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: jsonHeaders }
    )
  } catch (err: any) {
    console.error('back-in-stock-notify error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      { status: 500, headers: jsonHeaders }
    )
  }
})
