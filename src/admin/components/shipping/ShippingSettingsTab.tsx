import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Loader2, MapPin } from 'lucide-react';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../../hooks/useSettings';
import { supabase } from '../../../lib/supabase';

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

// Defaults for each section
const ADDRESS_DEFAULTS: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {
  ship_from_name: { value: '', dataType: 'string' },
  ship_from_address_line1: { value: '', dataType: 'string' },
  ship_from_address_line2: { value: '', dataType: 'string' },
  ship_from_city: { value: '', dataType: 'string' },
  ship_from_state: { value: '', dataType: 'string' },
  ship_from_zip: { value: '', dataType: 'string' },
  ship_from_country: { value: 'US', dataType: 'string' },
  ship_from_phone: { value: '', dataType: 'string' },
};

const PACKAGE_DEFAULTS: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {
  default_package_length: { value: 12, dataType: 'number' },
  default_package_width: { value: 9, dataType: 'number' },
  default_package_height: { value: 6, dataType: 'number' },
  default_package_weight: { value: 1, dataType: 'number' },
};

const RULES_DEFAULTS: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {
  free_shipping_enabled: { value: false, dataType: 'boolean' },
  free_shipping_threshold: { value: 50, dataType: 'number' },
  shipping_rate_markup_type: { value: 'percentage', dataType: 'string' },
  shipping_rate_markup_percent: { value: 0, dataType: 'number' },
  shipping_rate_markup_dollars: { value: 0, dataType: 'number' },
};

const SERVICE_DEFAULTS: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {
  forced_service_default: { value: 'ups_ground', dataType: 'string' },
  forced_service_overrides: { value: { service_code: 'ups_3_day_select', states: [] }, dataType: 'json' },
};

const UPS_SERVICES = [
  { value: 'ups_ground', label: 'UPS Ground' },
  { value: 'ups_3_day_select', label: 'UPS 3 Day Select' },
  { value: 'ups_2nd_day_air', label: 'UPS 2nd Day Air' },
  { value: 'ups_next_day_air_saver', label: 'UPS Next Day Air Saver' },
  { value: 'ups_next_day_air', label: 'UPS Next Day Air' },
];

type SectionKey = 'address' | 'package' | 'rules' | 'service';
type SaveStatus = { message: string; type: 'success' | 'error' } | null;
type ValidationStatus = { status: 'verified' | 'warning' | 'unverified' | 'error'; messages: string[] } | null;

const inputClass = 'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all';

