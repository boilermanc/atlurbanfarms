import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface EmailRequest {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: 'order_confirmation' | 'shipping_update' | 'welcome' | 'password_reset'
  templateData?: Record<string, any>
}

// Email templates
const templates = {
  order_confirmation: (data: any) => ({
    subject: `Order Confirmation - #${data.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .order-item { display: flex; padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .totals { margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .grand-total { font-size: 1.25rem; font-weight: bold; color: #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Your Order!</h1>
            <p>Order #${data.orderNumber}</p>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>We've received your order and are getting it ready. We'll notify you when it ships!</p>

            <h3>Order Summary</h3>
            ${data.items.map((item: any) => `
              <div class="order-item">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}

            <div class="totals">
              <div class="total-row">
                <span>Subtotal</span>
                <span>$${data.subtotal.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>Shipping</span>
                <span>$${data.shipping.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>Tax</span>
                <span>$${data.tax.toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span>Total</span>
                <span>$${data.total.toFixed(2)}</span>
              </div>
            </div>

            <h3>Shipping Address</h3>
            <p>
              ${data.shippingAddress.name}<br>
              ${data.shippingAddress.address}<br>
              ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zip}
            </p>

            <p style="margin-top: 30px; color: #6b7280; font-size: 0.875rem;">
              Remember: We ship live plants Monday through Wednesday only to ensure they arrive fresh!
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_update: (data: any) => ({
    subject: `Your Order Has Shipped - #${data.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .tracking-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .tracking-number { font-size: 1.5rem; font-weight: bold; color: #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Order Has Shipped!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Great news! Your order #${data.orderNumber} is on its way.</p>

            <div class="tracking-box">
              <p>Tracking Number</p>
              <p class="tracking-number">${data.trackingNumber}</p>
              <p><a href="${data.trackingUrl}" style="color: #10b981;">Track Your Package</a></p>
            </div>

            <p style="margin-top: 30px; color: #6b7280; font-size: 0.875rem;">
              Please ensure someone is available to receive the package, as live plants are sensitive to temperature.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  welcome: (data: any) => ({
    subject: 'Welcome to ATL Urban Farms!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ATL Urban Farms!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>Thanks for creating an account with us! We're excited to help you grow your garden.</p>
            <p>As a member, you'll enjoy:</p>
            <ul>
              <li>Order tracking and history</li>
              <li>Saved addresses for faster checkout</li>
              <li>Exclusive member offers</li>
              <li>Access to Sage, our AI gardening assistant</li>
            </ul>
            <p>Happy growing!</p>
            <p>- The ATL Urban Farms Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  password_reset: (data: any) => ({
    subject: 'Reset Your Password - ATL Urban Farms',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to choose a new one:</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            <p style="color: #6b7280; font-size: 0.875rem;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  })
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

    // Get Resend settings from database
    const settings = await getIntegrationSettings(supabaseClient, [
      'resend_enabled',
      'resend_api_key',
      'resend_from_email',
      'resend_from_name'
    ])

    if (!settings.resend_enabled) {
      return new Response(
        JSON.stringify({ error: 'Resend is not enabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!settings.resend_api_key) {
      return new Response(
        JSON.stringify({ error: 'Resend API key is not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { to, subject, html, text, template, templateData }: EmailRequest = await req.json()

    // Build email content
    let emailSubject = subject
    let emailHtml = html
    let emailText = text

    // If using a template, generate content
    if (template && templates[template]) {
      const generated = templates[template](templateData || {})
      emailSubject = emailSubject || generated.subject
      emailHtml = emailHtml || generated.html
    }

    if (!emailSubject || (!emailHtml && !emailText)) {
      return new Response(
        JSON.stringify({ error: 'Subject and content (html or text) are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare email recipients
    const recipients = Array.isArray(to) ? to : [to]

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: settings.resend_from_name
          ? `${settings.resend_from_name} <${settings.resend_from_email}>`
          : settings.resend_from_email,
        to: recipients,
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', result)
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to send email' }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Email send error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
