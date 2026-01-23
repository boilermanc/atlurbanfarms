import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../hooks/useSettings';
import { Building2, ShoppingCart, Package, Bell, Palette, Save, Truck } from 'lucide-react';

type TabType = 'business' | 'shipping' | 'checkout' | 'inventory' | 'notifications' | 'branding';

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
  shipping: {
    weekly_cutoff_day: { value: '0', dataType: 'string' },
    weekly_cutoff_time: { value: '23:59', dataType: 'string' },
    timezone: { value: 'America/New_York', dataType: 'string' },
    default_ship_day: { value: '2', dataType: 'string' },
    customer_shipping_message: { value: '', dataType: 'string' },
    admin_shipping_notes: { value: '', dataType: 'string' },
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

const ALLOCATION_STRATEGIES = [
  { value: 'fifo', label: 'FIFO (First In, First Out)' },
  { value: 'lifo', label: 'LIFO (Last In, First Out)' },
  { value: 'fefo', label: 'FEFO (First Expired, First Out)' },
];

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
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
    { id: 'business', label: 'Business', icon: <Building2 size={20} /> },
    { id: 'shipping', label: 'Shipping', icon: <Truck size={20} /> },
    { id: 'checkout', label: 'Checkout', icon: <ShoppingCart size={20} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={20} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} /> },
    { id: 'branding', label: 'Branding', icon: <Palette size={20} /> },
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
          <label className="block text-sm font-medium text-slate-700">Company Name</label>
          <input
            type="text"
            value={formData.business?.company_name || ''}
            onChange={(e) => updateField('business', 'company_name', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="ATL Urban Farms"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Support Email</label>
          <input
            type="email"
            value={formData.business?.support_email || ''}
            onChange={(e) => updateField('business', 'support_email', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="support@atlurbanfarms.com"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Support Phone</label>
          <input
            type="tel"
            value={formData.business?.support_phone || ''}
            onChange={(e) => updateField('business', 'support_phone', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="(404) 555-0123"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Timezone</label>
          <select
            value={formData.business?.timezone || 'America/New_York'}
            onChange={(e) => updateField('business', 'timezone', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Ship-From Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Address Line 1</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line1 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line1', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="123 Farm Street"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
            <input
              type="text"
              value={formData.business?.ship_from_address_line2 || ''}
              onChange={(e) => updateField('business', 'ship_from_address_line2', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Suite 100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">City</label>
            <input
              type="text"
              value={formData.business?.ship_from_city || ''}
              onChange={(e) => updateField('business', 'ship_from_city', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Atlanta"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">State</label>
            <select
              value={formData.business?.ship_from_state || ''}
              onChange={(e) => updateField('business', 'ship_from_state', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="">Select state</option>
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">ZIP Code</label>
            <input
              type="text"
              value={formData.business?.ship_from_zip || ''}
              onChange={(e) => updateField('business', 'ship_from_zip', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="30301"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Country</label>
            <select
              value={formData.business?.ship_from_country || 'US'}
              onChange={(e) => updateField('business', 'ship_from_country', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="US">United States</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 mb-1">Weekly Shipping Schedule</h3>
        <p className="text-sm text-slate-500">Configure your weekly order cutoff and shipping day for batch processing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Cutoff Day, Cutoff Time, Timezone */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Order Cutoff Day</label>
            <select
              value={formData.shipping?.weekly_cutoff_day || '0'}
              onChange={(e) => updateField('shipping', 'weekly_cutoff_day', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Orders placed after this day will ship the following week</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Cutoff Time</label>
            <input
              type="time"
              value={formData.shipping?.weekly_cutoff_time || '23:59'}
              onChange={(e) => updateField('shipping', 'weekly_cutoff_time', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-slate-500">Orders must be placed by this time on the cutoff day</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Timezone</label>
            <select
              value={formData.shipping?.timezone || 'America/New_York'}
              onChange={(e) => updateField('shipping', 'timezone', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              {TIMEZONES.filter(tz => tz.value.startsWith('America/')).map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Timezone for cutoff time calculations</p>
          </div>
        </div>

        {/* Right column: Typical Ship Day */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Typical Ship Day</label>
            <select
              value={formData.shipping?.default_ship_day || '2'}
              onChange={(e) => updateField('shipping', 'default_ship_day', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">The day of the week orders are typically shipped</p>
          </div>
        </div>
      </div>

      {/* Full width: Customer Message and Internal Notes */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Customer Message</label>
          <textarea
            value={formData.shipping?.customer_shipping_message || ''}
            onChange={(e) => updateField('shipping', 'customer_shipping_message', e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            placeholder="Orders placed by Sunday at 11:59 PM ET will ship the following Tuesday. Live plants are shipped with care to ensure they arrive healthy!"
          />
          <p className="text-xs text-slate-500">This message is displayed to customers at checkout to explain the shipping schedule</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Internal Notes</label>
          <textarea
            value={formData.shipping?.admin_shipping_notes || ''}
            onChange={(e) => updateField('shipping', 'admin_shipping_notes', e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            placeholder="Notes for the fulfillment team about shipping procedures, carrier preferences, etc."
          />
          <p className="text-xs text-slate-500">Internal notes for the admin/fulfillment team (not shown to customers)</p>
        </div>
      </div>
    </div>
  );

  const renderCheckoutTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
        <div>
          <h4 className="text-slate-800 font-medium">Guest Checkout</h4>
          <p className="text-sm text-slate-500">Allow customers to checkout without creating an account</p>
        </div>
        <button
          onClick={() => updateField('checkout', 'guest_checkout_enabled', !formData.checkout?.guest_checkout_enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            formData.checkout?.guest_checkout_enabled ?? true ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
              formData.checkout?.guest_checkout_enabled ?? true ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Minimum Order Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.checkout?.minimum_order_amount ?? 0}
            onChange={(e) => updateField('checkout', 'minimum_order_amount', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <p className="text-xs text-slate-500">Set to 0 for no minimum</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Maximum Order Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.checkout?.maximum_order_amount ?? 10000}
            onChange={(e) => updateField('checkout', 'maximum_order_amount', parseFloat(e.target.value) || 10000)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <p className="text-xs text-slate-500">Set to 0 for no maximum</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Cart Expiration (hours)</label>
          <input
            type="number"
            min="1"
            value={formData.checkout?.cart_expiration_hours ?? 24}
            onChange={(e) => updateField('checkout', 'cart_expiration_hours', parseInt(e.target.value) || 24)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <p className="text-xs text-slate-500">How long until an inactive cart expires</p>
        </div>
      </div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Default Buffer Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={formData.inventory?.default_buffer_percentage ?? 10}
            onChange={(e) => updateField('inventory', 'default_buffer_percentage', parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <p className="text-xs text-slate-500">Reserve this percentage of inventory as buffer stock</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Low Stock Threshold</label>
          <input
            type="number"
            min="0"
            value={formData.inventory?.low_stock_threshold ?? 10}
            onChange={(e) => updateField('inventory', 'low_stock_threshold', parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <p className="text-xs text-slate-500">Alert when stock falls below this quantity</p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
        <div>
          <h4 className="text-slate-800 font-medium">Allow Overselling</h4>
          <p className="text-sm text-slate-500">Allow orders even when inventory is insufficient</p>
        </div>
        <button
          onClick={() => updateField('inventory', 'allow_oversell', !formData.inventory?.allow_oversell)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            formData.inventory?.allow_oversell ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
              formData.inventory?.allow_oversell ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Allocation Strategy</label>
        <select
          value={formData.inventory?.allocation_strategy || 'fifo'}
          onChange={(e) => updateField('inventory', 'allocation_strategy', e.target.value)}
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        >
          {ALLOCATION_STRATEGIES.map((strategy) => (
            <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500">How inventory batches are selected for fulfillment</p>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-slate-800">Customer Notifications</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div>
            <h4 className="text-slate-800 font-medium">Order Confirmation Email</h4>
            <p className="text-sm text-slate-500">Send email when order is placed</p>
          </div>
          <button
            onClick={() => updateField('notifications', 'order_confirmation_email', !formData.notifications?.order_confirmation_email)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.notifications?.order_confirmation_email ?? true ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                formData.notifications?.order_confirmation_email ?? true ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div>
            <h4 className="text-slate-800 font-medium">Shipping Notification Email</h4>
            <p className="text-sm text-slate-500">Send email when order ships</p>
          </div>
          <button
            onClick={() => updateField('notifications', 'shipping_notification_email', !formData.notifications?.shipping_notification_email)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.notifications?.shipping_notification_email ?? true ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                formData.notifications?.shipping_notification_email ?? true ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div>
            <h4 className="text-slate-800 font-medium">Shipping Notification SMS</h4>
            <p className="text-sm text-slate-500">Send SMS when order ships</p>
          </div>
          <button
            onClick={() => updateField('notifications', 'shipping_notification_sms', !formData.notifications?.shipping_notification_sms)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.notifications?.shipping_notification_sms ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                formData.notifications?.shipping_notification_sms ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Admin Notifications</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <div>
              <h4 className="text-slate-800 font-medium">Low Stock Alert</h4>
              <p className="text-sm text-slate-500">Notify admins when inventory is low</p>
            </div>
            <button
              onClick={() => updateField('notifications', 'low_stock_alert', !formData.notifications?.low_stock_alert)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.notifications?.low_stock_alert ?? true ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                  formData.notifications?.low_stock_alert ?? true ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Admin Notification Emails</label>
            <input
              type="text"
              value={formData.notifications?.admin_notification_emails || ''}
              onChange={(e) => updateField('notifications', 'admin_notification_emails', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="admin@example.com, manager@example.com"
            />
            <p className="text-xs text-slate-500">Comma-separated list of email addresses</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBrandingTab = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Logo URL</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={formData.branding?.logo_url || ''}
            onChange={(e) => updateField('branding', 'logo_url', e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="https://example.com/logo.png"
          />
          {formData.branding?.logo_url && (
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
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
        <p className="text-xs text-slate-500">Enter the URL of your logo image</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Primary Brand Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={formData.branding?.primary_brand_color || '#10b981'}
            onChange={(e) => updateField('branding', 'primary_brand_color', e.target.value)}
            className="w-16 h-12 rounded-xl border border-slate-200 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={formData.branding?.primary_brand_color || '#10b981'}
            onChange={(e) => updateField('branding', 'primary_brand_color', e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="#10b981"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Homepage Announcement</label>
        <textarea
          value={formData.branding?.homepage_announcement || ''}
          onChange={(e) => updateField('branding', 'homepage_announcement', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
          placeholder="Welcome to our farm! Check out our fresh produce..."
        />
        <p className="text-xs text-slate-500">Displayed on the homepage</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Announcement Bar</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <div>
              <h4 className="text-slate-800 font-medium">Show Announcement Bar</h4>
              <p className="text-sm text-slate-500">Display a banner at the top of the site</p>
            </div>
            <button
              onClick={() => updateField('branding', 'announcement_bar_enabled', !formData.branding?.announcement_bar_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.branding?.announcement_bar_enabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                  formData.branding?.announcement_bar_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {formData.branding?.announcement_bar_enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-slate-700">Announcement Bar Text</label>
                <input
                  type="text"
                  value={formData.branding?.announcement_bar_text || ''}
                  onChange={(e) => updateField('branding', 'announcement_bar_text', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
      case 'shipping':
        return renderShippingTab();
      case 'checkout':
        return renderCheckoutTab();
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
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure your store settings</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeSettingsTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
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
          <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-200">
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
              onClick={() => handleSave(activeTab)}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
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
