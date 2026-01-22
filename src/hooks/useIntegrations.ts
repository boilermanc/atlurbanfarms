import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🟢 Session:', session ? 'exists' : 'null')

      if (!session) {
        const errorMsg = 'Not authenticated - please log in again'
        setError(errorMsg)
        return { success: false, message: errorMsg, details: { reason: 'No active session' } }
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/test-integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ integration })
      })

      console.log('🟢 testConnection - Response status:', response.status, response.statusText)
      const result = await response.json()
      console.log('🟢 testConnection - Response body:', result)

      if (!response.ok) {
        const errorMsg = result.message || result.error || `HTTP ${response.status}: ${response.statusText}`
        setError(errorMsg)
        return { success: false, message: errorMsg, details: { status: response.status, ...result } }
      }

      if (!result.success) {
        setError(result.message)
      }

      return result
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
 * Hook for sending emails via Resend
 */
export function useEmailService() {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendEmail = useCallback(async (params: {
    to: string | string[]
    subject?: string
    html?: string
    text?: string
    template?: 'order_confirmation' | 'shipping_update' | 'welcome' | 'password_reset'
    templateData?: Record<string, any>
  }): Promise<{ success: boolean; id?: string; error?: string; details?: string }> => {
    setSending(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🟢 sendEmail - Session:', session ? 'exists' : 'null')

      if (!session) {
        const errorMsg = 'Not authenticated - please log in again'
        setError(errorMsg)
        return { success: false, error: errorMsg, details: 'No active session found' }
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/resend-send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(params)
      })

      console.log('🟢 sendEmail - Response status:', response.status, response.statusText)
      const result = await response.json()
      console.log('🟢 sendEmail - Response body:', result)

      if (!response.ok || result.error) {
        const errorMsg = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`
        const details = result.statusCode ? `Status: ${result.statusCode}` : undefined
        setError(errorMsg)
        return { success: false, error: errorMsg, details }
      }

      return { success: true, id: result.id }
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
      shippingAddress: {
        name: string
        address: string
        city: string
        state: string
        zip: string
      }
    }
  ) => {
    return sendEmail({
      to,
      template: 'order_confirmation',
      templateData: orderData
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

  const sendMessage = useCallback(async (
    history: Array<{ role: 'user' | 'model'; text: string }>,
    userInput: string
  ): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ history, userInput })
      })

      const result = await response.json()

      if (result.error && !result.response) {
        setError(result.error)
        throw new Error(result.error)
      }

      return result.response
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get response'
      setError(errorMessage)
      return "Sage is currently resting in the nursery. Please try again in a moment! ✨"
    } finally {
      setLoading(false)
    }
  }, [])

  return { sendMessage, loading, error }
}
