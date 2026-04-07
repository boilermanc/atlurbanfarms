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
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all shipments for order
  const fetchShipment = useCallback(async () => {
    if (!orderId) {
      setShipments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.warn('Shipment fetch warning:', fetchError.code, fetchError.message);
        // Don't overwrite existing (optimistic) shipment data on error
        setLoading(false);
        return;
      }

      setShipments(data || []);
    } catch (err: any) {
      // Silently handle errors - shipment data is optional.
      // Don't overwrite existing (optimistic) shipment data on error.
      console.warn('Error fetching shipment (non-critical):', err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Load shipment on mount and when orderId changes
  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  // Create label for order
  const createLabel = useCallback(async (params: {
    service_code: string;
    rate_id?: string;
    package_weight_lbs: number;
    package_length?: number;
    package_width?: number;
    package_height?: number;
    packages?: Array<{
      weight: { value: number; unit: string };
      dimensions?: { length: number; width: number; height: number; unit: string };
    }>;
  }): Promise<CreateLabelResult> => {
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
        body: {
          order_id: orderId,
          service_code: params.service_code,
          rate_id: params.rate_id,
          package_weight_lbs: params.package_weight_lbs,
          package_length: params.package_length,
          package_width: params.package_width,
          package_height: params.package_height,
          packages: params.packages,
        }
      });

      if (fnError) {
        // supabase.functions.invoke treats non-2xx as FunctionsHttpError.
        // The real error payload is in fnError.context (a Response object).
        let parsed: any = null;
        try {
          if (fnError.context && typeof fnError.context.json === 'function') {
            parsed = await fnError.context.json();
          }
        } catch { /* ignore parse failure */ }

        if (parsed && parsed.error) {
          setError(parsed.error.message || 'Failed to create label');
          return { success: false, error: parsed.error };
        }
        throw new Error(fnError.message || 'Failed to create label');
      }

      if (!data.success) {
        setError(data.error?.message || 'Failed to create label');
        return data;
      }

      // Optimistically add the new shipment so the UI updates immediately,
      // even if the subsequent DB fetch fails (e.g. RLS, timing).
      const optimisticShipment: Shipment = {
        id: '',
        order_id: orderId!,
        label_id: data.label_id || null,
        tracking_number: data.tracking_number || null,
        carrier_id: null,
        carrier_code: data.carrier_code || null,
        service_code: data.service_code || params.service_code || null,
        label_url: data.label_url || null,
        label_format: 'pdf',
        shipment_cost: data.shipment_cost ?? null,
        status: 'label_created',
        tracking_status: null,
        tracking_status_description: null,
        estimated_delivery_date: null,
        actual_delivery_date: null,
        last_tracking_update: null,
        voided: false,
        voided_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setShipments(prev => [optimisticShipment, ...prev]);

      // Also fetch the full record from the DB (will overwrite optimistic
      // data with the real row including the server-generated id).
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
        body: { label_id: labelId, order_id: orderId }
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
  }, [orderId, fetchShipment]);

  // Active (non-voided) shipments
  const activeShipments = shipments.filter(s => !s.voided);

  // Backward-compat: latest shipment (used for conditional checks elsewhere)
  const shipment = activeShipments[0] || shipments[0] || null;

  // Can create a new label when no active shipments exist
  const canCreateLabel = activeShipments.length === 0;

  // Per-shipment void check is now in the UI; keep this for simple checks
  const canVoidLabel = shipment && shipment.label_id && !shipment.voided;

  return {
    shipment,
    shipments,
    activeShipments,
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
