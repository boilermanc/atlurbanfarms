import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ShippingEmailTemplate =
  | 'shipping_label_created'
  | 'shipping_in_transit'
  | 'shipping_out_for_delivery'
  | 'shipping_delivered'
  | 'pickup_ready'
  | 'pickup_reminder'

interface ShippingEmailData {
  // Common fields
  customer_name?: string
  customer_email?: string
  order_number?: string

  // Shipping fields
  tracking_number?: string
  carrier?: string
  carrier_code?: string
  tracking_url?: string
  estimated_delivery?: string
  current_location?: string
  delivery_date?: string

  // Pickup fields
  pickup_location?: string
  pickup_address?: string
  pickup_date?: string
  pickup_time?: string
  pickup_instructions?: string
}

interface SendShippingEmailResult {
  success: boolean
  id?: string
  error?: string
}

interface OrderDetails {
  id: string
  order_number?: string
  customer_id?: string
  customer_email?: string
  customer_name?: string
  shipping_first_name?: string
  shipping_last_name?: string
}

interface ShipmentDetails {
  tracking_number?: string
  carrier_code?: string
  carrier_id?: string
  estimated_delivery_date?: string
  actual_delivery_date?: string
  tracking_status?: string
  tracking_status_description?: string
}

/**
 * Get carrier display name from carrier code
 */
