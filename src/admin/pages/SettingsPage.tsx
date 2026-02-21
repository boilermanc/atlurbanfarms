import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../hooks/useSettings';
import { supabase } from '../../lib/supabase';
import { Building2, ShoppingCart, Package, Bell, Palette, Save, Upload, Trash2, Receipt } from 'lucide-react';

type TabType = 'business' | 'checkout' | 'tax' | 'inventory' | 'notifications' | 'branding';

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
    secondary_brand_color: { value: '#047857', dataType: 'string' },
    heading_font: { value: 'Plus Jakarta Sans', dataType: 'string' },
    heading_font_size: { value: 28, dataType: 'number' },
    body_font: { value: 'Inter', dataType: 'string' },
    body_font_size: { value: 16, dataType: 'number' },
    background_color: { value: '#fafafa', dataType: 'string' },
    secondary_background_color: { value: '#ffffff', dataType: 'string' },
    announcement_bar_enabled: { value: false, dataType: 'boolean' },
    announcement_bar_text: { value: '', dataType: 'string' },
    social_facebook: { value: '', dataType: 'string' },
    social_instagram: { value: '', dataType: 'string' },
    social_twitter: { value: '', dataType: 'string' },
    social_youtube: { value: '', dataType: 'string' },
    social_tiktok: { value: '', dataType: 'string' },
  },
  tax: {
    tax_enabled: { value: true, dataType: 'boolean' },
    default_tax_rate: { value: 0.07, dataType: 'number' },
    nexus_states: { value: '["GA"]', dataType: 'json' },
    tax_label: { value: 'Sales Tax', dataType: 'string' },
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

// Fonts already loaded via index.html <link> tag
const PRELOADED_FONTS = ['Inter', 'Plus Jakarta Sans', 'DM Sans', 'Space Grotesk', 'Caveat', 'Patrick Hand'];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];


