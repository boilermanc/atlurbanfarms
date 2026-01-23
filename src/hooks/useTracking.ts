import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TrackingEvent {
  occurred_at: string;
  status_code: string;
  description: string;
  city_locality: string | null;
  state_province: string | null;
  country_code: string | null;
}

export interface TrackingInfo {
  tracking_number: string;
  carrier_code: string;
  status_code: string;
  status_description: string;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  ship_date: string | null;
  events: TrackingEvent[];
}

/**
 * Map ShipEngine status codes to user-friendly descriptions
 */
export const STATUS_LABELS: Record<string, string> = {
  'UN': 'Unknown',
  'AC': 'Accepted',
  'IT': 'In Transit',
  'DE': 'Delivered',
  'EX': 'Exception',
  'AT': 'Delivery Attempt',
  'NY': 'Not Yet In System',
  'CA': 'Cancelled',
  'SP': 'Pre-Shipment'
};

/**
 * Get status color classes based on status code
 */
export function getStatusColor(statusCode: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (statusCode) {
    case 'DE':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500'
      };
    case 'IT':
    case 'OT':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500'
      };
    case 'EX':
    case 'AT':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      };
    case 'CA':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        dot: 'bg-gray-400'
      };
  }
}

/**
 * Format date for display
 */
export function formatTrackingDate(dateString: string, includeTime = true): string {
  const date = new Date(dateString);
  if (includeTime) {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get carrier display name
 */
export function getCarrierName(carrierCode: string): string {
  const carriers: Record<string, string> = {
    'stamps_com': 'USPS',
    'usps': 'USPS',
    'ups': 'UPS',
    'fedex': 'FedEx',
    'dhl_express': 'DHL Express',
    'dhl_ecommerce': 'DHL eCommerce'
  };
  return carriers[carrierCode.toLowerCase()] || carrierCode.replace(/_/g, ' ').toUpperCase();
}

/**
 * Hook for fetching tracking information
 */
export function useTracking(initialTrackingNumber?: string, initialCarrierCode?: string) {
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async (
    trackingNumber: string,
    carrierCode: string
  ): Promise<TrackingInfo | null> => {
    if (!trackingNumber || !carrierCode) {
      setError('Tracking number and carrier code are required');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shipengine-track-shipment', {
        body: {
          tracking_number: trackingNumber,
          carrier_code: carrierCode
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch tracking info');
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get tracking info');
      }

      setTrackingInfo(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch tracking info';
      setError(errorMessage);
      setTrackingInfo(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTracking = useCallback(async () => {
    if (trackingInfo) {
      await fetchTracking(trackingInfo.tracking_number, trackingInfo.carrier_code);
    }
  }, [trackingInfo, fetchTracking]);

  // Auto-fetch on mount if initial values provided
  useEffect(() => {
    if (initialTrackingNumber && initialCarrierCode) {
      fetchTracking(initialTrackingNumber, initialCarrierCode);
    }
  }, [initialTrackingNumber, initialCarrierCode, fetchTracking]);

  return {
    trackingInfo,
    loading,
    error,
    fetchTracking,
    refreshTracking
  };
}

/**
 * Hook for fetching tracking events from local database (for shipments we've created)
 */
export function useTrackingEvents(shipmentId: string | null) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!shipmentId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('occurred_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setEvents(data || []);
    } catch (err: any) {
      console.error('Error fetching tracking events:', err);
      setError(err.message || 'Failed to fetch tracking events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents
  };
}

export default useTracking;