function getCarrierDisplayName(carrierCode: string): string {
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
function formatDateForEmail(dateString: string | null | undefined): string {
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
function generateTrackingUrl(trackingNumber: string, carrierCode: string): string {
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
 * Hook for sending shipping-related emails
 */
export function useShippingEmails() {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Send a shipping email using a template
   *
   * @param templateSlug - The template key (e.g., 'shipping_label_created')
   * @param orderId - The order ID to fetch details from
   * @param additionalData - Additional template data to merge
   */
  const sendShippingEmail = useCallback(async (
    templateSlug: ShippingEmailTemplate,
    orderId: string,
    additionalData?: ShippingEmailData
  ): Promise<SendShippingEmailResult> => {
    setSending(true)
    setError(null)

    try {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
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
        throw new Error('Order not found')
      }

      // Fetch customer details
      let customerEmail = additionalData?.customer_email
      let customerName = additionalData?.customer_name

      if (order.customer_id && (!customerEmail || !customerName)) {
        const { data: customer } = await supabase
          .from('customers')
          .select('email, first_name, last_name')
          .eq('id', order.customer_id)
          .single()

        if (customer) {
          customerEmail = customerEmail || customer.email
          customerName = customerName || `${customer.first_name} ${customer.last_name}`.trim()
        }
      }

      // If still no name, try shipping name
      if (!customerName && order.shipping_first_name) {
        customerName = `${order.shipping_first_name} ${order.shipping_last_name || ''}`.trim()
      }

      if (!customerEmail) {
        throw new Error('Customer email not found')
      }

      // Fetch shipment details if shipping-related template
      let shipmentData: ShipmentDetails = {}
      if (templateSlug.startsWith('shipping_')) {
        const { data: shipment } = await supabase
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
      const templateData: Record<string, string> = {
        customer_name: customerName || 'Valued Customer',
        customer_email: customerEmail,
        order_number: order.order_number || order.id,
        tracking_number: additionalData?.tracking_number || shipmentData.tracking_number || '',
        carrier: additionalData?.carrier || getCarrierDisplayName(shipmentData.carrier_code || additionalData?.carrier_code || ''),
        tracking_url: additionalData?.tracking_url || generateTrackingUrl(
          additionalData?.tracking_number || shipmentData.tracking_number || '',
          shipmentData.carrier_code || additionalData?.carrier_code || ''
        ),
        estimated_delivery: additionalData?.estimated_delivery || formatDateForEmail(shipmentData.estimated_delivery_date),
        current_location: additionalData?.current_location || shipmentData.tracking_status_description || '',
        delivery_date: additionalData?.delivery_date || formatDateForEmail(shipmentData.actual_delivery_date),
        // Pickup fields
        pickup_location: additionalData?.pickup_location || '',
        pickup_address: additionalData?.pickup_address || '',
        pickup_date: additionalData?.pickup_date || '',
        pickup_time: additionalData?.pickup_time || '',
        pickup_instructions: additionalData?.pickup_instructions || 'Please bring a valid ID and your order confirmation.',
      }

      // Send email via edge function
      const { data, error: invokeError } = await supabase.functions.invoke('resend-send-email', {
        body: {
          to: customerEmail,
          template: templateSlug,
          templateData
        }
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to send email')
      }

      if (data.error) {
        throw new Error(data.error)
      }

      return { success: true, id: data.id }
    } catch (err: any) {
      console.error('Error sending shipping email:', err)
      const errorMsg = err.message || 'Failed to send shipping email'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setSending(false)
    }
  }, [])

  /**
   * Convenience method: Send "label created" email
   */
  const sendLabelCreatedEmail = useCallback(async (
    orderId: string,
    data: {
      tracking_number: string
      carrier_code: string
      estimated_delivery?: string
    }
  ) => {
    return sendShippingEmail('shipping_label_created', orderId, {
      tracking_number: data.tracking_number,
      carrier_code: data.carrier_code,
      carrier: getCarrierDisplayName(data.carrier_code),
      tracking_url: generateTrackingUrl(data.tracking_number, data.carrier_code),
      estimated_delivery: data.estimated_delivery,
    })
  }, [sendShippingEmail])

  /**
   * Convenience method: Send "in transit" email
   */
  const sendInTransitEmail = useCallback(async (
    orderId: string,
    data: {
      tracking_number: string
      carrier_code: string
      current_location?: string
      estimated_delivery?: string
    }
  ) => {
    return sendShippingEmail('shipping_in_transit', orderId, {
      tracking_number: data.tracking_number,
      carrier_code: data.carrier_code,
      carrier: getCarrierDisplayName(data.carrier_code),
      tracking_url: generateTrackingUrl(data.tracking_number, data.carrier_code),
      current_location: data.current_location,
      estimated_delivery: data.estimated_delivery,
    })
  }, [sendShippingEmail])

  /**
   * Convenience method: Send "out for delivery" email
   */
  const sendOutForDeliveryEmail = useCallback(async (
    orderId: string,
    data: {
      tracking_number: string
      carrier_code: string
    }
  ) => {
    return sendShippingEmail('shipping_out_for_delivery', orderId, {
      tracking_number: data.tracking_number,
      carrier_code: data.carrier_code,
      carrier: getCarrierDisplayName(data.carrier_code),
      tracking_url: generateTrackingUrl(data.tracking_number, data.carrier_code),
    })
  }, [sendShippingEmail])

  /**
   * Convenience method: Send "delivered" email
   */
  const sendDeliveredEmail = useCallback(async (
    orderId: string,
    data: {
      tracking_number: string
      carrier_code: string
      delivery_date?: string
    }
  ) => {
    return sendShippingEmail('shipping_delivered', orderId, {
      tracking_number: data.tracking_number,
      carrier_code: data.carrier_code,
      carrier: getCarrierDisplayName(data.carrier_code),
      tracking_url: generateTrackingUrl(data.tracking_number, data.carrier_code),
      delivery_date: data.delivery_date || new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    })
  }, [sendShippingEmail])

  /**
   * Convenience method: Send "pickup ready" email
   */
  const sendPickupReadyEmail = useCallback(async (
    orderId: string,
    data: {
      pickup_location: string
      pickup_address: string
      pickup_date: string
      pickup_time: string
      pickup_instructions?: string
    }
  ) => {
    return sendShippingEmail('pickup_ready', orderId, data)
  }, [sendShippingEmail])

  /**
   * Convenience method: Send "pickup reminder" email
   */
  const sendPickupReminderEmail = useCallback(async (
    orderId: string,
    data: {
      pickup_location: string
      pickup_address: string
      pickup_date: string
      pickup_time: string
      pickup_instructions?: string
    }
  ) => {
    return sendShippingEmail('pickup_reminder', orderId, data)
  }, [sendShippingEmail])

  return {
    sendShippingEmail,
    sendLabelCreatedEmail,
    sendInTransitEmail,
    sendOutForDeliveryEmail,
    sendDeliveredEmail,
    sendPickupReadyEmail,
    sendPickupReminderEmail,
    sending,
    error,
  }
}

// Note: For server-side usage in edge functions, see:
// supabase/functions/_shared/shipping-emails.ts
