import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  CreditLogEntry,
  CreditLogFilters,
  CreditStats,
  SproutifyCreditStatus,
} from '../types/sproutifyCredits'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Fetch paginated credit log entries
 */
export function useCreditLog(filters: CreditLogFilters = {}) {
  const [entries, setEntries] = useState<CreditLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const perPage = filters.perPage || 20
  const page = filters.page || 1
  const offset = (page - 1) * perPage

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('seedling_credit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action)
      }

      if (filters.search) {
        query = query.ilike('customer_email', `%${filters.search}%`)
      }

      query = query.range(offset, offset + perPage - 1)

      const { data, error: queryError, count } = await query

      if (queryError) throw queryError

      setEntries(data || [])
      setTotalCount(count || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch credit log')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [filters.action, filters.search, offset, perPage])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return {
    entries,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchEntries,
  }
}

/**
 * Fetch summary stats for credits
 */
export function useCreditStats() {
  const [stats, setStats] = useState<CreditStats>({
    totalRedeemed: 0,
    totalSavings: 0,
    uniqueCustomers: 0,
    totalGranted: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        // Count orders with Sproutify discounts
        const { data: orderStats, error: orderError } = await supabase
          .from('orders')
          .select('discount_amount, guest_email, customer_id')
          .ilike('discount_description', '%Sproutify%')
          .gt('discount_amount', 0)

        if (orderError) throw orderError

        const totalRedeemed = orderStats?.length || 0
        const totalSavings = orderStats?.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0) || 0
        const uniqueEmails = new Set(orderStats?.map(o => o.guest_email).filter(Boolean))
        const uniqueCustomerIds = new Set(orderStats?.map(o => o.customer_id).filter(Boolean))
        const uniqueCustomers = Math.max(uniqueEmails.size, uniqueCustomerIds.size)

        // Count grants
        const { count: grantCount } = await supabase
          .from('seedling_credit_log')
          .select('id', { count: 'exact', head: true })
          .eq('action', 'grant')
          .eq('status', 'success')

        setStats({
          totalRedeemed,
          totalSavings,
          uniqueCustomers,
          totalGranted: grantCount || 0,
        })
      } catch (err) {
        console.error('Failed to fetch credit stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading }
}

/**
 * Check a customer's available Sproutify credit (admin action)
 */
export function useCheckCredit() {
  const [result, setResult] = useState<SproutifyCreditStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkCredit = useCallback(async (email: string) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`${SUPABASE_URL}/functions/v1/sproutify-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ action: 'check', email })
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Failed to check credit')
      }

      const creditData: SproutifyCreditStatus = {
        hasCredit: !!json.data?.hasCredit,
        creditAmount: json.data?.creditAmount || 0,
        creditId: json.data?.creditId || null,
        isLifetime: !!json.data?.isLifetime,
      }

      setResult(creditData)
      return creditData
    } catch (err: any) {
      setError(err.message || 'Failed to check credit')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { checkCredit, result, loading, error }
}

/**
 * Grant a Sproutify credit to a customer (admin action)
 */
export function useGrantCredit() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grantCredit = useCallback(async (
    email: string,
    amount: number,
    notes?: string
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`${SUPABASE_URL}/functions/v1/sproutify-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ action: 'grant', email, amount, notes })
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Failed to grant credit')
      }

      return true
    } catch (err: any) {
      setError(err.message || 'Failed to grant credit')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { grantCredit, loading, error }
}
