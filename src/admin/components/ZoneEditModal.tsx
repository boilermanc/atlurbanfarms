import React, { useState, useEffect } from 'react';
import { ShippingZone, ZoneConditions } from '../pages/ShippingZonesPage';

interface ZoneEditModalProps {
  zone: ShippingZone;
  onSave: (zone: ShippingZone) => void;
  onClose: () => void;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const SHIPPING_SERVICES = [
  { value: 'standard', label: 'Standard Shipping' },
  { value: 'express', label: 'Express Shipping' },
  { value: 'overnight', label: 'Overnight Shipping' },
  { value: 'priority', label: 'Priority Mail' },
  { value: 'cold_pack', label: 'Cold Pack Shipping' }
];

const ZoneEditModal: React.FC<ZoneEditModalProps> = ({ zone, onSave, onClose }) => {
  const [formData, setFormData] = useState<ShippingZone>(zone);
  const [conditions, setConditions] = useState<ZoneConditions>(zone.conditions || {});
  const [showConditionsEditor, setShowConditionsEditor] = useState(zone.status === 'conditional');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShowConditionsEditor(formData.status === 'conditional');
  }, [formData.status]);

  const handleStatusChange = (status: 'allowed' | 'blocked' | 'conditional') => {
    setFormData(prev => ({ ...prev, status }));
    if (status !== 'conditional') {
      setConditions({});
    }
  };

  const handleConditionChange = <K extends keyof ZoneConditions>(
    key: K,
    value: ZoneConditions[K]
  ) => {
    setConditions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleMonthToggle = (month: number) => {
    const currentMonths = conditions.blocked_months || [];
    const newMonths = currentMonths.includes(month)
      ? currentMonths.filter(m => m !== month)
      : [...currentMonths, month].sort((a, b) => a - b);
    handleConditionChange('blocked_months', newMonths.length > 0 ? newMonths : undefined);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedZone: ShippingZone = {
        ...formData,
        conditions: formData.status === 'conditional' && Object.keys(conditions).length > 0
          ? conditions
          : null,
        updated_at: new Date().toISOString()
      };
      await onSave(updatedZone);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Shipping Zone</h2>
            <p className="text-slate-400 text-sm mt-0.5">Configure shipping for {zone.state_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* State Display */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
            <div className="px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-600 text-white">
              <span className="font-medium">{zone.state_name}</span>
              <span className="text-slate-400 ml-2">({zone.state_code})</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Status</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleStatusChange('allowed')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.status === 'allowed'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${formData.status === 'allowed' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  <span className="font-medium">Allowed</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('conditional')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.status === 'conditional'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${formData.status === 'conditional' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                  <span className="font-medium">Conditional</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('blocked')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.status === 'blocked'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${formData.status === 'blocked' ? 'bg-red-500' : 'bg-slate-500'}`} />
                  <span className="font-medium">Blocked</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditions (only shown for conditional status) */}
          {showConditionsEditor && (
            <div className="space-y-5 p-5 bg-slate-700/30 rounded-xl border border-slate-600">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Conditions
              </h3>

              {/* Required Service */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Required Shipping Service
                </label>
                <select
                  value={conditions.required_service || ''}
                  onChange={(e) => handleConditionChange('required_service', e.target.value || undefined)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                >
                  <option value="">No requirement</option>
                  {SHIPPING_SERVICES.map(service => (
                    <option key={service.value} value={service.value}>
                      {service.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  Only allow orders with this shipping service selected
                </p>
              </div>

              {/* Blocked Months */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Blocked Months
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS.map(month => (
                    <button
                      key={month.value}
                      type="button"
                      onClick={() => handleMonthToggle(month.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        conditions.blocked_months?.includes(month.value)
                          ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                          : 'bg-slate-600/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {month.label.substring(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Block shipping during selected months (e.g., hot summer months for live plants)
                </p>
              </div>

              {/* Max Transit Days */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Maximum Transit Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={conditions.max_transit_days || ''}
                  onChange={(e) => handleConditionChange('max_transit_days', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 3"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Only allow shipping if transit time is within this limit
                </p>
              </div>

              {/* Minimum Order Value */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Minimum Order Value
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={conditions.min_order_value || ''}
                    onChange={(e) => handleConditionChange('min_order_value', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Require a minimum order value to ship to this state
                </p>
              </div>
            </div>
          )}

          {/* Customer Message */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Customer-Facing Message
            </label>
            <textarea
              value={formData.customer_message || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_message: e.target.value || null }))}
              placeholder="Message shown to customers at checkout..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              This message will be displayed to customers when they select this state during checkout
            </p>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Internal Notes
            </label>
            <textarea
              value={formData.internal_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, internal_notes: e.target.value || null }))}
              placeholder="Notes for internal reference..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Only visible to admins, not shown to customers
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-800/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZoneEditModal;
