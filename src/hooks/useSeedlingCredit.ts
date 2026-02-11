import { useState, useEffect, useCallback, useRef } from 'react'

const SPROUTIFY_FUNCTION_URL = import.meta.env.VITE_SPROUTIFY_FUNCTION_URL
const SPROUTIFY_ANON_KEY = import.meta.env.VITE_SPROUTIFY_ANON_KEY
const SPROUTIFY_API_KEY = import.meta.env.VITE_SPROUTIFY_API_KEY

interface SeedlingCreditResult {
  hasCredit: boolean
  creditAmount: number
  creditId: string | null
  isLifetime: boolean
  loading: boolean
  error: string | null
  redeemCredit: (orderId: string) => Promise<boolean>
}

export function useSeedlingCredit(userEmail: string | null): SeedlingCreditResult {
  const [hasCredit, setHasCredit] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [creditId, setCreditId] = useState<string | null>(null)
  const [isLifetime, setIsLifetime] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the last email we checked to avoid duplicate requests
  const lastCheckedEmail = useRef<string | null>(null)

  useEffect(() => {
    if (!userEmail || !SPROUTIFY_FUNCTION_URL || !SPROUTIFY_ANON_KEY || !SPROUTIFY_API_KEY) {
      setHasCredit(false)
      setCreditAmount(0)
      setCreditId(null)
      setIsLifetime(false)
      return
    }

    // Don't re-check the same email
    if (userEmail === lastCheckedEmail.current) return
    lastCheckedEmail.current = userEmail

    let cancelled = false

    const checkCredit = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(SPROUTIFY_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SPROUTIFY_ANON_KEY}`,
            'x-api-key': SPROUTIFY_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'check', email: userEmail })
        })

        if (!response.ok) {
          throw new Error(`Credit check failed (${response.status})`)
        }

        const data = await response.json()

        if (!cancelled) {
          setHasCredit(!!data.hasCredit)
          setCreditAmount(data.creditAmount || 0)
          setCreditId(data.creditId || null)
          setIsLifetime(!!data.isLifetime)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to check seedling credit')
          setHasCredit(false)
          setCreditAmount(0)
          setCreditId(null)
          setIsLifetime(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    checkCredit()

    return () => {
      cancelled = true
    }
  }, [userEmail])

  const redeemCredit = useCallback(async (orderId: string): Promise<boolean> => {
    if (!userEmail || !SPROUTIFY_FUNCTION_URL || !SPROUTIFY_ANON_KEY || !SPROUTIFY_API_KEY) {
      return false
    }

    try {
      const response = await fetch(SPROUTIFY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SPROUTIFY_ANON_KEY}`,
          'x-api-key': SPROUTIFY_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'redeem', email: userEmail, order_id: orderId })
      })

      if (!response.ok) {
        throw new Error(`Credit redemption failed (${response.status})`)
      }

      // Mark credit as used locally
      setHasCredit(false)
      setCreditAmount(0)
      setCreditId(null)

      return true
    } catch (err: any) {
      console.error('Failed to redeem seedling credit:', err)
      return false
    }
  }, [userEmail])

  return { hasCredit, creditAmount, creditId, isLifetime, loading, error, redeemCredit }
}
