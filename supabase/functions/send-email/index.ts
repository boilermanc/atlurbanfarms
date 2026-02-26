import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import nodemailer from 'npm:nodemailer@6.9.10'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings, getBrandingSettings } from '../_shared/settings.ts'

interface EmailRequest {
  to: string | string[]
  from?: string
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

// Fallback templates (used if database templates not available)
// The `brand` parameter carries colors from config_settings so fallback emails use the configured brand.
const fallbackTemplates: Record<string, (data: any, brand: Record<string, string>) => { subject: string; html: string }> = {
  order_confirmation: (data: any, brand: Record<string, string>) => ({
    subject: `Order Confirmation - #${data.orderNumber || data.order_id}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .footer { background: ${brand.primary_color}; color: white; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; }
          .btn { display: inline-block; background: ${brand.primary_color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
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
            <p>We've received your order and are getting it ready!</p>
            ${data.items ? formatOrderItems(data.items) : ''}
            ${generateDeliveryInfoHtml(data)}
            ${!data.pickupInfo ? `<p style="margin-top: 30px; color: #6b7280; font-size: 0.875rem;">
              Remember: We ship live plants Monday through Wednesday only to ensure they arrive fresh!
            </p>` : ''}
            ${data.siteUrl ? `<p style="text-align: center; margin-top: 30px;"><a href="${data.siteUrl}/account/orders" class="btn">View Invoice</a></p>` : ''}
          </div>
          <div class="footer">
            <p style="margin: 0 0 5px; font-size: 14px;">www.AtlUrbanFarms.com</p>
            <p style="margin: 0; font-size: 12px;">ATL Urban Farms, a Sweetwater Urban Farms company – Powered by Sweetwater Technology</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_notification: (data: any, brand: Record<string, string>) => ({
    subject: `Your Order Has Shipped - #${data.orderNumber || data.order_id}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
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

  welcome: (data: any, brand: Record<string, string>) => ({
    subject: 'Welcome to ATL Urban Farms!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
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

  password_reset: (data: any, brand: Record<string, string>) => ({
    subject: 'Reset Your Password - ATL Urban Farms',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
          .button { display: inline-block; background: ${brand.primary_color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
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
  }),

  // New shipping email fallback templates
  shipping_label_created: (data: any, brand: Record<string, string>) => ({
    subject: 'Your ATL Urban Farms order has shipped!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .tracking-box { background: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: ${brand.primary_color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Order Has Shipped!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Great news! Your order <strong>#${data.order_number}</strong> has been shipped.</p>
            <div class="tracking-box">
              <p style="color: #166534; margin: 0 0 10px;">Tracking Number</p>
              <p style="font-size: 1.25rem; font-weight: bold; color: ${brand.primary_color}; margin: 0 0 10px;">${data.tracking_number}</p>
              <p style="color: #666; margin: 0 0 15px;">Carrier: ${data.carrier}</p>
              <a href="${data.tracking_url}" class="button">Track Your Package</a>
            </div>
            <p style="color: #666; font-size: 0.875rem;">
              Please unbox your plants as soon as they arrive. Happy growing!
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_in_transit: (data: any, _brand: Record<string, string>) => ({
    subject: 'Your plants are on the way!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .tracking-box { background: #eff6ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Plants Are On The Way!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Your order <strong>#${data.order_number}</strong> is making its way to you!</p>
            <div class="tracking-box">
              <p style="color: #1e40af; margin: 0 0 10px;">Current Location</p>
              <p style="font-size: 1.25rem; font-weight: bold; color: #1d4ed8; margin: 0 0 15px;">${data.current_location || 'In Transit'}</p>
              <p style="color: #666; margin: 0 0 10px;">Tracking: ${data.tracking_number}</p>
              <a href="${data.tracking_url}" class="button">Track Your Package</a>
            </div>
            <p>Estimated Delivery: <strong>${data.estimated_delivery || 'Check tracking for updates'}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_out_for_delivery: (data: any, _brand: Record<string, string>) => ({
    subject: 'Your plants are out for delivery today!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .delivery-box { background: #fef3c7; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Out for Delivery!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Exciting news! Your order <strong>#${data.order_number}</strong> is out for delivery today!</p>
            <div class="delivery-box">
              <p style="font-size: 2rem; margin: 0 0 10px;">🚚</p>
              <p style="font-size: 1.25rem; font-weight: bold; color: #92400e; margin: 0 0 15px;">Arriving Today!</p>
              <p style="color: #78350f; margin: 0;">Carrier: ${data.carrier}</p>
              <a href="${data.tracking_url}" class="button">Track Your Delivery</a>
            </div>
            <p style="color: #666; font-size: 0.875rem;">
              Please bring your plants inside as soon as they arrive!
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  shipping_delivered: (data: any, brand: Record<string, string>) => ({
    subject: 'Your plants have been delivered!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .delivered-box { background: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .tips { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p style="font-size: 2.5rem; margin: 0 0 10px;">🌱</p>
            <h1>Delivered!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Your order <strong>#${data.order_number}</strong> has been delivered!</p>
            <div class="delivered-box">
              <p style="color: #166534; margin: 0 0 10px;">Delivered On</p>
              <p style="font-size: 1.25rem; font-weight: bold; color: ${brand.primary_color}; margin: 0;">${data.delivery_date || 'Today'}</p>
            </div>
            <div class="tips">
              <h3 style="color: ${brand.primary_color}; margin: 0 0 15px;">Getting Started with Your Plants</h3>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li>Unbox carefully - Remove packaging gently</li>
                <li>Water if dry - Check soil moisture</li>
                <li>Acclimate slowly - Place in indirect light for a few days</li>
                <li>Be patient - Some stress after shipping is normal</li>
              </ul>
            </div>
            <p>Happy growing!<br><strong>The ATL Urban Farms Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  pickup_ready: (data: any, _brand: Record<string, string>) => ({
    subject: 'Your order is ready for pickup!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .pickup-box { background: #f5f3ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p style="font-size: 2.5rem; margin: 0 0 10px;">📦</p>
            <h1>Ready for Pickup!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Your order <strong>#${data.order_number}</strong> is packed and ready for pickup.</p>
            <div class="pickup-box">
              <h3 style="color: #7c3aed; margin: 0 0 15px;">Pickup Location</h3>
              <p style="font-weight: bold; margin: 0 0 5px;">${data.pickup_location}</p>
              <p style="color: #666; margin: 0 0 20px;">${data.pickup_address}</p>
              <h4 style="color: #7c3aed; margin: 0 0 10px;">Pickup Date & Time</h4>
              <p style="margin: 0;"><strong>${data.pickup_date}</strong> at <strong>${data.pickup_time}</strong></p>
            </div>
            <p style="color: #666; font-size: 0.875rem;">
              ${data.pickup_instructions || 'Please bring a valid ID and your order confirmation email.'}
            </p>
            <p>See you soon!<br><strong>The ATL Urban Farms Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  newsletter_confirmation: (data: any, brand: Record<string, string>) => ({
    subject: 'Confirm your ATL Urban Farms newsletter subscription',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${brand.primary_color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background: ${brand.primary_color}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; font-size: 16px; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Almost There!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.first_name || 'there'},</p>
            <p>Thanks for signing up for the ATL Urban Farms newsletter! Please confirm your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="${data.confirmation_url}" class="button">Confirm My Subscription</a>
            </div>
            <p style="color: #6b7280; font-size: 0.875rem; margin-top: 20px;">
              This link expires in 48 hours. If you didn't sign up for our newsletter, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>ATL Urban Farms<br>${data.business_address || 'Atlanta, GA'}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  pickup_reminder: (data: any, _brand: Record<string, string>) => ({
    subject: 'Reminder: Pick up your plants tomorrow!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .pickup-box { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p style="font-size: 2.5rem; margin: 0 0 10px;">⏰</p>
            <h1>Pickup Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customer_name || 'there'},</p>
            <p>Just a friendly reminder that your order <strong>#${data.order_number}</strong> is ready and waiting for you!</p>
            <div class="pickup-box">
              <h3 style="color: #92400e; margin: 0 0 15px;">Tomorrow's Pickup</h3>
              <p style="font-weight: bold; margin: 0 0 5px;">${data.pickup_location}</p>
              <p style="color: #78350f; margin: 0 0 20px;">${data.pickup_address}</p>
              <p style="margin: 0;"><strong>${data.pickup_date}</strong> at <strong>${data.pickup_time}</strong></p>
            </div>
            <p style="color: #666; font-size: 0.875rem;">
              Don't forget to bring this email and a valid photo ID!
            </p>
            <p>See you tomorrow!<br><strong>The ATL Urban Farms Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  })
}

// Format a number as USD currency string
function formatCurrency(value: any): string {
  const num = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(num)) return '$0.00'
  return `$${num.toFixed(2)}`
}

// Format order items array into an HTML table for the email template
function formatOrderItems(items: any[]): string {
  if (!items || !Array.isArray(items) || items.length === 0) return ''

  let html = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">'
  html += '<tr style="background-color: #f0fdf4;">'
  html += '<td style="text-align: left; padding: 10px 12px; color: #166534; font-size: 13px; font-weight: bold;">Product</td>'
  html += '<td style="text-align: center; padding: 10px 12px; color: #166534; font-size: 13px; font-weight: bold; width: 60px;">Qty</td>'
  html += '<td style="text-align: right; padding: 10px 12px; color: #166534; font-size: 13px; font-weight: bold; width: 80px;">Price</td>'
  html += '</tr>'

  for (const item of items) {
    const name = item.name || item.product_name || 'Item'
    const qty = item.quantity || 1
    const price = item.price || item.unit_price || 0
    const lineTotal = price * qty
    html += '<tr style="border-bottom: 1px solid #e5e7eb;">'
    html += `<td style="padding: 10px 12px; color: #333; font-size: 14px;">${name}</td>`
    html += `<td style="text-align: center; padding: 10px 12px; color: #333; font-size: 14px;">${qty}</td>`
    html += `<td style="text-align: right; padding: 10px 12px; color: #333; font-size: 14px;">${formatCurrency(lineTotal)}</td>`
    html += '</tr>'

    // Render bundle component sub-items
    if (item.bundleItems && Array.isArray(item.bundleItems) && item.bundleItems.length > 0) {
      for (const bi of item.bundleItems) {
        html += '<tr>'
        html += `<td colspan="3" style="padding: 2px 12px 2px 28px; color: #9ca3af; font-size: 12px; font-style: italic;">`
        html += `${bi.quantity > 1 ? bi.quantity + 'x ' : ''}${bi.name}`
        html += '</td>'
        html += '</tr>'
      }
    }
  }

  html += '</table>'
  return html
}

// Generate delivery info HTML (shipping address or pickup details)
function generateDeliveryInfoHtml(data: Record<string, any>): string {
  if (data.pickupInfo) {
    const p = data.pickupInfo
    const parts: string[] = []
    parts.push('<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ff; border-radius: 8px; margin: 25px 0;"><tr><td style="padding: 20px;">')
    parts.push('<h3 style="color: #7c3aed; margin: 0 0 15px; font-size: 16px;">Pickup Details</h3>')
    parts.push(`<p style="color: #333; font-size: 14px; margin: 0 0 5px; font-weight: bold;">${p.locationName || 'Pickup Location'}</p>`)
    if (p.address) parts.push(`<p style="color: #666; font-size: 14px; margin: 0 0 10px;">${p.address}</p>`)
    if (p.date) parts.push(`<p style="color: #333; font-size: 14px; margin: 0 0 5px;"><strong>Date:</strong> ${p.date}</p>`)
    const time = p.timeRange || p.time
    if (time) parts.push(`<p style="color: #333; font-size: 14px; margin: 0;"><strong>Time:</strong> ${time}</p>`)
    if (p.instructions) parts.push(`<p style="color: #666; font-size: 13px; margin: 10px 0 0; font-style: italic;">${p.instructions}</p>`)
    parts.push('</td></tr></table>')
    return parts.join('')
  }

  if (data.shippingAddress) {
    const a = data.shippingAddress
    const parts: string[] = []
    parts.push('<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 8px; margin: 25px 0;"><tr><td style="padding: 20px;">')
    parts.push('<h3 style="color: #166534; margin: 0 0 15px; font-size: 16px;">Shipping To</h3>')
    if (a.name) parts.push(`<p style="color: #333; font-size: 14px; margin: 0 0 5px; font-weight: bold;">${a.name}</p>`)
    if (a.address) parts.push(`<p style="color: #666; font-size: 14px; margin: 0 0 3px;">${a.address}</p>`)
    const cityStateZip = [a.city, a.state].filter(Boolean).join(', ') + (a.zip ? ' ' + a.zip : '')
    if (cityStateZip.trim()) parts.push(`<p style="color: #666; font-size: 14px; margin: 0;">${cityStateZip}</p>`)
    if (data.shippingMethodName) parts.push(`<p style="color: #333; font-size: 14px; margin: 10px 0 0;"><strong>Ships via:</strong> ${data.shippingMethodName}</p>`)
    if (data.estimatedDeliveryDate) {
      try {
        const d = new Date(data.estimatedDeliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        parts.push(`<p style="color: #333; font-size: 14px; margin: 5px 0 0;"><strong>Ship Date:</strong> ${d}</p>`)
      } catch { /* ignore date parse errors */ }
    }
    parts.push('</td></tr></table>')
    return parts.join('')
  }

  return ''
}

// Normalize templateData keys from camelCase (client) to snake_case (DB templates)
// Also formats values (currency, item lists, dates) for direct template substitution
function normalizeTemplateData(templateKey: string, data: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...data }

  if (templateKey === 'order_confirmation') {
    // Map camelCase → snake_case for order confirmation template variables
    if (data.orderNumber !== undefined) normalized.order_id = data.orderNumber
    if (data.customerName !== undefined) normalized.customer_first_name = data.customerName
    if (data.items !== undefined) normalized.order_items = formatOrderItems(data.items)
    if (data.subtotal !== undefined) normalized.order_subtotal = formatCurrency(data.subtotal)
    if (data.shipping !== undefined) normalized.order_shipping = formatCurrency(data.shipping)
    if (data.tax !== undefined) normalized.order_tax = formatCurrency(data.tax)
    if (data.total !== undefined) normalized.order_total = formatCurrency(data.total)

    // Add order_date if not provided
    if (!data.order_date) {
      normalized.order_date = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    }

    // Generate delivery info HTML (shipping address or pickup details)
    normalized.delivery_info = generateDeliveryInfoHtml(data)

    // Invoice URL — constructed from siteUrl passed by the client
    const siteUrl = data.siteUrl || ''
    normalized.invoice_url = siteUrl ? `${siteUrl}/account/orders` : '#'
  }

  return normalized
}

// Map old template names to new ones
const templateKeyMap: Record<string, string> = {
  'shipping_update': 'shipping_notification',
}

// Templates that are marketing emails (need List-Unsubscribe headers + unsubscribe link)
const MARKETING_TEMPLATES = new Set([
  'newsletter_confirmation',
  'newsletter_welcome',
  'abandoned_cart',
  'abandoned-cart-reminder',
])

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

    // Fetch shared email header and footer from brand settings
    const { data: brandRows } = await supabaseClient
      .from('email_brand_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_header', 'email_footer'])

    let emailHeader = ''
    let emailFooter = ''
    if (brandRows) {
      for (const row of brandRows) {
        if (row.setting_key === 'email_header') emailHeader = row.setting_value || ''
        if (row.setting_key === 'email_footer') emailFooter = row.setting_value || ''
      }
    }

    // Get SMTP settings from database
    const settings = await getIntegrationSettings(supabaseClient, [
      'smtp_enabled',
      'smtp_host',
      'smtp_port',
      'smtp_username',
      'smtp_password',
      'smtp_from_email',
      'smtp_from_name'
    ])

    if (!settings.smtp_enabled) {
      return new Response(
        JSON.stringify({ error: 'Email sending is not enabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!settings.smtp_username || !settings.smtp_password) {
      return new Response(
        JSON.stringify({ error: 'SMTP credentials are not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { to, from: fromOverride, subject, html, text, template, templateData }: EmailRequest = await req.json()

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

      // Fetch brand settings once — used by both DB templates and fallbacks
      const brandSettings = await getBrandingSettings(supabaseClient)

      if (dbTemplate) {
        // Use database template
        console.log(`Using database template: ${templateKey}`)

        // Normalize camelCase client data to snake_case template variables
        const normalizedData = normalizeTemplateData(templateKey, templateData || {})

        // Merge template data with brand settings (brand settings provide
        // primary_color, secondary_color, logo_url, business_name, etc.)
        const allVariables = {
          ...brandSettings,
          ...normalizedData,
        }

        // Order confirmation enrichment (shipping note, header content)
        if (templateKey === 'order_confirmation') {
          // Fetch shipping customer message from config_settings
          const { data: shippingNote } = await supabaseClient
            .from('config_settings')
            .select('value')
            .eq('category', 'shipping')
            .eq('key', 'customer_shipping_message')
            .maybeSingle()

          // Only show shipping note for non-pickup orders
          const isPickupOrder = !!(templateData && templateData.pickupInfo)
          if (!isPickupOrder) {
            allVariables.shipping_note = shippingNote?.value
              || allVariables.shipping_note
              || 'We ship live plants Monday through Wednesday only to ensure they arrive fresh and healthy!'
          } else {
            allVariables.shipping_note = ''
          }

          // Generate header content — use logo image if available, otherwise text
          if (allVariables.logo_url) {
            allVariables.header_content = `<img src="${allVariables.logo_url}" alt="${allVariables.business_name}" style="max-height: 60px; max-width: 200px;">`
          } else {
            allVariables.header_content = `<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${allVariables.business_name}</h1>`
          }
        }

        // Auto-populate unsubscribe_url for marketing emails if not already set
        if (!allVariables.unsubscribe_url && MARKETING_TEMPLATES.has(templateKey)) {
          const recipientEmail = (Array.isArray(to) ? to[0] : to)?.toLowerCase()
          if (recipientEmail) {
            const { data: subscriber } = await supabaseClient
              .from('newsletter_subscribers')
              .select('unsubscribe_token')
              .eq('email', recipientEmail)
              .not('unsubscribe_token', 'is', null)
              .maybeSingle()

            if (subscriber?.unsubscribe_token) {
              const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
              allVariables.unsubscribe_url = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${subscriber.unsubscribe_token}`
            }
          }
        }

        // Replace variables in subject and content
        emailSubject = emailSubject || replaceVariables(dbTemplate.subject_line, allVariables)
        emailHtml = emailHtml || replaceVariables(dbTemplate.html_content, allVariables)
        emailText = emailText || (dbTemplate.plain_text_content ? replaceVariables(dbTemplate.plain_text_content, allVariables) : undefined)
      } else if (fallbackTemplates[templateKey]) {
        // Use fallback template with brand colors
        console.log(`Using fallback template: ${templateKey}`)
        const generated = fallbackTemplates[templateKey](templateData || {}, brandSettings)
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

    // Wrap html with shared header/footer if available
    // Skip if header is empty or content is already a full HTML document (e.g. fallback templates)
    if (emailHtml && emailHeader && !emailHtml.includes('<!DOCTYPE')) {
      emailHtml = emailHeader + emailHtml + emailFooter
    }

    // Prepare email recipients
    const recipients = Array.isArray(to) ? to : [to]

    // Determine if this is a marketing email that needs List-Unsubscribe headers
    const templateKey = template ? (templateKeyMap[template] || template) : null
    const isMarketingEmail = templateKey && MARKETING_TEMPLATES.has(templateKey)

    // Build unsubscribe URL for List-Unsubscribe header
    let listUnsubscribeHeaders: Record<string, string> | undefined
    if (isMarketingEmail) {
      const recipientEmail = recipients[0]?.toLowerCase()
      if (recipientEmail) {
        const { data: subscriber } = await supabaseClient
          .from('newsletter_subscribers')
          .select('unsubscribe_token')
          .eq('email', recipientEmail)
          .not('unsubscribe_token', 'is', null)
          .maybeSingle()

        if (subscriber?.unsubscribe_token) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const unsubUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${subscriber.unsubscribe_token}`
          listUnsubscribeHeaders = {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        }
      }
    }

    // Send email via SMTP (Google Workspace)
    const fromAddress = fromOverride || (settings.smtp_from_name
      ? `${settings.smtp_from_name} <${settings.smtp_from_email}>`
      : settings.smtp_from_email)

    const transport = nodemailer.createTransport({
      host: settings.smtp_host || 'smtp.gmail.com',
      port: Number(settings.smtp_port) || 465,
      secure: (Number(settings.smtp_port) || 465) === 465,
      auth: {
        user: settings.smtp_username,
        pass: settings.smtp_password,
      },
    })

    const info = await transport.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      ...(listUnsubscribeHeaders ? { headers: listUnsubscribeHeaders } : {}),
    })

    return new Response(
      JSON.stringify({ success: true, id: info.messageId || crypto.randomUUID() }),
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
