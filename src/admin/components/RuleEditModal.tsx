import React, { useState, useEffect } from 'react';
import { ShippingZoneRule, RuleConditions, RuleActions } from '../pages/ShippingZonesPage';

interface RuleEditModalProps {
  rule: ShippingZoneRule | null;
  onSave: (rule: ShippingZoneRule) => void;
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

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

const SHIPPING_SERVICES = [
  { value: 'standard', label: 'Standard Shipping' },
  { value: 'express', label: 'Express Shipping' },
  { value: 'overnight', label: 'Overnight Shipping' },
  { value: 'priority', label: 'Priority Mail' },
  { value: 'cold_pack', label: 'Cold Pack Shipping' }
];

const RULE_TYPES = [
  { value: 'seasonal_block', label: 'Seasonal Block', description: 'Block shipping during specific months' },
  { value: 'service_requirement', label: 'Service Requirement', description: 'Require specific shipping services' },
  { value: 'transit_limit', label: 'Transit Limit', description: 'Restrict based on transit time' },
  { value: 'surcharge', label: 'Surcharge', description: 'Add extra fees for specific conditions' }
];

const DEFAULT_RULE: ShippingZoneRule = {
  id: 'new',
  name: '',
  rule_type: 'seasonal_block',
  priority: 100,
  conditions: {},
  actions: {},
  effective_start: null,
  effective_end: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const RuleEditModal: React.FC<RuleEditModalProps> = ({ rule, onSave, onClose }) => {
  const [formData, setFormData] = useState<ShippingZoneRule>(rule || DEFAULT_RULE);
  const [conditions, setConditions] = useState<RuleConditions>(rule?.conditions || {});
  const [actions, setActions] = useState<RuleActions>(rule?.actions || {});
  const [saving, setSaving] = useState(false);
  const [showStateSelector, setShowStateSelector] = useState(false);

  const isNew = !rule || rule.id === 'new';

  useEffect(() => {
    if (rule) {
      setFormData(rule);
      setConditions(rule.conditions || {});
      setActions(rule.actions || {});
    }
  }, [rule]);

  const handleConditionChange = <K extends keyof RuleConditions>(
    key: K,
    value: RuleConditions[K]
  ) => {
    setConditions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleActionChange = <K extends keyof RuleActions>(
    key: K,
    value: RuleActions[K]
  ) => {
    setActions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleStateToggle = (stateCode: string) => {
    const currentStates = conditions.states || [];
    const newStates = currentStates.includes(stateCode)
      ? currentStates.filter(s => s !== stateCode)
      : [...currentStates, stateCode].sort();
    handleConditionChange('states', newStates.length > 0 ? newStates : undefined);
  };

  const handleMonthToggle = (month: number) => {
    const currentMonths = conditions.months || [];
    const newMonths = currentMonths.includes(month)
      ? currentMonths.filter(m => m !== month)
      : [...currentMonths, month].sort((a, b) => a - b);
    handleConditionChange('months', newMonths.length > 0 ? newMonths : undefined);
  };

  const handleServiceToggle = (service: string) => {
    const currentServices = actions.required_services || [];
    const newServices = currentServices.includes(service)
      ? currentServices.filter(s => s !== service)
      : [...currentServices, service];
    handleActionChange('required_services', newServices.length > 0 ? newServices : undefined);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a rule name');
      return;
    }

    setSaving(true);
    try {
      const ruleToSave: ShippingZoneRule = {
        ...formData,
        conditions,
        actions,
        updated_at: new Date().toISOString()
      };
      await onSave(ruleToSave);
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
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isNew ? 'Add Shipping Rule' : 'Edit Shipping Rule'}
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Configure conditions and actions for this rule
            </p>
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
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Rule Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rule Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Heat Block - West Coast"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            {/* Rule Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rule Type
              </label>
              <select
                value={formData.rule_type}
                onChange={(e) => setFormData(prev => ({ ...prev, rule_type: e.target.value as ShippingZoneRule['rule_type'] }))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                {RULE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                {RULE_TYPES.find(t => t.value === formData.rule_type)?.description}
              </p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Priority
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Lower numbers = higher priority (evaluated first)
              </p>
            </div>
          </div>

          {/* Conditions Section */}
          <div className="space-y-4 p-5 bg-slate-700/30 rounded-xl border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Conditions (When to Apply)
            </h3>

            {/* States Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Apply to States
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStateSelector(!showStateSelector)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-left text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 flex items-center justify-between"
                >
                  <span className={conditions.states?.length ? 'text-white' : 'text-slate-500'}>
                    {conditions.states?.length
                      ? `${conditions.states.length} state${conditions.states.length > 1 ? 's' : ''} selected`
                      : 'All states (no filter)'}
                  </span>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${showStateSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showStateSelector && (
                  <div className="absolute z-10 mt-2 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-600 sticky top-0 bg-slate-700">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleConditionChange('states', US_STATES.map(s => s.code))}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConditionChange('states', undefined)}
                          className="text-xs text-slate-400 hover:text-slate-300"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="p-2 grid grid-cols-3 gap-1">
                      {US_STATES.map(state => (
                        <button
                          key={state.code}
                          type="button"
                          onClick={() => handleStateToggle(state.code)}
                          className={`px-2 py-1.5 rounded text-xs font-medium text-left transition-all ${
                            conditions.states?.includes(state.code)
                              ? 'bg-emerald-500/30 text-emerald-400'
                              : 'text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {state.code} - {state.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {conditions.states && conditions.states.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {conditions.states.map(code => (
                    <span
                      key={code}
                      className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs flex items-center gap-1"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => handleStateToggle(code)}
                        className="text-slate-400 hover:text-white"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Months Multi-Select (for seasonal rules) */}
            {(formData.rule_type === 'seasonal_block' || formData.rule_type === 'surcharge') && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  During Months
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {MONTHS.map(month => (
                    <button
                      key={month.value}
                      type="button"
                      onClick={() => handleMonthToggle(month.value)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        conditions.months?.includes(month.value)
                          ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                          : 'bg-slate-600/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {month.label.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Max Transit Days (for transit limit rules) */}
            {formData.rule_type === 'transit_limit' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  When Transit Exceeds (Days)
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
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="space-y-4 p-5 bg-slate-700/30 rounded-xl border border-slate-600">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Actions (What to Do)
            </h3>

            {/* Block Checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="block-action"
                checked={actions.block || false}
                onChange={(e) => handleActionChange('block', e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              <label htmlFor="block-action" className="flex-1">
                <span className="text-white font-medium">Block Shipping</span>
                <p className="text-xs text-slate-500 mt-0.5">Prevent orders from being shipped when conditions are met</p>
              </label>
            </div>

            {/* Block Message (shown when block is enabled) */}
            {actions.block && (
              <div className="ml-8">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Block Message
                </label>
                <textarea
                  value={actions.block_message || ''}
                  onChange={(e) => handleActionChange('block_message', e.target.value || undefined)}
                  placeholder="Message shown to customer when blocked..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                />
              </div>
            )}

            {/* Required Services */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Required Shipping Services
              </label>
              <div className="flex flex-wrap gap-2">
                {SHIPPING_SERVICES.map(service => (
                  <button
                    key={service.value}
                    type="button"
                    onClick={() => handleServiceToggle(service.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      actions.required_services?.includes(service.value)
                        ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                        : 'bg-slate-600/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {service.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                When conditions are met, only these services will be available
              </p>
            </div>

            {/* Surcharge */}
            {formData.rule_type === 'surcharge' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Surcharge Amount ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={actions.surcharge_amount || ''}
                      onChange={(e) => handleActionChange('surcharge_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Surcharge Percent (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={actions.surcharge_percent || ''}
                      onChange={(e) => handleActionChange('surcharge_percent', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="0"
                      className="w-full px-4 pr-8 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Effective Start Date
              </label>
              <input
                type="date"
                value={formData.effective_start?.split('T')[0] || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, effective_start: e.target.value ? `${e.target.value}T00:00:00Z` : null }))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">Leave empty for no start limit</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Effective End Date
              </label>
              <input
                type="date"
                value={formData.effective_end?.split('T')[0] || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, effective_end: e.target.value ? `${e.target.value}T23:59:59Z` : null }))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">Leave empty for no end limit</p>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-xl border border-slate-600">
            <input
              type="checkbox"
              id="is-active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <label htmlFor="is-active" className="flex-1">
              <span className="text-white font-medium">Rule is Active</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Inactive rules are saved but not applied during checkout
              </p>
            </label>
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
                {isNew ? 'Create Rule' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleEditModal;
