import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../hooks/useSettings';

type TabType = 'business' | 'checkout' | 'shipping' | 'inventory' | 'notifications' | 'branding';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

// Default settings for each category
const DEFAULT_SETTINGS: Record<string, Record<string, { value: any; dataType: ConfigSetting['data_type'] }>> = {
  business: {
    company_name: { value: '', dataType: 'string' },
    support_email: { value: '', dataType: 'string' },
    support_phone: { value: '', dataType: 'string' },
    timezone: { value: 'America/New_York', dataType: 'string' },
    ship_from_address_line1: { value: '', dataType: 'string' },
    ship_from_address_line2: { value: '', dataType: 'string' },
    ship_from_city: { value: '', dataType: 'string' },
    ship_from_state: { value: '', dataType: 'string' },
    ship_from_zip: { value: '', dataType: 'string' },
    ship_from_country: { value: 'US', dataType: 'string' },
  },
  checkout: {
    guest_checkout_enabled: { value: true, dataType: 'boolean' },
    minimum_order_amount: { value: 0, dataType: 'number' },
    maximum_order_amount: { value: 10000, dataType: 'number' },
    cart_expiration_hours: { value: 24, dataType: 'number' },
  },
  shipping: {
    free_shipping_enabled: { value: false, dataType: 'boolean' },
    free_shipping_threshold: { value: 50, dataType: 'number' },
    default_shipping_service: { value: 'standard', dataType: 'string' },
  },
  inventory: {
    default_buffer_percentage: { value: 10, dataType: 'number' },
    low_stock_threshold: { value: 10, dataType: 'number' },
    allow_oversell: { value: false, dataType: 'boolean' },
    allocation_strategy: { value: 'fifo', dataType: 'string' },
  },
  notifications: {
    order_confirmation_email: { value: true, dataType: 'boolean' },
    shipping_notification_email: { value: true, dataType: 'boolean' },
    shipping_notification_sms: { value: false, dataType: 'boolean' },
    low_stock_alert: { value: true, dataType: 'boolean' },
    admin_notification_emails: { value: '', dataType: 'string' },
  },
  branding: {
    logo_url: { value: '', dataType: 'string' },
    primary_brand_color: { value: '#10b981', dataType: 'string' },
    homepage_announcement: { value: '', dataType: 'string' },
    announcement_bar_enabled: { value: false, dataType: 'boolean' },
    announcement_bar_text: { value: '', dataType: 'string' },
  },
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
];

const SHIPPING_SERVICES = [
  { value: 'standard', label: 'Standard Shipping' },
  { value: 'express', label: 'Express Shipping' },
  { value: 'overnight', label: 'Overnight Shipping' },
  { value: 'local_pickup', label: 'Local Pickup' },
  { value: 'local_delivery', label: 'Local Delivery' },
];

