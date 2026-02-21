import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Types
export interface ShippingAddress {
  name?: string
  company_name?: string
  phone?: string
  address_line1: string
  address_line2?: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code?: string
}

export interface AddressValidationResult {
  success: boolean
  status: 'verified' | 'unverified' | 'warning' | 'error'
  original_address: ShippingAddress
  matched_address?: ShippingAddress
  is_residential?: boolean
  messages: string[]
}

export interface ShippingRate {
  rate_id: string
  carrier_id: string
  carrier_code: string
  carrier_friendly_name: string
  service_code: string
  service_type: string
  shipping_amount: number
  currency: string
  delivery_days: number | null
  estimated_delivery_date: string | null
  carrier_delivery_days: string | null
  guaranteed_service: boolean
}

export interface ZoneInfo {
  status: 'allowed' | 'blocked' | 'conditional'
  message?: string
  conditions?: {
    required_service?: string
    blocked_months?: number[]
    min_order_value?: number
    max_transit_days?: number
  }
  surcharge_amount?: number
  surcharge_percent?: number
}

export interface PackageBreakdown {
  total_packages: number
  packages: Array<{
    name: string
    dimensions: {
      length: number
      width: number
      height: number
      unit: string
    }
    weight: {
      value: number
      unit: string
    }
    item_count: number
  }>
  summary: string
}

export interface ShippingRatesResult {
  success: boolean
  rates: ShippingRate[]
  ship_from: ShippingAddress
  ship_to: ShippingAddress
  zone_info?: ZoneInfo
  package_breakdown?: PackageBreakdown
}

export interface OrderItem {
  quantity: number
  weight_per_item?: number
}

/**
 * Hook for validating shipping addresses via ShipEngine
 */
export function useAddressValidation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<AddressValidationResult | null>(null)

  const validateAddress = useCallback(async (address: ShippingAddress): Promise<AddressValidationResult | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shipengine-validate-address', {
        body: { address }
      })

      if (fnError) {
        throw new Error(fnError.message || 'Failed to validate address')
      }

      if (!data.success && data.error) {
        throw new Error(data.error.message || 'Address validation failed')
      }

      setValidationResult(data)
      return data
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to validate address'
      setError(errorMessage)
      setValidationResult(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearValidation = useCallback(() => {
    setValidationResult(null)
    setError(null)
  }, [])

  return {
    validateAddress,
    clearValidation,
    validationResult,
    loading,
    error
  }
}

/**
 * Hook for fetching real-time shipping rates via ShipEngine
 */
export function useShippingRates() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [zoneInfo, setZoneInfo] = useState<ZoneInfo | null>(null)
  const [isZoneBlocked, setIsZoneBlocked] = useState(false)
  const [packageBreakdown, setPackageBreakdown] = useState<PackageBreakdown | null>(null)

  const fetchRates = useCallback(async (
    shipTo: ShippingAddress,
    orderItems?: OrderItem[]
  ): Promise<ShippingRate[]> => {
    setLoading(true)
    setError(null)
    setZoneInfo(null)
    setIsZoneBlocked(false)
    setPackageBreakdown(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shipengine-get-rates', {
        body: {
          ship_to: shipTo,
          order_items: orderItems
        }
      })

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch shipping rates')
      }

      // Check for zone blocked error
      if (!data.success && data.error?.code === 'ZONE_BLOCKED') {
        setIsZoneBlocked(true)
        setZoneInfo({
          status: 'blocked',
          message: data.error.message
        })
        setError(data.error.message)
        setRates([])
        return []
      }

      if (!data.success && data.error) {
        // Log full technical details to console for debugging
        console.error('[useShippingRates] Rate fetch failed:', {
          code: data.error.code,
          message: data.error.message,
          details: data.error.details,
        })
        throw new Error(data.error.code || 'RATE_ERROR')
      }

      // Store zone info if present (for conditional states)
      if (data.zone_info) {
        setZoneInfo(data.zone_info)
      }

      // Store package breakdown if present
      if (data.package_breakdown) {
        setPackageBreakdown(data.package_breakdown)
      }

      const fetchedRates = data.rates || []
      setRates(fetchedRates)
      return fetchedRates
    } catch (err: any) {
      console.error('[useShippingRates] Error:', err.message || err)
      // Show a friendly message to the customer regardless of the technical error
      setError('We were unable to calculate shipping rates for your address. Please try again or contact us at support@atlurbanfarms.com for assistance.')
      setRates([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const clearRates = useCallback(() => {
    setRates([])
    setError(null)
    setZoneInfo(null)
    setIsZoneBlocked(false)
    setPackageBreakdown(null)
  }, [])

  return {
    fetchRates,
    clearRates,
    rates,
    loading,
    error,
    zoneInfo,
    isZoneBlocked,
    packageBreakdown
  }
}

/**
 * Format delivery estimate for display
 */
export function formatDeliveryEstimate(rate: ShippingRate): string {
  if (rate.estimated_delivery_date) {
    const date = new Date(rate.estimated_delivery_date)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (rate.delivery_days) {
    if (rate.delivery_days === 1) {
      return 'Tomorrow'
    }
    return `${rate.delivery_days} business days`
  }

  if (rate.carrier_delivery_days) {
    return rate.carrier_delivery_days
  }

  return 'Delivery estimate unavailable'
}

/**
 * Get carrier logo URL (placeholder - can be expanded with actual logos)
 */
export function getCarrierLogo(carrierCode: string): string | null {
  const logos: Record<string, string> = {
    'stamps_com': '/carriers/usps.svg',
    'usps': '/carriers/usps.svg',
    'ups': '/carriers/ups.svg',
    'fedex': '/carriers/fedex.svg',
    'dhl_express': '/carriers/dhl.svg'
  }
  return logos[carrierCode.toLowerCase()] || null
}