// Save button for each section
const SectionSaveButton: React.FC<{
  saving: boolean;
  status: SaveStatus;
  onClick: () => void;
}> = ({ saving, status, onClick }) => (
  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
    <AnimatePresence>
      {status && (
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className={`text-sm font-medium ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {status.message}
        </motion.span>
      )}
    </AnimatePresence>
    <button
      onClick={onClick}
      disabled={saving}
      className="px-5 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {saving ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Saving...
        </>
      ) : (
        'Save'
      )}
    </button>
  </div>
);

const ShippingSettingsTab: React.FC = () => {
  const { settings, loading, refetch } = useSettings();
  const { bulkUpdate } = useBulkUpdateSettings();

  // Form state - split by category for independent saving
  const [addressData, setAddressData] = useState<Record<string, any>>({});
  const [packageData, setPackageData] = useState<Record<string, any>>({});
  const [rulesData, setRulesData] = useState<Record<string, any>>({});

  // Per-section save status
  const [serviceData, setServiceData] = useState<Record<string, any>>({});
  const [savingSections, setSavingSections] = useState<Set<SectionKey>>(new Set());
  const [saveStatuses, setSaveStatuses] = useState<Record<SectionKey, SaveStatus>>({
    address: null,
    package: null,
    rules: null,
    service: null,
  });

  const startSaving = (section: SectionKey) => {
    setSavingSections(prev => new Set(prev).add(section));
  };
  const stopSaving = (section: SectionKey) => {
    setSavingSections(prev => {
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  };

  // Address validation
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationStatus>(null);

  // Per-section timeout refs for save status auto-clear
  const saveStatusTimeouts = useRef<Record<SectionKey, ReturnType<typeof setTimeout> | null>>({
    address: null,
    package: null,
    rules: null,
    service: null,
  });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveStatusTimeouts.current).forEach(t => { if (t) clearTimeout(t); });
    };
  }, []);

  // Clear validation result when address fields change
  useEffect(() => {
    setValidationResult(null);
  }, [
    addressData.ship_from_name,
    addressData.ship_from_address_line1,
    addressData.ship_from_address_line2,
    addressData.ship_from_city,
    addressData.ship_from_state,
    addressData.ship_from_zip,
    addressData.ship_from_phone,
  ]);

  // Initialize form data from settings
  useEffect(() => {
    const addr: Record<string, any> = {};
    Object.entries(ADDRESS_DEFAULTS).forEach(([key, config]) => {
      addr[key] = settings.business?.[key] ?? config.value;
    });
    setAddressData(addr);

    const pkg: Record<string, any> = {};
    Object.entries(PACKAGE_DEFAULTS).forEach(([key, config]) => {
      pkg[key] = settings.shipping?.[key] ?? config.value;
    });
    setPackageData(pkg);

    const rules: Record<string, any> = {};
    Object.entries(RULES_DEFAULTS).forEach(([key, config]) => {
      rules[key] = settings.shipping?.[key] ?? config.value;
    });
    setRulesData(rules);

    const svc: Record<string, any> = {};
    Object.entries(SERVICE_DEFAULTS).forEach(([key, config]) => {
      svc[key] = settings.shipping?.[key] ?? config.value;
    });
    setServiceData(svc);
  }, [settings]);

  const clearSaveStatus = useCallback((section: SectionKey) => {
    if (saveStatusTimeouts.current[section]) clearTimeout(saveStatusTimeouts.current[section]!);
    saveStatusTimeouts.current[section] = setTimeout(() => {
      setSaveStatuses(prev => ({ ...prev, [section]: null }));
    }, 3000);
  }, []);

  // Save warehouse address
  const handleSaveAddress = useCallback(async () => {
    startSaving('address');
    setSaveStatuses(prev => ({ ...prev, address: null }));

    try {
      // Save individual fields to business category
      const businessSettings: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};
      Object.entries(ADDRESS_DEFAULTS).forEach(([key, config]) => {
        businessSettings[key] = { value: addressData[key], dataType: config.dataType };
      });
      const bizSuccess = await bulkUpdate('business', businessSettings);

      // Also save composite JSON for edge functions
      const compositeSettings: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {
        warehouse_address: {
          value: {
            name: addressData.ship_from_name || 'ATL Urban Farms',
            company_name: addressData.ship_from_name || 'ATL Urban Farms',
            address_line1: addressData.ship_from_address_line1 || '',
            address_line2: addressData.ship_from_address_line2 || '',
            city_locality: addressData.ship_from_city || '',
            state_province: addressData.ship_from_state || '',
            postal_code: addressData.ship_from_zip || '',
            country_code: addressData.ship_from_country || 'US',
            phone: addressData.ship_from_phone || '',
          },
          dataType: 'json',
        },
      };
      const jsonSuccess = await bulkUpdate('shipping', compositeSettings);

      if (bizSuccess && jsonSuccess) {
        setSaveStatuses(prev => ({ ...prev, address: { message: 'Address saved!', type: 'success' } }));
        refetch();
      } else {
        setSaveStatuses(prev => ({ ...prev, address: { message: 'Failed to save address', type: 'error' } }));
      }
    } catch {
      setSaveStatuses(prev => ({ ...prev, address: { message: 'Failed to save address', type: 'error' } }));
    } finally {
      stopSaving('address');
      clearSaveStatus('address');
    }
  }, [addressData, bulkUpdate, refetch, clearSaveStatus]);

  // Save default package
  const handleSavePackage = useCallback(async () => {
    startSaving('package');
    setSaveStatuses(prev => ({ ...prev, package: null }));

    try {
      const packageSettings: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};
      Object.entries(PACKAGE_DEFAULTS).forEach(([key, config]) => {
        packageSettings[key] = { value: packageData[key], dataType: config.dataType };
      });

      // Also save composite JSON for edge functions
      packageSettings.default_package = {
        value: {
          weight: { value: packageData.default_package_weight || 1, unit: 'pound' },
          dimensions: {
            length: packageData.default_package_length || 12,
            width: packageData.default_package_width || 9,
            height: packageData.default_package_height || 6,
            unit: 'inch',
          },
        },
        dataType: 'json',
      };

      const success = await bulkUpdate('shipping', packageSettings);

      if (success) {
        setSaveStatuses(prev => ({ ...prev, package: { message: 'Package defaults saved!', type: 'success' } }));
        refetch();
      } else {
        setSaveStatuses(prev => ({ ...prev, package: { message: 'Failed to save package defaults', type: 'error' } }));
      }
    } catch {
      setSaveStatuses(prev => ({ ...prev, package: { message: 'Failed to save package defaults', type: 'error' } }));
    } finally {
      stopSaving('package');
      clearSaveStatus('package');
    }
  }, [packageData, bulkUpdate, refetch, clearSaveStatus]);

  // Save shipping rules
  const handleSaveRules = useCallback(async () => {
    startSaving('rules');
    setSaveStatuses(prev => ({ ...prev, rules: null }));

    try {
      const rulesSettings: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};
      Object.entries(RULES_DEFAULTS).forEach(([key, config]) => {
        rulesSettings[key] = { value: rulesData[key], dataType: config.dataType };
      });

      const success = await bulkUpdate('shipping', rulesSettings);

      if (success) {
        setSaveStatuses(prev => ({ ...prev, rules: { message: 'Shipping rules saved!', type: 'success' } }));
        refetch();
      } else {
        setSaveStatuses(prev => ({ ...prev, rules: { message: 'Failed to save shipping rules', type: 'error' } }));
      }
    } catch {
      setSaveStatuses(prev => ({ ...prev, rules: { message: 'Failed to save shipping rules', type: 'error' } }));
    } finally {
      stopSaving('rules');
      clearSaveStatus('rules');
    }
  }, [rulesData, bulkUpdate, refetch, clearSaveStatus]);

  // Save service assignment
  const handleSaveService = useCallback(async () => {
    startSaving('service');
    setSaveStatuses(prev => ({ ...prev, service: null }));

    try {
      const serviceSettings: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};
      Object.entries(SERVICE_DEFAULTS).forEach(([key, config]) => {
        serviceSettings[key] = { value: serviceData[key], dataType: config.dataType };
      });

      const success = await bulkUpdate('shipping', serviceSettings);

      if (success) {
        setSaveStatuses(prev => ({ ...prev, service: { message: 'Service assignment saved!', type: 'success' } }));
        refetch();
      } else {
        setSaveStatuses(prev => ({ ...prev, service: { message: 'Failed to save service assignment', type: 'error' } }));
      }
    } catch {
      setSaveStatuses(prev => ({ ...prev, service: { message: 'Failed to save service assignment', type: 'error' } }));
    } finally {
      stopSaving('service');
      clearSaveStatus('service');
    }
  }, [serviceData, bulkUpdate, refetch, clearSaveStatus]);

  // Validate address via ShipEngine
  const handleValidateAddress = useCallback(async () => {
    setValidating(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('shipengine-validate-address', {
        body: {
          address: {
            name: addressData.ship_from_name || 'ATL Urban Farms',
            company_name: addressData.ship_from_name || 'ATL Urban Farms',
            phone: addressData.ship_from_phone || '',
            address_line1: addressData.ship_from_address_line1,
            address_line2: addressData.ship_from_address_line2 || '',
            city_locality: addressData.ship_from_city,
            state_province: addressData.ship_from_state,
            postal_code: addressData.ship_from_zip,
            country_code: addressData.ship_from_country || 'US',
          },
        },
      });

      if (error) {
        setValidationResult({ status: 'error', messages: ['Failed to validate address. Please try again.'] });
        return;
      }

      setValidationResult({
        status: data.status,
        messages: data.messages || [],
      });
    } catch {
      setValidationResult({ status: 'error', messages: ['Failed to validate address. Please try again.'] });
    } finally {
      setValidating(false);
    }
  }, [addressData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Warehouse / Ship-From Address Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Warehouse / Ship-From Address</h3>
        <p className="text-sm text-slate-500 mb-6">
          This address is used as the origin for shipping rate calculations and labels.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-600">Business Name</label>
            <input
              type="text"
              value={addressData.ship_from_name || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_name: e.target.value }))}
              className={inputClass}
              placeholder="ATL Urban Farms"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-600">Address Line 1</label>
            <input
              type="text"
              value={addressData.ship_from_address_line1 || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_address_line1: e.target.value }))}
              className={inputClass}
              placeholder="123 Farm Street"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-600">Address Line 2</label>
            <input
              type="text"
              value={addressData.ship_from_address_line2 || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_address_line2: e.target.value }))}
              className={inputClass}
              placeholder="Suite 100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">City</label>
            <input
              type="text"
              value={addressData.ship_from_city || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_city: e.target.value }))}
              className={inputClass}
              placeholder="Atlanta"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">State</label>
            <select
              value={addressData.ship_from_state || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_state: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select state</option>
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">ZIP Code</label>
            <input
              type="text"
              value={addressData.ship_from_zip || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_zip: e.target.value }))}
              className={inputClass}
              placeholder="30301"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Phone</label>
            <input
              type="tel"
              value={addressData.ship_from_phone || ''}
              onChange={(e) => setAddressData(prev => ({ ...prev, ship_from_phone: e.target.value }))}
              className={inputClass}
              placeholder="(404) 555-0123"
            />
          </div>
        </div>

        {/* Address Validation */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleValidateAddress}
            disabled={validating || !addressData.ship_from_address_line1 || !addressData.ship_from_city || !addressData.ship_from_state || !addressData.ship_from_zip}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {validating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <MapPin size={16} />
                Validate Address
              </>
            )}
          </button>

          <AnimatePresence>
            {validationResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  validationResult.status === 'verified'
                    ? 'bg-emerald-50 border-emerald-200'
                    : validationResult.status === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {validationResult.status === 'verified' && <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
                {validationResult.status === 'warning' && <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                {(validationResult.status === 'unverified' || validationResult.status === 'error') && (
                  <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    validationResult.status === 'verified' ? 'text-emerald-700'
                    : validationResult.status === 'warning' ? 'text-amber-700'
                    : 'text-red-700'
                  }`}>
                    {validationResult.status === 'verified' && 'Address verified'}
                    {validationResult.status === 'warning' && 'Address verified with warnings'}
                    {validationResult.status === 'unverified' && 'Address could not be verified'}
                    {validationResult.status === 'error' && 'Validation failed'}
                  </p>
                  {validationResult.messages.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {validationResult.messages.map((msg, i) => (
                        <li key={i} className="text-xs text-slate-600">{msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SectionSaveButton
          saving={savingSections.has('address')}
          status={saveStatuses.address}
          onClick={handleSaveAddress}
        />
      </div>

      {/* Default Package Dimensions Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Default Package Dimensions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Used when calculating shipping rates if no product-specific weight is set.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Weight (lbs)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={packageData.default_package_weight ?? 1}
              onChange={(e) => setPackageData(prev => ({ ...prev, default_package_weight: parseFloat(e.target.value) || 1 }))}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Length (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={packageData.default_package_length ?? 12}
              onChange={(e) => setPackageData(prev => ({ ...prev, default_package_length: parseFloat(e.target.value) || 12 }))}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Width (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={packageData.default_package_width ?? 9}
              onChange={(e) => setPackageData(prev => ({ ...prev, default_package_width: parseFloat(e.target.value) || 9 }))}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Height (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={packageData.default_package_height ?? 6}
              onChange={(e) => setPackageData(prev => ({ ...prev, default_package_height: parseFloat(e.target.value) || 6 }))}
              className={inputClass}
            />
          </div>
        </div>

        <SectionSaveButton
          saving={savingSections.has('package')}
          status={saveStatuses.package}
          onClick={handleSavePackage}
        />
      </div>

      {/* Shipping Rules Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Shipping Rules</h3>
        <p className="text-sm text-slate-500 mb-6">
          Configure free shipping thresholds and rate adjustments.
        </p>

        <div className="space-y-6">
          {/* Free Shipping */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={rulesData.free_shipping_enabled ?? false}
                  onChange={(e) => setRulesData(prev => ({ ...prev, free_shipping_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
              <div>
                <h4 className="text-slate-800 font-medium">Free Shipping Threshold</h4>
                <p className="text-sm text-slate-500">Offer free shipping for orders above a certain amount</p>
              </div>
            </div>

            <AnimatePresence>
              {rulesData.free_shipping_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="block text-sm font-medium text-slate-600">Minimum Order Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rulesData.free_shipping_threshold ?? 50}
                      onChange={(e) => setRulesData(prev => ({ ...prev, free_shipping_threshold: parseFloat(e.target.value) || 0 }))}
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Set to 0 to disable. Orders above this amount qualify for free shipping.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rate Markup */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Shipping Rate Markup</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRulesData(prev => ({ ...prev, shipping_rate_markup_type: 'percentage' }))}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    rulesData.shipping_rate_markup_type === 'percentage' || !rulesData.shipping_rate_markup_type
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setRulesData(prev => ({ ...prev, shipping_rate_markup_type: 'fixed' }))}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    rulesData.shipping_rate_markup_type === 'fixed'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Fixed Amount ($)
                </button>
              </div>
            </div>

            {(rulesData.shipping_rate_markup_type === 'percentage' || !rulesData.shipping_rate_markup_type) && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">Markup Percentage</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={rulesData.shipping_rate_markup_percent ?? 0}
                    onChange={(e) => setRulesData(prev => ({ ...prev, shipping_rate_markup_percent: parseFloat(e.target.value) || 0 }))}
                    className={`${inputClass} pr-10`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                </div>
                <p className="text-xs text-slate-500">Added to carrier rates. Example: $10.00 rate + 10% = $11.00 shown to customer.</p>
              </div>
            )}

            {rulesData.shipping_rate_markup_type === 'fixed' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">Markup Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rulesData.shipping_rate_markup_dollars ?? 0}
                    onChange={(e) => setRulesData(prev => ({ ...prev, shipping_rate_markup_dollars: parseFloat(e.target.value) || 0 }))}
                    className={`${inputClass} pl-8`}
                  />
                </div>
                <p className="text-xs text-slate-500">Added to carrier rates. Example: $8.99 rate + $2.50 = $11.49 shown to customer.</p>
              </div>
            )}
          </div>
        </div>

        <SectionSaveButton
          saving={savingSections.has('rules')}
          status={saveStatuses.rules}
          onClick={handleSaveRules}
        />
      </div>

      {/* Service Assignment Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Service Assignment</h3>
        <p className="text-sm text-slate-500 mb-6">
          Assign a single shipping service per state. Customers won't choose — they see one option based on their state.
        </p>

        <div className="space-y-6">
          {/* Default Service */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Default Service (all states)</label>
            <select
              value={serviceData.forced_service_default || 'ups_ground'}
              onChange={(e) => setServiceData(prev => ({ ...prev, forced_service_default: e.target.value }))}
              className={inputClass}
            >
              {UPS_SERVICES.map((svc) => (
                <option key={svc.value} value={svc.value}>{svc.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">This service is used for all states unless overridden below.</p>
          </div>

          {/* Override Service */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Override Service</label>
            <select
              value={serviceData.forced_service_overrides?.service_code || 'ups_3_day_select'}
              onChange={(e) => setServiceData(prev => ({
                ...prev,
                forced_service_overrides: {
                  ...prev.forced_service_overrides,
                  service_code: e.target.value,
                },
              }))}
              className={inputClass}
            >
              {UPS_SERVICES.map((svc) => (
                <option key={svc.value} value={svc.value}>{svc.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">States selected below will use this service instead of the default.</p>
          </div>

          {/* Override States */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Override States</label>
            <div className="flex flex-wrap gap-2">
              {US_STATES.map((state) => {
                const selected = (serviceData.forced_service_overrides?.states || []).includes(state.value);
                return (
                  <button
                    key={state.value}
                    type="button"
                    onClick={() => {
                      setServiceData(prev => {
                        const currentStates: string[] = prev.forced_service_overrides?.states || [];
                        const newStates = selected
                          ? currentStates.filter((s: string) => s !== state.value)
                          : [...currentStates, state.value];
                        return {
                          ...prev,
                          forced_service_overrides: {
                            ...prev.forced_service_overrides,
                            states: newStates,
                          },
                        };
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selected
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {state.value}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              {(serviceData.forced_service_overrides?.states || []).length} state{(serviceData.forced_service_overrides?.states || []).length !== 1 ? 's' : ''} selected for override
            </p>
          </div>
        </div>

        <SectionSaveButton
          saving={savingSections.has('service')}
          status={saveStatuses.service}
          onClick={handleSaveService}
        />
      </div>
    </div>
  );
};

export default ShippingSettingsTab;
