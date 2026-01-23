import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface CarrierConfiguration {
  id: string;
  carrier_code: string;
  carrier_name: string;
  is_enabled: boolean;
  is_sandbox: boolean;
  credentials: {
    client_id?: string;
    client_secret?: string;
    account_number?: string;
    api_key?: string;
  };
  rate_markup_percent: number;
  allowed_service_codes: string[];
  last_successful_call: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseAddress {
  name: string;
  company_name?: string;
  address_line1: string;
  address_line2?: string;
  city_locality: string;
  state_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

// UPS Service codes with names
export const UPS_SERVICES = [
  { code: '03', name: 'UPS Ground', description: 'Economical ground shipping' },
  { code: '12', name: 'UPS 3 Day Select', description: 'Delivery within 3 business days' },
  { code: '02', name: 'UPS 2nd Day Air', description: 'Delivery within 2 business days' },
  { code: '01', name: 'UPS Next Day Air', description: 'Next business day delivery' },
  { code: '13', name: 'UPS Next Day Air Saver', description: 'Next day by end of day' },
  { code: '59', name: 'UPS 2nd Day Air A.M.', description: '2nd day morning delivery' },
];

// Default carrier templates
const DEFAULT_CARRIERS: Partial<CarrierConfiguration>[] = [
  {
    carrier_code: 'ups',
    carrier_name: 'UPS',
    is_enabled: false,
    is_sandbox: true,
    credentials: {},
    rate_markup_percent: 0,
    allowed_service_codes: ['03', '12', '02', '01'],
  },
  {
    carrier_code: 'fedex',
    carrier_name: 'FedEx',
    is_enabled: false,
    is_sandbox: true,
    credentials: {},
    rate_markup_percent: 0,
    allowed_service_codes: [],
  },
  {
    carrier_code: 'usps',
    carrier_name: 'USPS',
    is_enabled: false,
    is_sandbox: true,
    credentials: {},
    rate_markup_percent: 0,
    allowed_service_codes: [],
  },
];

export function useCarrierConfigurations() {
  const [carriers, setCarriers] = useState<CarrierConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCarriers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('carrier_configurations')
        .select('*')
        .order('carrier_name');

      if (fetchError) throw fetchError;

      // If no carriers exist, create defaults
      if (!data || data.length === 0) {
        const defaultCarriersWithIds = DEFAULT_CARRIERS.map((carrier) => ({
          ...carrier,
          id: crypto.randomUUID(),
          last_successful_call: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as CarrierConfiguration[];

        setCarriers(defaultCarriersWithIds);
      } else {
        setCarriers(data);
      }
    } catch (err: any) {
      console.error('Error fetching carriers:', err);
      setError(err.message || 'Failed to load carrier configurations');
      // Set defaults on error
      setCarriers(DEFAULT_CARRIERS.map((carrier) => ({
        ...carrier,
        id: crypto.randomUUID(),
        last_successful_call: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as CarrierConfiguration[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  const updateCarrier = useCallback(async (
    carrierId: string,
    updates: Partial<CarrierConfiguration>
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('carrier_configurations')
        .upsert({
          id: carrierId,
          ...updates,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      // Update local state
      setCarriers((prev) =>
        prev.map((c) =>
          c.id === carrierId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        )
      );

      return true;
    } catch (err: any) {
      console.error('Error updating carrier:', err);
      setError(err.message || 'Failed to update carrier');
      return false;
    }
  }, []);

  const toggleCarrierEnabled = useCallback(async (
    carrierId: string,
    isEnabled: boolean
  ): Promise<boolean> => {
    return updateCarrier(carrierId, { is_enabled: isEnabled });
  }, [updateCarrier]);

  return {
    carriers,
    loading,
    error,
    refetch: fetchCarriers,
    updateCarrier,
    toggleCarrierEnabled,
  };
}

export function useMultiCarrierSetting() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSetting = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('config_settings')
        .select('value')
        .eq('category', 'shipping')
        .eq('key', 'multi_carrier_enabled')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setEnabled(data?.value === true || data?.value === 'true');
    } catch (err) {
      console.error('Error fetching multi-carrier setting:', err);
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  const toggleSetting = useCallback(async (newValue: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('config_settings')
        .upsert({
          category: 'shipping',
          key: 'multi_carrier_enabled',
          value: newValue,
          data_type: 'boolean',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'category,key',
        });

      if (error) throw error;

      setEnabled(newValue);
      return true;
    } catch (err) {
      console.error('Error updating multi-carrier setting:', err);
      return false;
    }
  }, []);

  return { enabled, loading, toggleSetting, refetch: fetchSetting };
}

export function useWarehouseAddress() {
  const [address, setAddress] = useState<WarehouseAddress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAddress() {
      try {
        const { data, error } = await supabase
          .from('config_settings')
          .select('value')
          .eq('category', 'shipping')
          .eq('key', 'warehouse_address')
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data?.value) {
          setAddress(typeof data.value === 'string' ? JSON.parse(data.value) : data.value);
        }
      } catch (err) {
        console.error('Error fetching warehouse address:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAddress();
  }, []);

  return { address, loading };
}

export function useCarrierTesting() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const testConnection = useCallback(async (
    carrierCode: string,
    credentials: CarrierConfiguration['credentials'],
    isSandbox: boolean
  ): Promise<{ success: boolean; message: string; details?: any }> => {
    setTesting(true);
    setTestResult(null);

    try {
      if (carrierCode === 'ups') {
        const { data, error } = await supabase.functions.invoke('ups-test-connection', {
          body: {
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            account_number: credentials.account_number,
            is_sandbox: isSandbox,
          },
        });

        if (error) throw error;

        const result = {
          success: data.success,
          message: data.success ? 'Connection successful!' : data.error || 'Connection failed',
          details: data.details,
        };

        setTestResult(result);
        return result;
      }

      // Other carriers not yet implemented
      const result = {
        success: false,
        message: `${carrierCode.toUpperCase()} integration not yet implemented`,
      };
      setTestResult(result);
      return result;
    } catch (err: any) {
      const result = {
        success: false,
        message: err.message || 'Connection test failed',
      };
      setTestResult(result);
      return result;
    } finally {
      setTesting(false);
    }
  }, []);

  const testRates = useCallback(async (
    carrierCode: string,
    credentials: CarrierConfiguration['credentials'],
    isSandbox: boolean,
    warehouseAddress: WarehouseAddress,
    allowedServiceCodes: string[]
  ): Promise<{ success: boolean; message: string; rates?: any[] }> => {
    setTesting(true);
    setTestResult(null);

    try {
      if (carrierCode === 'ups') {
        // Sample destination address for testing
        const testDestination = {
          name: 'Test Customer',
          address_line1: '1600 Amphitheatre Parkway',
          city_locality: 'Mountain View',
          state_province: 'CA',
          postal_code: '94043',
          country_code: 'US',
        };

        const { data, error } = await supabase.functions.invoke('ups-get-rates', {
          body: {
            ship_from: warehouseAddress,
            ship_to: testDestination,
            packages: [{
              weight: { value: 2, unit: 'pound' },
              dimensions: { length: 10, width: 8, height: 4, unit: 'inch' },
            }],
            credentials: {
              client_id: credentials.client_id,
              client_secret: credentials.client_secret,
              account_number: credentials.account_number,
            },
            is_sandbox: isSandbox,
            allowed_service_codes: allowedServiceCodes.length > 0 ? allowedServiceCodes : undefined,
          },
        });

        if (error) throw error;

        const result = {
          success: data.success,
          message: data.success
            ? `Retrieved ${data.rates?.length || 0} shipping rates`
            : data.error || 'Failed to get rates',
          rates: data.rates,
        };

        setTestResult(result);
        return result;
      }

      const result = {
        success: false,
        message: `${carrierCode.toUpperCase()} rates not yet implemented`,
      };
      setTestResult(result);
      return result;
    } catch (err: any) {
      const result = {
        success: false,
        message: err.message || 'Rate test failed',
      };
      setTestResult(result);
      return result;
    } finally {
      setTesting(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setTestResult(null);
  }, []);

  return { testing, testResult, testConnection, testRates, clearResult };
}
