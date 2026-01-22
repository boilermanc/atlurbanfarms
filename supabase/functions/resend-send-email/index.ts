import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface EmailRequest {
  to: string | string[]
  subject?: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
}

interface EmailTemplate {
  id: string
  template_key: string
  name: string
  subject_line: string
  html_content: string
  plain_text_content: string | null
  is_active: boolean
}

interface BrandSetting {
  setting_key: string
  setting_value: string | null
}

// Replace {{variable}} placeholders with actual values
function replaceVariables(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value !== undefined && value !== null) {
      return String(value)
    }
    return match // Keep original placeholder if no value
  })
}

// Fetch email template from database
async function getEmailTemplate(
  supabase: any,
  templateKey: string
): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single()

  if (error) {
    console.log(`Template "${templateKey}" not found in database, using fallback`)
    return null
  }

  return data
}

// Fetch brand settings from database
async function getBrandSettings(supabase: any): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('email_brand_settings')
    .select('setting_key, setting_value')

  if (error) {
    console.error('Failed to fetch brand settings:', error)
    return {}
  }

  const settings: Record<string, string> = {}
  data?.forEach((s: BrandSetting) => {
    if (s.setting_value) {
      settings[s.setting_key] = s.setting_value
    }
  })

  // Add computed values
  settings.current_year = new Date().getFullYear().toString()

  return settings
}

// Fallback templates (used if database templates not available)
const fallbackTemplates: Record<string, (data: any) => { subject: string; html: string }> = {
  order_confirmation: (data: any) => ({
    subject: `Order Confirmation - #${data.orderNumber || data.order_id}`,
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
            <h1>Thank You for Your Order!</h1>
            <p>Order #${data.orderNumber || data.order_id}</p>
          </div>
          <div class="content">
            <p>Hi ${data.customerName || data.customer_first_name || 'there'},</p>
            <p>We've received your order and are getting it ready. We'll notify you when it ships!</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 0.875rem;">
              Remember: We ship live plants Monday through Wednesday only to ensure they arrive fresh!
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_notification: (data: any) => ({
    subject: `Your Order Has Shipped - #${data.orderNumber || data.order_id}`,
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
            <h1>Your Order Has Shipped!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customerName || data.customer_first_name || 'there'},</p>
            <p>Great news! Your order is on its way.</p>
            <p>Tracking Number: <strong>${data.trackingNumber || data.tracking_number}</strong></p>
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
            <p>Hi ${data.name || data.customer_first_name || 'there'},</p>
            <p>Thanks for creating an account with us! We're excited to help you grow your garden.</p>
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
            <a href="${data.resetUrl || data.reset_url}" class="button">Reset Password</a>
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

// Map old template names to new ones
const templateKeyMap: Record<string, string> = {
  'shipping_update': 'shipping_notification',
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

    // If using a template, try to fetch from database first
    if (template) {
      // Map old template names to new ones
      const templateKey = templateKeyMap[template] || template

      // Try to get template from database
      const dbTemplate = await getEmailTemplate(supabaseClient, templateKey)

      if (dbTemplate) {
        // Use database template
        console.log(`Using database template: ${templateKey}`)

        // Get brand settings for global variables
        const brandSettings = await getBrandSettings(supabaseClient)

        // Merge template data with brand settings
        const allVariables = {
          ...brandSettings,
          ...templateData,
        }

        // Replace variables in subject and content
        emailSubject = emailSubject || replaceVariables(dbTemplate.subject_line, allVariables)
        emailHtml = emailHtml || replaceVariables(dbTemplate.html_content, allVariables)
        emailText = emailText || (dbTemplate.plain_text_content ? replaceVariables(dbTemplate.plain_text_content, allVariables) : undefined)
      } else if (fallbackTemplates[templateKey]) {
        // Use fallback template
        console.log(`Using fallback template: ${templateKey}`)
        const generated = fallbackTemplates[templateKey](templateData || {})
        emailSubject = emailSubject || generated.subject
        emailHtml = emailHtml || generated.html
      } else {
        console.warn(`Template "${templateKey}" not found`)
      }
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