const ALLOCATION_STRATEGIES = [
  { value: 'fifo', label: 'FIFO (First In, First Out)' },
  { value: 'lifo', label: 'LIFO (Last In, First Out)' },
  { value: 'fefo', label: 'FEFO (First Expired, First Out)' },
];

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

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('business');
  const { settings, loading, error, refetch } = useSettings();
  const { bulkUpdate, loading: saving } = useBulkUpdateSettings();

  // Form state for each tab
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Initialize form data with defaults and loaded settings
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

  const tabs: TabConfig[] = [
    {
      id: 'business',
      label: 'Business',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'checkout',
      label: 'Checkout',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'shipping',
      label: 'Shipping',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
  ];

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

  const handleSave = useCallback(async (category: string) => {
    const categoryData = formData[category];
    const categoryDefaults = DEFAULT_SETTINGS[category];

    if (!categoryData || !categoryDefaults) return;

    const settingsToSave: Record<string, { value: any; dataType: ConfigSetting['data_type'] }> = {};

    Object.entries(categoryDefaults).forEach(([key, config]) => {
      settingsToSave[key] = {
        value: categoryData[key],
        dataType: config.dataType,
      };
    });

    const success = await bulkUpdate(category, settingsToSave);

    if (success) {
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(null), 3000);
      refetch();
    }
  }, [formData, bulkUpdate, refetch]);

  const renderBusinessTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Company Name</label>
          <input
            type="text"
            value={formData.business?.company_name || ''}
            onChange={(e) => updateField('business', 'company_name', e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="ATL Urban Farms"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Support Email</label>
          <input
            type="email"
            value={formData.business?.support_email || ''}
            onChange={(e) => updateField('business', 'support_email', e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="support@atlurbanfarms.com"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Support Phone</label>
          <input
            type="tel"
            value={formData.business?.support_phone || ''}
            onChange={(e) => updateField('business', 'support_phone', e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="(404) 555-0123"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Timezone</label>
          <select
            value={formData.business?.timezone || 'America/New_York'}
            onChange={(e) => updateField('business', 'timezone', e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-medium text-white mb-4">Ship-From Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Address Line 1</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line1 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line1', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="123 Farm Street"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Address Line 2</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line2 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line2', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Suite 100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">City</label>
            <input
              type="text"
              value={formData.business?.ship_from_city || ''}
              onChange={(e) => updateField('business', 'ship_from_city', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Atlanta"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">State</label>
            <select
              value={formData.business?.ship_from_state || ''}
              onChange={(e) => updateField('business', 'ship_from_state', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select state</option>
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">ZIP Code</label>
            <input
              type="text"
              value={formData.business?.ship_from_zip || ''}
              onChange={(e) => updateField('business', 'ship_from_zip', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="30301"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Country</label>
            <select
              value={formData.business?.ship_from_country || 'US'}
              onChange={(e) => updateField('business', 'ship_from_country', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="US">United States</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCheckoutTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Guest Checkout</h4>
          <p className="text-sm text-slate-400">Allow customers to checkout without creating an account</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.checkout?.guest_checkout_enabled ?? true}
            onChange={(e) => updateField('checkout', 'guest_checkout_enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Minimum Order Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.checkout?.minimum_order_amount ?? 0}
            onChange={(e) => updateField('checkout', 'minimum_order_amount', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400">Set to 0 for no minimum</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Maximum Order Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.checkout?.maximum_order_amount ?? 10000}
            onChange={(e) => updateField('checkout', 'maximum_order_amount', parseFloat(e.target.value) || 10000)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400">Set to 0 for no maximum</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Cart Expiration (hours)</label>
          <input
            type="number"
            min="1"
            value={formData.checkout?.cart_expiration_hours ?? 24}
            onChange={(e) => updateField('checkout', 'cart_expiration_hours', parseInt(e.target.value) || 24)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400">How long until an inactive cart expires</p>
        </div>
      </div>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Free Shipping</h4>
          <p className="text-sm text-slate-400">Enable free shipping for orders above a threshold</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.shipping?.free_shipping_enabled ?? false}
            onChange={(e) => updateField('shipping', 'free_shipping_enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
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
            <label className="block text-sm font-medium text-slate-300">Free Shipping Threshold ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.shipping?.free_shipping_threshold ?? 50}
              onChange={(e) => updateField('shipping', 'free_shipping_threshold', parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-400">Orders above this amount qualify for free shipping</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Default Shipping Service</label>
        <select
          value={formData.shipping?.default_shipping_service || 'standard'}
          onChange={(e) => updateField('shipping', 'default_shipping_service', e.target.value)}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {SHIPPING_SERVICES.map((service) => (
            <option key={service.value} value={service.value}>{service.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Default Buffer Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={formData.inventory?.default_buffer_percentage ?? 10}
            onChange={(e) => updateField('inventory', 'default_buffer_percentage', parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400">Reserve this percentage of inventory as buffer stock</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Low Stock Threshold</label>
          <input
            type="number"
            min="0"
            value={formData.inventory?.low_stock_threshold ?? 10}
            onChange={(e) => updateField('inventory', 'low_stock_threshold', parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400">Alert when stock falls below this quantity</p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Allow Overselling</h4>
          <p className="text-sm text-slate-400">Allow orders even when inventory is insufficient</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.inventory?.allow_oversell ?? false}
            onChange={(e) => updateField('inventory', 'allow_oversell', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Allocation Strategy</label>
        <select
          value={formData.inventory?.allocation_strategy || 'fifo'}
          onChange={(e) => updateField('inventory', 'allocation_strategy', e.target.value)}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {ALLOCATION_STRATEGIES.map((strategy) => (
            <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400">How inventory batches are selected for fulfillment</p>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white">Customer Notifications</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Order Confirmation Email</h4>
            <p className="text-sm text-slate-400">Send email when order is placed</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications?.order_confirmation_email ?? true}
              onChange={(e) => updateField('notifications', 'order_confirmation_email', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Shipping Notification Email</h4>
            <p className="text-sm text-slate-400">Send email when order ships</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications?.shipping_notification_email ?? true}
              onChange={(e) => updateField('notifications', 'shipping_notification_email', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Shipping Notification SMS</h4>
            <p className="text-sm text-slate-400">Send SMS when order ships</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notifications?.shipping_notification_sms ?? false}
              onChange={(e) => updateField('notifications', 'shipping_notification_sms', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-medium text-white mb-4">Admin Notifications</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Low Stock Alert</h4>
              <p className="text-sm text-slate-400">Notify admins when inventory is low</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notifications?.low_stock_alert ?? true}
                onChange={(e) => updateField('notifications', 'low_stock_alert', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Admin Notification Emails</label>
            <input
              type="text"
              value={formData.notifications?.admin_notification_emails || ''}
              onChange={(e) => updateField('notifications', 'admin_notification_emails', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="admin@example.com, manager@example.com"
            />
            <p className="text-xs text-slate-400">Comma-separated list of email addresses</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBrandingTab = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Logo URL</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={formData.branding?.logo_url || ''}
            onChange={(e) => updateField('branding', 'logo_url', e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="https://example.com/logo.png"
          />
          {formData.branding?.logo_url && (
            <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-slate-600">
              <img
                src={formData.branding.logo_url}
                alt="Logo preview"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400">Enter the URL of your logo image</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Primary Brand Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={formData.branding?.primary_brand_color || '#10b981'}
            onChange={(e) => updateField('branding', 'primary_brand_color', e.target.value)}
            className="w-16 h-12 rounded-lg border border-slate-600 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={formData.branding?.primary_brand_color || '#10b981'}
            onChange={(e) => updateField('branding', 'primary_brand_color', e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="#10b981"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Homepage Announcement</label>
        <textarea
          value={formData.branding?.homepage_announcement || ''}
          onChange={(e) => updateField('branding', 'homepage_announcement', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          placeholder="Welcome to our farm! Check out our fresh produce..."
        />
        <p className="text-xs text-slate-400">Displayed on the homepage</p>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-medium text-white mb-4">Announcement Bar</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Show Announcement Bar</h4>
              <p className="text-sm text-slate-400">Display a banner at the top of the site</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.branding?.announcement_bar_enabled ?? false}
                onChange={(e) => updateField('branding', 'announcement_bar_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <AnimatePresence>
            {formData.branding?.announcement_bar_enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-slate-300">Announcement Bar Text</label>
                <input
                  type="text"
                  value={formData.branding?.announcement_bar_text || ''}
                  onChange={(e) => updateField('branding', 'announcement_bar_text', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Free shipping on orders over $50!"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'business':
        return renderBusinessTab();
      case 'checkout':
        return renderCheckoutTab();
      case 'shipping':
        return renderShippingTab();
      case 'inventory':
        return renderInventoryTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'branding':
        return renderBrandingTab();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-700">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeSettingsTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-700">
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-emerald-400 font-medium"
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={() => handleSave(activeTab)}
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
      </div>
    </AdminPageWrapper>
  );
};

export default SettingsPage;
