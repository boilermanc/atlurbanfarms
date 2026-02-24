import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings, ConfigSetting } from '../hooks/useSettings';
import { supabase } from '../../lib/supabase';
import { Building2, ShoppingCart, Package, Bell, Paintbrush, Save, Upload, Trash2, Receipt, ChevronDown } from 'lucide-react';

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
    // Brand Identity
    logo_url: { value: '', dataType: 'string' },
    social_facebook: { value: '', dataType: 'string' },
    social_instagram: { value: '', dataType: 'string' },
    social_twitter: { value: '', dataType: 'string' },
    social_youtube: { value: '', dataType: 'string' },
    social_tiktok: { value: '', dataType: 'string' },
    // Brand Colors
    primary_brand_color: { value: '#10b981', dataType: 'string' },
    secondary_brand_color: { value: '#047857', dataType: 'string' },
    color_brand_light: { value: '#ecfdf5', dataType: 'string' },
    // Text Colors
    color_text_primary: { value: '#111827', dataType: 'string' },
    color_text_secondary: { value: '#6b7280', dataType: 'string' },
    color_text_muted: { value: '#9ca3af', dataType: 'string' },
    // Background Colors
    background_color: { value: '#fafafa', dataType: 'string' },
    secondary_background_color: { value: '#ffffff', dataType: 'string' },
    color_bg_muted: { value: '#f9fafb', dataType: 'string' },
    color_bg_dark: { value: '#111827', dataType: 'string' },
    // Border Colors
    color_border_default: { value: '#e5e7eb', dataType: 'string' },
    color_border_light: { value: '#f3f4f6', dataType: 'string' },
    // Status Colors
    color_success: { value: '#10b981', dataType: 'string' },
    color_success_light: { value: '#ecfdf5', dataType: 'string' },
    color_error: { value: '#ef4444', dataType: 'string' },
    color_error_light: { value: '#fef2f2', dataType: 'string' },
    color_warning: { value: '#f59e0b', dataType: 'string' },
    color_warning_light: { value: '#fffbeb', dataType: 'string' },
    color_info: { value: '#3b82f6', dataType: 'string' },
    color_info_light: { value: '#eff6ff', dataType: 'string' },
    // Accent Colors
    color_sale: { value: '#ef4444', dataType: 'string' },
    color_link: { value: '#10b981', dataType: 'string' },
    // Typography
    heading_font: { value: 'Plus Jakarta Sans', dataType: 'string' },
    heading_font_size: { value: 28, dataType: 'number' },
    body_font: { value: 'Inter', dataType: 'string' },
    body_font_size: { value: 16, dataType: 'number' },
    // Component Styles
    radius_button: { value: 16, dataType: 'number' },
    radius_card: { value: 24, dataType: 'number' },
    radius_input: { value: 12, dataType: 'number' },
    shadow_style: { value: 'medium', dataType: 'string' },
    // Announcement Bar
    announcement_bar_enabled: { value: false, dataType: 'boolean' },
    announcement_bar_text: { value: '', dataType: 'string' },
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
    { id: 'branding', label: 'Design', icon: <Paintbrush size={20} /> },
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

  // Collapsible section state for Design tab
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identity: true,
    colors: true,
    typography: true,
    components: false,
    announcement: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Reusable color field component
  const ColorField = ({ label, settingKey, defaultValue, description }: { label: string; settingKey: string; defaultValue: string; description?: string }) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={formData.branding?.[settingKey] || defaultValue}
          onChange={(e) => updateField('branding', settingKey, e.target.value)}
          className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer bg-transparent p-0.5"
        />
        <input
          type="text"
          value={formData.branding?.[settingKey] || defaultValue}
          onChange={(e) => updateField('branding', settingKey, e.target.value)}
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          placeholder={defaultValue}
        />
      </div>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );

  // Section header component
  const SectionHeader = ({ title, description, section }: { title: string; description: string; section: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 text-left"
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <ChevronDown
        size={20}
        className={`text-slate-400 transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}
      />
    </button>
  );

  const renderDesignTab = () => (
    <div className="space-y-2">
      {/* ── Brand Identity ── */}
      <div className="border-b border-slate-200">
        <SectionHeader title="Brand Identity" description="Logo and social media links" section="identity" />
        {expandedSections.identity && (
          <div className="pb-6 space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">Logo</label>
              {logoError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{logoError}</p>
                </div>
              )}
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" title="Replace logo">
                        <Upload size={18} />
                      </button>
                      <button type="button" onClick={handleLogoDelete} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" title="Remove logo">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 mb-2">Current logo</p>
                    <p className="text-xs text-slate-400 break-all">{formData.branding.logo_url}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Replace</button>
                      <span className="text-slate-300">|</span>
                      <button type="button" onClick={handleLogoDelete} className="text-sm text-red-600 hover:text-red-700 font-medium">Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
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
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" disabled={logoUploading} />
              {logoUploading && formData.branding?.logo_url && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </div>
              )}
              <p className="text-xs text-slate-500">Upload your brand logo (recommended size: 200x200px or larger)</p>
            </div>

            {/* Social Media */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Social Media Links</h4>
              <p className="text-xs text-slate-500 mb-4">Add your social media URLs to display icons in the website footer. Leave blank to hide.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
                  { key: 'social_instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourpage' },
                  { key: 'social_twitter', label: 'Twitter/X', placeholder: 'https://twitter.com/yourpage' },
                  { key: 'social_tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourpage' },
                  { key: 'social_youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600">{label}</label>
                    <input
                      type="url"
                      value={formData.branding?.[key] || ''}
                      onChange={(e) => updateField('branding', key, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Color Palette ── */}
      <div className="border-b border-slate-200">
        <SectionHeader title="Color Palette" description="All colors used across the storefront" section="colors" />
        {expandedSections.colors && (
          <div className="pb-6 space-y-8">
            {/* Brand Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Brand Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ColorField label="Primary" settingKey="primary_brand_color" defaultValue="#10b981" description="Main CTA buttons, links, brand accent" />
                <ColorField label="Secondary" settingKey="secondary_brand_color" defaultValue="#047857" description="Hover states, secondary accents" />
                <ColorField label="Light Tint" settingKey="color_brand_light" defaultValue="#ecfdf5" description="Badges, highlight backgrounds" />
              </div>
            </div>

            {/* Text Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Text Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ColorField label="Primary Text" settingKey="color_text_primary" defaultValue="#111827" description="Headings, strong text" />
                <ColorField label="Secondary Text" settingKey="color_text_secondary" defaultValue="#6b7280" description="Body text, descriptions" />
                <ColorField label="Muted Text" settingKey="color_text_muted" defaultValue="#9ca3af" description="Placeholders, hints" />
              </div>
            </div>

            {/* Background Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Background Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField label="Page Background" settingKey="background_color" defaultValue="#fafafa" description="Main site background" />
                <ColorField label="Surface (Cards)" settingKey="secondary_background_color" defaultValue="#ffffff" description="Cards, panels, modals" />
                <ColorField label="Muted Background" settingKey="color_bg_muted" defaultValue="#f9fafb" description="Alternating sections, hover states" />
                <ColorField label="Dark Background" settingKey="color_bg_dark" defaultValue="#111827" description="Footer, dark sections" />
              </div>
            </div>

            {/* Border Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Border Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField label="Default Border" settingKey="color_border_default" defaultValue="#e5e7eb" description="Input fields, card borders" />
                <ColorField label="Light Border" settingKey="color_border_light" defaultValue="#f3f4f6" description="Subtle dividers, separators" />
              </div>
            </div>

            {/* Status Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Status Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField label="Success" settingKey="color_success" defaultValue="#10b981" description="Success messages, validation" />
                <ColorField label="Success Background" settingKey="color_success_light" defaultValue="#ecfdf5" />
                <ColorField label="Error" settingKey="color_error" defaultValue="#ef4444" description="Error messages, alerts" />
                <ColorField label="Error Background" settingKey="color_error_light" defaultValue="#fef2f2" />
                <ColorField label="Warning" settingKey="color_warning" defaultValue="#f59e0b" description="Warnings, cautions" />
                <ColorField label="Warning Background" settingKey="color_warning_light" defaultValue="#fffbeb" />
                <ColorField label="Info" settingKey="color_info" defaultValue="#3b82f6" description="Information, tips" />
                <ColorField label="Info Background" settingKey="color_info_light" defaultValue="#eff6ff" />
              </div>
            </div>

            {/* Accent Colors */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Accent Colors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField label="Sale / Promotion" settingKey="color_sale" defaultValue="#ef4444" description="Sale badges, discounted prices" />
                <ColorField label="Link Color" settingKey="color_link" defaultValue="#10b981" description="Hyperlinks in body text" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Typography ── */}
      <div className="border-b border-slate-200">
        <SectionHeader title="Typography" description="Fonts and text sizes" section="typography" />
        {expandedSections.typography && (
          <div className="pb-6">
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
        )}
      </div>

      {/* ── Component Styles ── */}
      <div className="border-b border-slate-200">
        <SectionHeader title="Component Styles" description="Border radius, shadows, and shape" section="components" />
        {expandedSections.components && (
          <div className="pb-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'radius_button', label: 'Button Radius', defaultVal: 16 },
                { key: 'radius_card', label: 'Card Radius', defaultVal: 24 },
                { key: 'radius_input', label: 'Input Radius', defaultVal: 12 },
              ].map(({ key, label, defaultVal }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">{label}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="32"
                      value={formData.branding?.[key] ?? defaultVal}
                      onChange={(e) => updateField('branding', key, parseInt(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="text-sm font-mono text-slate-600 w-12 text-right">{formData.branding?.[key] ?? defaultVal}px</span>
                  </div>
                  {/* Preview */}
                  <div className="flex items-center gap-3 mt-1">
                    <div
                      className="w-full h-10 bg-slate-100 border border-slate-200"
                      style={{ borderRadius: `${formData.branding?.[key] ?? defaultVal}px` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Shadow Intensity</label>
              <select
                value={formData.branding?.shadow_style || 'medium'}
                onChange={(e) => updateField('branding', 'shadow_style', e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="medium">Medium (Default)</option>
                <option value="heavy">Heavy</option>
              </select>
              {/* Shadow preview */}
              <div className="flex gap-4 mt-3">
                <div
                  className="flex-1 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-sm text-slate-500"
                  style={{
                    boxShadow: formData.branding?.shadow_style === 'none' ? 'none'
                      : formData.branding?.shadow_style === 'light' ? '0 1px 3px rgba(0,0,0,0.08)'
                      : formData.branding?.shadow_style === 'heavy' ? '0 10px 25px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08)'
                      : '0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)'
                  }}
                >
                  Shadow Preview
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Announcement Bar ── */}
      <div>
        <SectionHeader title="Announcement Bar" description="Site-wide banner for promotions and notices" section="announcement" />
        {expandedSections.announcement && (
          <div className="pb-6 space-y-4">
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
                  <p className="text-xs text-slate-500">This text appears in the banner bar at the very top of your website</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
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
        return renderDesignTab();
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
