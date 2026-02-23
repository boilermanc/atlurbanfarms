import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface TestResult {
  success: boolean
  message: string
  details?: Record<string, any>
}

/**
 * Hook for testing integration connections
 */
export function useTestIntegration() {
  const [testing, setTesting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const testConnection = useCallback(async (integration: string): Promise<TestResult> => {
    console.log('🟢 useTestIntegration.testConnection called with:', integration)
    setTesting(integration)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('test-integration', {
        body: { integration }
      })

      console.log('🟢 testConnection - Response:', data, 'Error:', invokeError)

      if (invokeError) {
        // FunctionsHttpError buries the real message in error.context (a Response object)
        let errorMsg = invokeError.message || 'Test failed'
        let details: Record<string, any> = { error: invokeError }
        try {
          if (invokeError.context && typeof invokeError.context.json === 'function') {
            const body = await invokeError.context.json()
            if (body?.message) errorMsg = body.message
            if (body?.details) details = body.details
            if (body?.success === false) {
              setError(errorMsg)
              return { success: false, message: errorMsg, details }
            }
          }
        } catch {
          // context parsing failed, use original message
        }
        setError(errorMsg)
        return { success: false, message: errorMsg, details }
      }

      if (!data.success) {
        setError(data.message)
      }

      return data
    } catch (err: any) {
      console.error('🔴 testConnection - Exception:', err)
      const errorMessage = err.message || 'Test failed'
      setError(errorMessage)
      return { success: false, message: errorMessage, details: { exception: err.name || 'Error' } }
    } finally {
      setTesting(null)
    }
  }, [])

  return { testConnection, testing, error }
}

/**
 * Hook for sending emails via SMTP
 */
export function useEmailService() {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendEmail = useCallback(async (params: {
    to: string | string[]
    from?: string
    subject?: string
    html?: string
    text?: string
    template?: 'order_confirmation' | 'shipping_update' | 'welcome' | 'password_reset'
    templateData?: Record<string, any>
  }): Promise<{ success: boolean; id?: string; error?: string; details?: string }> => {
    setSending(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-email', {
        body: params
      })

      console.log('🟢 sendEmail - Response:', data, 'Error:', invokeError)

      if (invokeError) {
        let errorMsg = invokeError.message || 'Failed to send email'
        let details = invokeError.context?.message

        // Handle authentication errors specifically
        if (errorMsg.toLowerCase().includes('jwt') || errorMsg.toLowerCase().includes('unauthorized')) {
          errorMsg = 'Session expired or invalid'
          details = 'Please refresh the page and try again'
        }

        setError(errorMsg)
        return { success: false, error: errorMsg, details }
      }

      if (data.error) {
        const errorMsg = data.error || data.message
        const details = data.statusCode ? `Status: ${data.statusCode}` : undefined
        setError(errorMsg)
        return { success: false, error: errorMsg, details }
      }

      return { success: true, id: data.id }
    } catch (err: any) {
      console.error('🔴 sendEmail - Exception:', err)
      const errorMessage = err.message || 'Failed to send email'
      const details = err.stack ? err.stack.split('\n')[0] : 'Network or parsing error'
      setError(errorMessage)
      return { success: false, error: errorMessage, details }
    } finally {
      setSending(false)
    }
  }, [])

  const sendOrderConfirmation = useCallback(async (
    to: string,
    orderData: {
      orderNumber: string
      customerName: string
      items: Array<{ name: string; quantity: number; price: number }>
      subtotal: number
      shipping: number
      tax: number
      total: number
      shippingAddress?: {
        name: string
        address: string
        city: string
        state: string
        zip: string
      } | null
      pickupInfo?: {
        locationName: string
        address?: string
        date: string
        timeRange?: string
        time?: string
        instructions?: string
      }
      shippingMethodName?: string
      estimatedDeliveryDate?: string | null
    }
  ) => {
    return sendEmail({
      to,
      template: 'order_confirmation',
      templateData: {
        ...orderData,
        siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
      }
    })
  }, [sendEmail])

  const sendShippingUpdate = useCallback(async (
    to: string,
    data: {
      orderNumber: string
      customerName: string
      trackingNumber: string
      trackingUrl: string
    }
  ) => {
    return sendEmail({
      to,
      template: 'shipping_update',
      templateData: data
    })
  }, [sendEmail])

  return { sendEmail, sendOrderConfirmation, sendShippingUpdate, sending, error }
}

/**
 * Hook for Sage AI chat
 */
export function useSageChat() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  const sendMessage = useCallback(async (
    history: Array<{ role: 'user' | 'model'; text: string }>,
    userInput: string
  ): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('sage-chat', {
        body: { history, userInput }
      })

      if (invokeError) {
        setError(invokeError.message)
        throw new Error(invokeError.message)
      }

      if (data.disabled) {
        setDisabled(true)
      }

      if (data.error && !data.response) {
        setError(data.error)
        throw new Error(data.error)
      }

      return data.response
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get response'
      setError(errorMessage)
      return "Oops, Sage ran into an issue! Please try again, or email us at support@atlurbanfarms.com for help. 🌿"
    } finally {
      setLoading(false)
    }
  }, [])

  return { sendMessage, loading, error, disabled }
}
