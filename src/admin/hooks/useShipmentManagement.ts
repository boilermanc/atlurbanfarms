import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface Shipment {
  id: string;
  order_id: string;
  label_id: string | null;
  tracking_number: string | null;
  carrier_id: string | null;
  carrier_code: string | null;
  service_code: string | null;
  label_url: string | null;
  label_format: string | null;
  shipment_cost: number | null;
  status: string;
  tracking_status: string | null;
  tracking_status_description: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  last_tracking_update: string | null;
  voided: boolean;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLabelResult {
  success: boolean;
  label?: {
    label_id: string;
    tracking_number: string;
    label_url: string;
    label_png_url?: string;
    shipment_cost?: number;
    carrier_id: string;
    carrier_code: string;
    service_code: string;
  };
  shipment?: Shipment;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface VoidLabelResult {
  success: boolean;
  approved?: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Hook for managing shipments and labels in the admin panel
 */
export function useShipmentManagement(orderId: string | null) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch shipment for order
  const fetchShipment = useCallback(async () => {
    if (!orderId) {
      setShipment(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // PGRST116 = no rows found, which is expected for orders without shipments
      // Also handle 406 (Not Acceptable) and other common errors gracefully
      if (fetchError) {
        const ignorableCodes = ['PGRST116', '406', 'PGRST301'];
        const isIgnorable = ignorableCodes.includes(fetchError.code) ||
          fetchError.message?.includes('No rows') ||
          fetchError.message?.includes('not found');

        if (!isIgnorable) {
          console.warn('Shipment fetch warning:', fetchError.code, fetchError.message);
        }
        // Don't throw - just treat as no shipment
        setShipment(null);
        setLoading(false);
        return;
      }

      setShipment(data || null);
    } catch (err: any) {
      // Silently handle errors - shipment data is optional
      console.warn('Error fetching shipment (non-critical):', err.message);
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Load shipment on mount and when orderId changes
  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  // Create label for order
  const createLabel = useCallback(async (): Promise<CreateLabelResult> => {
    if (!orderId) {
      return {
        success: false,
        error: {
          code: 'NO_ORDER',
          message: 'No order ID provided'
        }
      };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shipengine-create-label', {
        body: { order_id: orderId }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to create label');
      }

      if (!data.success) {
        setError(data.error?.message || 'Failed to create label');
        return data;
      }

      // Refresh shipment data
      await fetchShipment();

      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create label';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: errorMessage
        }
      };
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchShipment]);

  // Void label
  const voidLabel = useCallback(async (labelId: string): Promise<VoidLabelResult> => {
    if (!labelId) {
      return {
        success: false,
        error: {
          code: 'NO_LABEL',
          message: 'No label ID provided'
        }
      };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shipengine-void-label', {
        body: { label_id: labelId }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to void label');
      }

      if (!data.success) {
        setError(data.error?.message || 'Failed to void label');
        return data;
      }

      // Refresh shipment data
      await fetchShipment();

      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to void label';
      setError(errorMessage);
      return {
        success: false,
        error: {
          code: 'VOID_FAILED',
          message: errorMessage
        }
      };
    } finally {
      setLoading(false);
    }
  }, [fetchShipment]);

  // Check if we can create a label
  const canCreateLabel = !shipment || shipment.voided;

  // Check if we can void a label
  const canVoidLabel = shipment && shipment.label_id && !shipment.voided;

  return {
    shipment,
    loading,
    error,
    createLabel,
    voidLabel,
    refetch: fetchShipment,
    canCreateLabel,
    canVoidLabel
  };
}

/**
 * Hook for fetching all shipments (for orders list)
 */
export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setShipments(data || []);
    } catch (err: any) {
      console.error('Error fetching shipments:', err);
      setError(err.message || 'Failed to fetch shipments');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return {
    shipments,
    loading,
    error,
    refetch: fetchShipments
  };
}

export default useShipmentManagement;
