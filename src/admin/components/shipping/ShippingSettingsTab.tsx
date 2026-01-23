import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../../hooks/useSettings';

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

const DEFAULT_SETTINGS: Record<string, Record<string, { value: any; dataType: ConfigSetting['data_type'] }>> = {
  business: {
    ship_from_address_line1: { value: '', dataType: 'string' },
    ship_from_address_line2: { value: '', dataType: 'string' },
    ship_from_city: { value: '', dataType: 'string' },
    ship_from_state: { value: '', dataType: 'string' },
    ship_from_zip: { value: '', dataType: 'string' },
    ship_from_country: { value: 'US', dataType: 'string' },
  },
  shipping: {
    free_shipping_enabled: { value: false, dataType: 'boolean' },
    free_shipping_threshold: { value: 50, dataType: 'number' },
    shipping_rate_markup_percent: { value: 0, dataType: 'number' },
    default_package_length: { value: 12, dataType: 'number' },
    default_package_width: { value: 9, dataType: 'number' },
    default_package_height: { value: 6, dataType: 'number' },
    default_package_weight: { value: 1, dataType: 'number' },
  },
};

const ShippingSettingsTab: React.FC = () => {
  const { settings, loading, refetch } = useSettings();
  const { bulkUpdate, loading: saving } = useBulkUpdateSettings();

  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const newFormData: Record<string, Record<string, any>> = {};

    Object.entries(DEFAULT_SETTINGS).forEach(([category, fields]) => {
      newFormData[category] = {};
      Object.entries(fields).forEach(([key, config]) => {
        newFormData[category][key] = settings[category]?.[key] ?? config.value;
      });
    });

    setFormData(newFormData);
  }, [settings]);

  const updateField = useCallback((category: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    // Save both business and shipping categories
    for (const category of ['business', 'shipping']) {
      const categoryData = formData[category];
      const categoryDefaults = DEFAULT_SETTINGS[category];

      if (!categoryData || !categoryDefaults) continue;

      const settingsToSave: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};

      Object.entries(categoryDefaults).forEach(([key, config]) => {
        settingsToSave[key] = {
          value: categoryData[key],
          dataType: config.dataType,
        };
      });

      await bulkUpdate(category, settingsToSave);
    }

    setSaveMessage('Settings saved!');
    setTimeout(() => setSaveMessage(null), 3000);
    refetch();
  }, [formData, bulkUpdate, refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Warehouse Address Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Ship-From Address</h3>
        <p className="text-sm text-slate-500 mb-6">
          This address is used as the origin for shipping rate calculations and labels.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-600">Address Line 1</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line1 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line1', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="123 Farm Street"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-600">Address Line 2</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line2 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line2', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="Suite 100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">City</label>
            <input
              type="text"
              value={formData.business?.ship_from_city || ''}
              onChange={(e) => updateField('business', 'ship_from_city', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="Atlanta"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">State</label>
            <select
              value={formData.business?.ship_from_state || ''}
              onChange={(e) => updateField('business', 'ship_from_state', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
              value={formData.business?.ship_from_zip || ''}
              onChange={(e) => updateField('business', 'ship_from_zip', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="30301"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Country</label>
            <select
              value={formData.business?.ship_from_country || 'US'}
              onChange={(e) => updateField('business', 'ship_from_country', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="US">United States</option>
            </select>
          </div>
        </div>
      </div>

      {/* Free Shipping Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Free Shipping</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <h4 className="text-slate-800 font-medium">Enable Free Shipping</h4>
              <p className="text-sm text-slate-500">Offer free shipping for orders above a threshold</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.shipping?.free_shipping_enabled ?? false}
                onChange={(e) => updateField('shipping', 'free_shipping_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <AnimatePresence>
            {formData.shipping?.free_shipping_enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-slate-600">Free Shipping Threshold ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.shipping?.free_shipping_threshold ?? 50}
                  onChange={(e) => updateField('shipping', 'free_shipping_threshold', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500">Orders above this amount qualify for free shipping</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Rate Markup Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Rate Markup</h3>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-600">Markup Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.shipping?.shipping_rate_markup_percent ?? 0}
            onChange={(e) => updateField('shipping', 'shipping_rate_markup_percent', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <p className="text-xs text-slate-500">Add a percentage markup to all carrier shipping rates (0 = no markup)</p>
        </div>
      </div>

      {/* Default Package Dimensions Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Default Package Dimensions</h3>
        <p className="text-sm text-slate-500 mb-6">
          These dimensions are used when calculating shipping rates if product dimensions are not specified.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Length (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={formData.shipping?.default_package_length ?? 12}
              onChange={(e) => updateField('shipping', 'default_package_length', parseFloat(e.target.value) || 12)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Width (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={formData.shipping?.default_package_width ?? 9}
              onChange={(e) => updateField('shipping', 'default_package_width', parseFloat(e.target.value) || 9)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Height (in)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={formData.shipping?.default_package_height ?? 6}
              onChange={(e) => updateField('shipping', 'default_package_height', parseFloat(e.target.value) || 6)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Weight (lbs)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={formData.shipping?.default_package_weight ?? 1}
              onChange={(e) => updateField('shipping', 'default_package_weight', parseFloat(e.target.value) || 1)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <AnimatePresence>
          {saveMessage && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-emerald-600 font-medium"
            >
              {saveMessage}
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShippingSettingsTab;
