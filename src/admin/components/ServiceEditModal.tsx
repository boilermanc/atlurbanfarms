import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShippingService } from '../pages/ShippingServicesPage';
import { X } from 'lucide-react';

interface ServiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Partial<ShippingService> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  service: ShippingService | null;
}

const CARRIERS = [
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
] as const;

const MARKUP_TYPES = [
  { value: 'none', label: 'No Markup' },
  { value: 'flat', label: 'Flat Amount ($)' },
  { value: 'percentage', label: 'Percentage (%)' },
] as const;

interface FormData {
  id?: string;
  carrier: 'UPS' | 'FedEx' | 'USPS';
  service_code: string;
  display_name: string;
  description: string;
  min_transit_days: number;
  max_transit_days: number;
  base_price: number;
  markup_type: 'none' | 'flat' | 'percentage';
  markup_value: number;
  free_shipping_threshold: number | null;
  is_enabled: boolean;
  is_default: boolean;
}

const ServiceEditModal: React.FC<ServiceEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  service,
}) => {
  const [formData, setFormData] = useState<FormData>({
    carrier: 'USPS',
    service_code: '',
    display_name: '',
    description: '',
    min_transit_days: 1,
    max_transit_days: 3,
    base_price: 0,
    markup_type: 'none',
    markup_value: 0,
    free_shipping_threshold: null,
    is_enabled: true,
    is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (service) {
      setFormData({
        id: service.id,
        carrier: service.carrier,
        service_code: service.service_code,
        display_name: service.display_name,
        description: service.description || '',
        min_transit_days: service.min_transit_days,
        max_transit_days: service.max_transit_days,
        base_price: service.base_price,
        markup_type: service.markup_type,
        markup_value: service.markup_value,
        free_shipping_threshold: service.free_shipping_threshold,
        is_enabled: service.is_enabled,
        is_default: service.is_default,
      });
    } else {
      setFormData({
        carrier: 'USPS',
        service_code: '',
        display_name: '',
        description: '',
        min_transit_days: 1,
        max_transit_days: 3,
        base_price: 0,
        markup_type: 'none',
        markup_value: 0,
        free_shipping_threshold: null,
        is_enabled: true,
        is_default: false,
      });
    }
    setErrors({});
  }, [service, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.service_code.trim()) {
      newErrors.service_code = 'Service code is required';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }

    if (formData.min_transit_days < 1) {
      newErrors.min_transit_days = 'Minimum transit days must be at least 1';
    }

    if (formData.max_transit_days < formData.min_transit_days) {
      newErrors.max_transit_days = 'Maximum must be greater than or equal to minimum';
    }

    if (formData.base_price < 0) {
      newErrors.base_price = 'Base price cannot be negative';
    }

    if (formData.markup_type !== 'none' && formData.markup_value < 0) {
      newErrors.markup_value = 'Markup value cannot be negative';
    }

    if (formData.free_shipping_threshold !== null && formData.free_shipping_threshold < 0) {
      newErrors.free_shipping_threshold = 'Threshold cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      await onSave({
        ...formData,
        description: formData.description || null,
        free_shipping_threshold: formData.free_shipping_threshold || null,
      });
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!service?.id) return;

    setDeleting(true);
    try {
      await onDelete(service.id);
      onClose();
    } catch (error) {
      console.error('Error deleting service:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleNumberChange = (
    field: keyof FormData,
    value: string,
    allowDecimal: boolean = false
  ) => {
    if (value === '') {
      setFormData(prev => ({ ...prev, [field]: allowDecimal ? 0 : 0 }));
      return;
    }

    const parsed = allowDecimal ? parseFloat(value) : parseInt(value, 10);
    if (!isNaN(parsed)) {
      setFormData(prev => ({ ...prev, [field]: parsed }));
    }
  };

  const handleThresholdChange = (value: string) => {
    if (value === '') {
      setFormData(prev => ({ ...prev, free_shipping_threshold: null }));
      return;
    }

    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setFormData(prev => ({ ...prev, free_shipping_threshold: parsed }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold text-slate-800">
                {service ? 'Edit Shipping Service' : 'Add Shipping Service'}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Carrier & Service Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Carrier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.carrier}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      carrier: e.target.value as 'UPS' | 'FedEx' | 'USPS'
                    }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {CARRIERS.map(carrier => (
                      <option key={carrier.value} value={carrier.value}>
                        {carrier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Service Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.service_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_code: e.target.value }))}
                    className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      errors.service_code ? 'border-red-400' : 'border-slate-200'
                    }`}
                    placeholder="e.g., PRIORITY_MAIL"
                  />
                  {errors.service_code && (
                    <p className="mt-1 text-sm text-red-500">{errors.service_code}</p>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    errors.display_name ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="e.g., Priority Mail"
                />
                {errors.display_name && (
                  <p className="mt-1 text-sm text-red-500">{errors.display_name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  placeholder="Optional description for customers..."
                />
              </div>

              {/* Transit Days */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Min Transit Days <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_transit_days}
                    onChange={(e) => handleNumberChange('min_transit_days', e.target.value)}
                    className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      errors.min_transit_days ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.min_transit_days && (
                    <p className="mt-1 text-sm text-red-500">{errors.min_transit_days}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Max Transit Days <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_transit_days}
                    onChange={(e) => handleNumberChange('max_transit_days', e.target.value)}
                    className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      errors.max_transit_days ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.max_transit_days && (
                    <p className="mt-1 text-sm text-red-500">{errors.max_transit_days}</p>
                  )}
                </div>
              </div>

              {/* Pricing Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                  Pricing
                </h3>

                {/* Base Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Base Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => handleNumberChange('base_price', e.target.value, true)}
                      className={`w-full pl-8 pr-4 py-3 bg-white border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        errors.base_price ? 'border-red-400' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  {errors.base_price && (
                    <p className="mt-1 text-sm text-red-500">{errors.base_price}</p>
                  )}
                </div>

                {/* Markup Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Markup Type
                    </label>
                    <select
                      value={formData.markup_type}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        markup_type: e.target.value as 'none' | 'flat' | 'percentage',
                        markup_value: e.target.value === 'none' ? 0 : prev.markup_value
                      }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {MARKUP_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Markup Value
                    </label>
                    <div className="relative">
                      {formData.markup_type === 'flat' && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      )}
                      {formData.markup_type === 'percentage' && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                      )}
                      <input
                        type="number"
                        min="0"
                        step={formData.markup_type === 'percentage' ? '1' : '0.01'}
                        value={formData.markup_value}
                        onChange={(e) => handleNumberChange('markup_value', e.target.value, true)}
                        disabled={formData.markup_type === 'none'}
                        className={`w-full py-3 bg-white border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.markup_type === 'flat' ? 'pl-8 pr-4' :
                          formData.markup_type === 'percentage' ? 'pl-4 pr-8' : 'px-4'
                        } ${errors.markup_value ? 'border-red-400' : 'border-slate-200'}`}
                      />
                    </div>
                    {errors.markup_value && (
                      <p className="mt-1 text-sm text-red-500">{errors.markup_value}</p>
                    )}
                  </div>
                </div>

                {/* Free Shipping Threshold */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Free Shipping Threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.free_shipping_threshold ?? ''}
                      onChange={(e) => handleThresholdChange(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        errors.free_shipping_threshold ? 'border-red-400' : 'border-slate-200'
                      }`}
                      placeholder="Leave empty for no free shipping"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Orders above this amount qualify for free shipping with this service
                  </p>
                  {errors.free_shipping_threshold && (
                    <p className="mt-1 text-sm text-red-500">{errors.free_shipping_threshold}</p>
                  )}
                </div>
              </div>

              {/* Status Checkboxes */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_enabled"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="is_enabled" className="text-sm font-medium text-slate-600">
                    Enabled (available for customers to select)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="is_default" className="text-sm font-medium text-slate-600">
                    Set as default service (only one can be default)
                  </label>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div>
                  {service && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting || saving}
                      className="px-4 py-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? 'Deleting...' : 'Delete Service'}
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : service ? 'Update Service' : 'Add Service'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ServiceEditModal;