const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('business');
  const { settings, loading, error, refetch } = useSettings();
  const { bulkUpdate, loading: saving } = useBulkUpdateSettings();

  // Form state for each tab
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Track when dynamically-loaded fonts become available so previews re-render
  const [fontLoadKey, setFontLoadKey] = useState(0);

  // Dynamically load Google Fonts for typography preview
  useEffect(() => {
    const headingFont = formData.branding?.heading_font;
    const bodyFont = formData.branding?.body_font;
    const fontsToLoad = new Set<string>();
    if (headingFont && !PRELOADED_FONTS.includes(headingFont)) fontsToLoad.add(headingFont);
    if (bodyFont && !PRELOADED_FONTS.includes(bodyFont)) fontsToLoad.add(bodyFont);

    const linkId = 'settings-preview-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;

    if (fontsToLoad.size === 0) {
      link?.remove();
      return;
    }

    const families = Array.from(fontsToLoad)
      .map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`)
      .join('&');
    const newHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    // Update href in-place (keeps previously loaded fonts available during load)
    if (link.href !== newHref) {
      link.onload = () => {
        // After stylesheet loads, wait for font files to finish loading then re-render
        document.fonts.ready.then(() => setFontLoadKey(k => k + 1));
      };
      link.href = newHref;
    }
  }, [formData.branding?.heading_font, formData.branding?.body_font]);

  // Cleanup the dynamic font link on unmount only
  useEffect(() => {
    return () => { document.getElementById('settings-preview-google-fonts')?.remove(); };
  }, []);

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
    { id: 'checkout', label: 'Checkout', icon: <ShoppingCart size={20} /> },
    { id: 'tax', label: 'Tax', icon: <Receipt size={20} /> },
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

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Invalid file type. Please upload JPG, PNG, GIF, WebP, or SVG images.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File is too large. Maximum size is 5MB.');
      return;
    }

    setLogoUploading(true);
    setLogoError(null);

    try {
      // Get file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `branding/logo-${Date.now()}.${ext}`;

      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      // Update form data
      updateField('branding', 'logo_url', urlData.publicUrl);

      // Save to config_settings immediately
      await bulkUpdate('branding', {
        logo_url: { value: urlData.publicUrl, dataType: 'string' },
      });

      setSaveMessage('Logo uploaded!');
      setTimeout(() => setSaveMessage(null), 3000);
      refetch();
    } catch (err: any) {
      const message = err?.message || 'Failed to upload logo';
      if (message.includes('bucket') && message.includes('not found')) {
        setLogoError('Storage bucket not configured. Please contact admin.');
      } else if (message.includes('Payload too large') || message.includes('file size')) {
        setLogoError('Image file is too large. Maximum size is 5MB.');
      } else {
        setLogoError(message);
      }
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  }, [updateField, bulkUpdate, refetch]);

  const handleLogoDelete = useCallback(async () => {
    setLogoError(null);

    try {
      // Clear the logo URL
      updateField('branding', 'logo_url', '');

      // Save to config_settings
      await bulkUpdate('branding', {
        logo_url: { value: '', dataType: 'string' },
      });

      setSaveMessage('Logo removed!');
      setTimeout(() => setSaveMessage(null), 3000);
      refetch();
    } catch (err: any) {
      setLogoError(err?.message || 'Failed to remove logo');
    }
  }, [updateField, bulkUpdate, refetch]);

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
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <p className="text-sm text-slate-600">
            <strong>Ship-From Address</strong> has moved to{' '}
            <span className="text-emerald-600 font-medium">Shipping &rarr; Settings</span>
            , where you can also validate the address and configure fulfillment schedules.
          </p>
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
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">Logo</label>

        {/* Logo Error */}
        {logoError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{logoError}</p>
          </div>
        )}

        {/* Current Logo Preview */}
        {formData.branding?.logo_url ? (
          <div className="flex items-start gap-4">
            <div className="relative group">
              <div className="w-32 h-32 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                <img
                  src={formData.branding.logo_url}
                  alt="Current logo"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).alt = 'Failed to load';
                  }}
                />
              </div>
              {/* Overlay with actions on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Replace logo"
                >
                  <Upload size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleLogoDelete}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Remove logo"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-2">Current logo</p>
              <p className="text-xs text-slate-400 break-all">{formData.branding.logo_url}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Replace
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleLogoDelete}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Upload Zone when no logo exists */
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
            onClick={() => logoInputRef.current?.click()}
          >
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              {logoUploading ? (
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload size={24} className="text-slate-400" />
              )}
            </div>
            <p className="text-slate-700 font-medium">Click to upload your logo</p>
            <p className="text-slate-400 text-sm mt-1">PNG, JPG, GIF, WebP, or SVG up to 5MB</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleLogoUpload}
          className="hidden"
          disabled={logoUploading}
        />

        {/* Upload loading indicator (shown when replacing) */}
        {logoUploading && formData.branding?.logo_url && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        )}

        <p className="text-xs text-slate-500">Upload your brand logo (recommended size: 200x200px or larger)</p>
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
        <label className="block text-sm font-medium text-slate-700">Secondary Brand Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={formData.branding?.secondary_brand_color || '#047857'}
            onChange={(e) => updateField('branding', 'secondary_brand_color', e.target.value)}
            className="w-16 h-12 rounded-xl border border-slate-200 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={formData.branding?.secondary_brand_color || '#047857'}
            onChange={(e) => updateField('branding', 'secondary_brand_color', e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="#047857"
          />
        </div>
        <p className="text-xs text-slate-500">Used for hover states, accents, and secondary buttons</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Website Background Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={formData.branding?.background_color || '#fafafa'}
            onChange={(e) => updateField('branding', 'background_color', e.target.value)}
            className="w-16 h-12 rounded-xl border border-slate-200 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={formData.branding?.background_color || '#fafafa'}
            onChange={(e) => updateField('branding', 'background_color', e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="#fafafa"
          />
        </div>
        <p className="text-xs text-slate-500">Background color for the main website pages</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Secondary Background Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={formData.branding?.secondary_background_color || '#ffffff'}
            onChange={(e) => updateField('branding', 'secondary_background_color', e.target.value)}
            className="w-16 h-12 rounded-xl border border-slate-200 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={formData.branding?.secondary_background_color || '#ffffff'}
            onChange={(e) => updateField('branding', 'secondary_background_color', e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="#ffffff"
          />
        </div>
        <p className="text-xs text-slate-500">Used for alternating sections (hero, categories, etc.) to create visual contrast</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Typography</h3>
        <p className="text-sm text-slate-500 mb-6">Choose fonts for headings and body text. Fonts are loaded from Google Fonts.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Heading Font</label>
            <select
              value={formData.branding?.heading_font || 'Plus Jakarta Sans'}
              onChange={(e) => updateField('branding', 'heading_font', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="Plus Jakarta Sans">Plus Jakarta Sans (Default)</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Poppins">Poppins</option>
              <option value="Raleway">Raleway</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Lato">Lato</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Oswald">Oswald</option>
              <option value="Merriweather">Merriweather</option>
              <option value="Nunito">Nunito</option>
              <option value="Space Grotesk">Space Grotesk</option>
            </select>
            <p className="text-xs text-slate-500">Used for h1, h2, h3, h4, and .font-heading elements</p>
            <div className="space-y-1 mt-2">
              <label className="block text-sm font-medium text-slate-700">Size (px)</label>
              <select
                value={formData.branding?.heading_font_size ?? 28}
                onChange={(e) => updateField('branding', 'heading_font_size', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>{size}px{size === 28 ? ' (Default)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <p className="text-sm text-slate-500 mb-1">Preview:</p>
              <p key={`heading-${formData.branding?.heading_font}-${fontLoadKey}`} className="font-bold text-slate-800" style={{ fontFamily: `'${formData.branding?.heading_font || 'Plus Jakarta Sans'}', sans-serif`, fontSize: `${formData.branding?.heading_font_size ?? 28}px` }}>
                The Quick Brown Fox
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Body Font</label>
            <select
              value={formData.branding?.body_font || 'Inter'}
              onChange={(e) => updateField('branding', 'body_font', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="Inter">Inter (Default)</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Roboto">Roboto</option>
              <option value="Lato">Lato</option>
              <option value="Poppins">Poppins</option>
              <option value="Nunito">Nunito</option>
              <option value="Source Sans Pro">Source Sans Pro</option>
              <option value="Raleway">Raleway</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Space Grotesk">Space Grotesk</option>
            </select>
            <p className="text-xs text-slate-500">Used for body text, paragraphs, and general content</p>
            <div className="space-y-1 mt-2">
              <label className="block text-sm font-medium text-slate-700">Size (px)</label>
              <select
                value={formData.branding?.body_font_size ?? 16}
                onChange={(e) => updateField('branding', 'body_font_size', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>{size}px{size === 16 ? ' (Default)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <p className="text-sm text-slate-500 mb-1">Preview:</p>
              <p key={`body-${formData.branding?.body_font}-${fontLoadKey}`} className="text-slate-800" style={{ fontFamily: `'${formData.branding?.body_font || 'Inter'}', sans-serif`, fontSize: `${formData.branding?.body_font_size ?? 16}px` }}>
                Fresh seedlings delivered to your doorstep every week.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-1">Site-Wide Announcement Bar</h3>
        <p className="text-sm text-slate-500 mb-4">Display a dismissible banner at the top of every page. Great for promotions, shipping deadlines, or important notices.</p>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <button
              onClick={() => updateField('branding', 'announcement_bar_enabled', !formData.branding?.announcement_bar_enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                formData.branding?.announcement_bar_enabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                  formData.branding?.announcement_bar_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div>
              <h4 className="text-slate-800 font-medium">Enable Announcement Bar</h4>
              <p className="text-sm text-slate-500">Shows at the top of all pages (visitors can dismiss it)</p>
            </div>
          </div>

          <AnimatePresence>
            {formData.branding?.announcement_bar_enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-slate-700">Announcement Message</label>
                <input
                  type="text"
                  value={formData.branding?.announcement_bar_text || ''}
                  onChange={(e) => updateField('branding', 'announcement_bar_text', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Free shipping on orders over $50!"
                />
                <p className="text-xs text-slate-500">This text appears in the green bar at the very top of your website</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Social Media Links</h3>
        <p className="text-sm text-slate-500 mb-6">Add your social media URLs to display icons in the website footer. Leave blank to hide.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Facebook URL</label>
            <input
              type="url"
              value={formData.branding?.social_facebook || ''}
              onChange={(e) => updateField('branding', 'social_facebook', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Instagram URL</label>
            <input
              type="url"
              value={formData.branding?.social_instagram || ''}
              onChange={(e) => updateField('branding', 'social_instagram', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="https://instagram.com/yourpage"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Twitter/X URL</label>
            <input
              type="url"
              value={formData.branding?.social_twitter || ''}
              onChange={(e) => updateField('branding', 'social_twitter', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="https://twitter.com/yourpage"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">TikTok URL</label>
            <input
              type="url"
              value={formData.branding?.social_tiktok || ''}
              onChange={(e) => updateField('branding', 'social_tiktok', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="https://tiktok.com/@yourpage"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">YouTube URL</label>
            <input
              type="url"
              value={formData.branding?.social_youtube || ''}
              onChange={(e) => updateField('branding', 'social_youtube', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="https://youtube.com/@yourchannel"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTaxTab = () => {
    // Parse nexus_states for display — stored as JSON array, show as comma-separated
    const nexusStatesRaw = formData.tax?.nexus_states;
    const nexusStatesStr = Array.isArray(nexusStatesRaw)
      ? nexusStatesRaw.join(', ')
      : typeof nexusStatesRaw === 'string'
        ? nexusStatesRaw
        : 'GA';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div>
            <h4 className="text-slate-800 font-medium">Collect Sales Tax</h4>
            <p className="text-sm text-slate-500">Enable tax collection on orders shipped to nexus states</p>
          </div>
          <button
            onClick={() => updateField('tax', 'tax_enabled', !formData.tax?.tax_enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.tax?.tax_enabled ?? true ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                formData.tax?.tax_enabled ?? true ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Tax Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={((formData.tax?.default_tax_rate ?? 0.07) * 100).toFixed(2)}
              onChange={(e) => updateField('tax', 'default_tax_rate', parseFloat(e.target.value) / 100 || 0)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-slate-500">Enter as percentage (e.g. 7 for 7%). Stored as decimal internally.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Nexus States</label>
            <input
              type="text"
              value={nexusStatesStr}
              onChange={(e) => {
                const states = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                updateField('tax', 'nexus_states', states);
              }}
              placeholder="GA, SC"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-slate-500">Comma-separated state abbreviations where you collect tax (e.g. GA)</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Tax Line Label</label>
            <input
              type="text"
              value={formData.tax?.tax_label ?? 'Sales Tax'}
              onChange={(e) => updateField('tax', 'tax_label', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="text-xs text-slate-500">Label shown to customers on the tax line item</p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/60">
          <p className="text-sm text-amber-800">
            <strong>Tax-exempt customers:</strong> Mark individual customers as tax-exempt from their detail page in the Customers section. Tax-exempt customers will not be charged tax regardless of their shipping state.
          </p>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'business':
        return renderBusinessTab();
      case 'checkout':
        return renderCheckoutTab();
      case 'tax':
        return renderTaxTab();
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
