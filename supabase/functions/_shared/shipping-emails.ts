/**
 * Shipping Email Utilities for Edge Functions
 *
 * This module provides utilities for sending shipping-related emails
 * from within Supabase Edge Functions.
 */

export type ShippingEmailTemplate =
  | 'shipping_label_created'
  | 'shipping_in_transit'
  | 'shipping_out_for_delivery'
  | 'shipping_delivered'
  | 'pickup_ready'
  | 'pickup_reminder'

export interface ShippingEmailData {
  customer_name?: string
  customer_email?: string
  order_number?: string
  tracking_number?: string
  carrier?: string
  carrier_code?: string
  tracking_url?: string
  estimated_delivery?: string
  current_location?: string
  delivery_date?: string
  pickup_location?: string
  pickup_address?: string
  pickup_date?: string
  pickup_time?: string
  pickup_instructions?: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Get carrier display name from carrier code
 */
export function getCarrierDisplayName(carrierCode: string): string {
  const carriers: Record<string, string> = {
    'usps': 'USPS',
    'ups': 'UPS',
    'fedex': 'FedEx',
    'dhl': 'DHL',
    'dhl_express': 'DHL Express',
    'ontrac': 'OnTrac',
    'canada_post': 'Canada Post',
  }
  return carriers[carrierCode?.toLowerCase()] || carrierCode?.toUpperCase() || 'Carrier'
}

/**
 * Format date for email display
 */
export function formatDateForEmail(dateString: string | null | undefined): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

/**
 * Generate tracking URL from tracking number and carrier
 */
export function generateTrackingUrl(trackingNumber: string, carrierCode: string): string {
  if (!trackingNumber) return ''

  const baseUrls: Record<string, string> = {
    'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
    'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    'dhl': `https://www.dhl.com/us-en/home/tracking/tracking-global-forwarding.html?submit=1&tracking-id=${trackingNumber}`,
    'dhl_express': `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
  }

  return baseUrls[carrierCode?.toLowerCase()] ||
    `https://track.shipengine.com/${trackingNumber}`
}

/**
 * Send a shipping notification email
 *
 * @param supabaseClient - Supabase client with service role
 * @param templateSlug - The email template to use
 * @param orderId - The order ID
 * @param additionalData - Additional template data
 */
export async function sendShippingEmail(
  supabaseClient: any,
  templateSlug: ShippingEmailTemplate,
  orderId: string,
  additionalData?: ShippingEmailData
): Promise<SendEmailResult> {
  try {
    console.log(`Preparing shipping email: ${templateSlug} for order ${orderId}`)

    // Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        shipping_first_name,
        shipping_last_name
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found for shipping email:', orderId)
      return { success: false, error: 'Order not found' }
    }

    // Fetch customer email
    let customerEmail = additionalData?.customer_email
    let customerName = additionalData?.customer_name

    if (order.customer_id && (!customerEmail || !customerName)) {
      const { data: customer } = await supabaseClient
        .from('customers')
        .select('email, first_name, last_name')
        .eq('id', order.customer_id)
        .single()

      if (customer) {
        customerEmail = customerEmail || customer.email
        customerName = customerName || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
      }
    }

    if (!customerName && order.shipping_first_name) {
      customerName = `${order.shipping_first_name} ${order.shipping_last_name || ''}`.trim()
    }

    if (!customerEmail) {
      console.error('Customer email not found for order:', orderId)
      return { success: false, error: 'Customer email not found' }
    }

    // Fetch shipment details if shipping-related template
    let shipmentData: any = {}
    if (templateSlug.startsWith('shipping_')) {
      const { data: shipment } = await supabaseClient
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .eq('voided', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (shipment) {
        shipmentData = shipment
      }
    }

    // Build template data
    const carrierCode = shipmentData.carrier_code || additionalData?.carrier_code || ''
    const trackingNumber = additionalData?.tracking_number || shipmentData.tracking_number || ''

    const templateData: Record<string, string> = {
      customer_name: customerName || 'Valued Customer',
      customer_email: customerEmail,
      order_number: order.order_number || order.id,
      tracking_number: trackingNumber,
      carrier: additionalData?.carrier || getCarrierDisplayName(carrierCode),
      tracking_url: additionalData?.tracking_url || generateTrackingUrl(trackingNumber, carrierCode),
      estimated_delivery: additionalData?.estimated_delivery || formatDateForEmail(shipmentData.estimated_delivery_date),
      current_location: additionalData?.current_location || shipmentData.tracking_status_description || '',
      delivery_date: additionalData?.delivery_date || formatDateForEmail(shipmentData.actual_delivery_date),
      pickup_location: additionalData?.pickup_location || '',
      pickup_address: additionalData?.pickup_address || '',
      pickup_date: additionalData?.pickup_date || '',
      pickup_time: additionalData?.pickup_time || '',
      pickup_instructions: additionalData?.pickup_instructions || 'Please bring a valid ID and your order confirmation.',
    }

    // Call the email edge function via HTTP
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log(`Sending ${templateSlug} email to ${customerEmail}`)

    const response = await fetch(`${supabaseUrl}/functions/v1/resend-send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customerEmail,
        template: templateSlug,
        templateData,
      }),
    })

    const result = await response.json()

    if (!response.ok || result.error) {
      console.error('Failed to send shipping email:', result)
      return { success: false, error: result.error || 'Failed to send email' }
    }

    console.log(`Shipping email sent successfully: ${templateSlug} for order ${orderId}, email ID: ${result.id}`)
    return { success: true, id: result.id }
  } catch (err: any) {
    console.error('Error sending shipping email:', err)
    return { success: false, error: err.message || 'Failed to send email' }
  }
}

/**
 * Map ShipEngine tracking status codes to email templates
 */
export function getEmailTemplateForTrackingStatus(statusCode: string): ShippingEmailTemplate | null {
  const statusMap: Record<string, ShippingEmailTemplate> = {
    'IT': 'shipping_in_transit',    // In Transit
    'OT': 'shipping_out_for_delivery', // Out for Delivery (some carriers use OT)
    'DE': 'shipping_delivered',     // Delivered
    // Note: Label creation is handled separately when label is created
  }

  return statusMap[statusCode] || null
}

/**
 * Check if we should send an email for this tracking status change
 */
export function shouldSendTrackingEmail(
  newStatus: string,
  previousStatus: string | null
): boolean {
  // Don't re-send for same status
  if (newStatus === previousStatus) {
    return false
  }

  // Only send for specific statuses
  const emailStatuses = ['IT', 'OT', 'DE']
  return emailStatuses.includes(newStatus)
}
