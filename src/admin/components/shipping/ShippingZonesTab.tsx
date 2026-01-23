import React, { useState, useEffect } from 'react';
import ZoneEditModal from '../ZoneEditModal';
import RuleEditModal from '../RuleEditModal';
import { supabase } from '../../../lib/supabase';

// Types
export interface ShippingZone {
  id: string;
  state_code: string;
  state_name: string;
  status: 'allowed' | 'blocked' | 'conditional';
  conditions: ZoneConditions | null;
  customer_message: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneConditions {
  required_service?: string;
  blocked_months?: number[];
  min_order_value?: number;
  max_transit_days?: number;
}

export interface ShippingZoneRule {
  id: string;
  name: string;
  rule_type: 'seasonal_block' | 'service_requirement' | 'transit_limit' | 'surcharge';
  priority: number;
  conditions: RuleConditions;
  actions: RuleActions;
  effective_start: string | null;
  effective_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleConditions {
  states?: string[];
  months?: number[];
  max_transit_days?: number;
  categories?: string[];
  min_order_value?: number;
}

export interface RuleActions {
  block?: boolean;
  block_message?: string;
  required_services?: string[];
  surcharge_amount?: number;
  surcharge_percent?: number;
}

// US States data
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

const ShippingZonesTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'zones' | 'rules'>('zones');
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [rules, setRules] = useState<ShippingZoneRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [editingRule, setEditingRule] = useState<ShippingZoneRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesResult, rulesResult] = await Promise.all([
        supabase.from('shipping_zones').select('*').order('state_name'),
        supabase.from('shipping_zone_rules').select('*').order('priority')
      ]);

      if (zonesResult.data) {
        setZones(zonesResult.data);
      } else {
        const defaultZones = US_STATES.map(state => ({
          id: state.code,
          state_code: state.code,
          state_name: state.name,
          status: 'allowed' as const,
          conditions: null,
          customer_message: null,
          internal_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        setZones(defaultZones);
      }

      if (rulesResult.data) {
        setRules(rulesResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZones(prev =>
      prev.includes(zoneId)
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleSelectAll = () => {
    if (selectedZones.length === zones.length) {
      setSelectedZones([]);
    } else {
      setSelectedZones(zones.map(z => z.id));
    }
  };

  const handleBulkStatusChange = async (status: 'allowed' | 'blocked' | 'conditional') => {
    if (selectedZones.length === 0) return;

    try {
      const { error } = await supabase
        .from('shipping_zones')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', selectedZones);

      if (!error) {
        setZones(prev => prev.map(zone =>
          selectedZones.includes(zone.id) ? { ...zone, status } : zone
        ));
        setSelectedZones([]);
      }
    } catch (error) {
      console.error('Error updating zones:', error);
    }
  };

  const handleZoneSave = async (updatedZone: ShippingZone) => {
    try {
      const { error } = await supabase
        .from('shipping_zones')
        .upsert({
          ...updatedZone,
          updated_at: new Date().toISOString()
        });

      if (!error) {
        setZones(prev => prev.map(z => z.id === updatedZone.id ? updatedZone : z));
        setEditingZone(null);
      }
    } catch (error) {
      console.error('Error saving zone:', error);
    }
  };

  const handleRuleSave = async (rule: ShippingZoneRule) => {
    try {
      const isNew = !rule.id || rule.id === 'new';
      const ruleData = {
        ...rule,
        id: isNew ? undefined : rule.id,
        updated_at: new Date().toISOString(),
        created_at: isNew ? new Date().toISOString() : rule.created_at
      };

      const { data, error } = await supabase
        .from('shipping_zone_rules')
        .upsert(ruleData)
        .select()
        .single();

      if (!error && data) {
        if (isNew) {
          setRules(prev => [...prev, data].sort((a, b) => a.priority - b.priority));
        } else {
          setRules(prev => prev.map(r => r.id === data.id ? data : r));
        }
        setEditingRule(null);
        setIsRuleModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const handleRuleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('shipping_zone_rules')
        .delete()
        .eq('id', ruleId);

      if (!error) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'allowed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'blocked': return 'bg-red-100 text-red-700 border-red-200';
      case 'conditional': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'allowed': return 'bg-emerald-500';
      case 'blocked': return 'bg-red-500';
      case 'conditional': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const formatConditions = (conditions: ZoneConditions | null) => {
    if (!conditions) return '-';
    const parts: string[] = [];
    if (conditions.required_service) parts.push(`Service: ${conditions.required_service}`);
    if (conditions.blocked_months?.length) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      parts.push(`Blocked: ${conditions.blocked_months.map(m => monthNames[m - 1]).join(', ')}`);
    }
    if (conditions.max_transit_days) parts.push(`Max ${conditions.max_transit_days} day transit`);
    return parts.length > 0 ? parts.join(' | ') : '-';
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'seasonal_block': return 'Seasonal Block';
      case 'service_requirement': return 'Service Requirement';
      case 'transit_limit': return 'Transit Limit';
      case 'surcharge': return 'Surcharge';
      default: return type;
    }
  };

  const getRuleTypeBadge = (type: string) => {
    switch (type) {
      case 'seasonal_block': return 'bg-red-100 text-red-700';
      case 'service_requirement': return 'bg-blue-100 text-blue-700';
      case 'transit_limit': return 'bg-purple-100 text-purple-700';
      case 'surcharge': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading zones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('zones')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeSubTab === 'zones'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          By State
        </button>
        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeSubTab === 'rules'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          Rules
        </button>
      </div>

      {activeSubTab === 'zones' ? (
        <>
          {/* Zone Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {zones.filter(z => z.status === 'allowed').length}
                  </div>
                  <div className="text-xs text-slate-500">Allowed</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {zones.filter(z => z.status === 'conditional').length}
                  </div>
                  <div className="text-xs text-slate-500">Conditional</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {zones.filter(z => z.status === 'blocked').length}
                  </div>
                  <div className="text-xs text-slate-500">Blocked</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedZones.length > 0 && (
            <div className="bg-emerald-50 rounded-2xl p-4 flex items-center justify-between border border-emerald-200">
              <span className="text-emerald-800 font-medium">
                {selectedZones.length} zone{selectedZones.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm mr-2">Set status:</span>
                <button
                  onClick={() => handleBulkStatusChange('allowed')}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Allowed
                </button>
                <button
                  onClick={() => handleBulkStatusChange('conditional')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Conditional
                </button>
                <button
                  onClick={() => handleBulkStatusChange('blocked')}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Blocked
                </button>
                <button
                  onClick={() => setSelectedZones([])}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Zones Table */}
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedZones.length === zones.length && zones.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                  </th>
                  <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">State</th>
                  <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Conditions</th>
                  <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Message</th>
                  <th className="text-right p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zones.map((zone) => (
                  <tr
                    key={zone.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setEditingZone(zone)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedZones.includes(zone.id)}
                        onChange={() => handleZoneSelect(zone.id)}
                        className="w-4 h-4 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getStatusDot(zone.status)}`} />
                        <div>
                          <span className="text-slate-800 font-medium">{zone.state_name}</span>
                          <span className="text-slate-400 ml-2">({zone.state_code})</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(zone.status)}`}>
                        {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-sm max-w-xs truncate">
                      {formatConditions(zone.conditions)}
                    </td>
                    <td className="p-4 text-slate-500 text-sm max-w-xs truncate">
                      {zone.customer_message || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingZone(zone);
                        }}
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-2 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Rules Tab */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingRule(null);
                setIsRuleModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Rule
            </button>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
            {rules.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-slate-700 font-medium mb-2">No shipping rules configured</p>
                <p className="text-slate-500 text-sm">Add rules to control shipping behavior by state, season, or transit time.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Rule Name</th>
                    <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Priority</th>
                    <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Active Dates</th>
                    <th className="text-left p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right p-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditingRule(rule);
                        setIsRuleModalOpen(true);
                      }}
                    >
                      <td className="p-4">
                        <span className="text-slate-800 font-medium">{rule.name}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRuleTypeBadge(rule.rule_type)}`}>
                          {getRuleTypeLabel(rule.rule_type)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-600 font-mono">{rule.priority}</span>
                      </td>
                      <td className="p-4 text-slate-500 text-sm">
                        {rule.effective_start || rule.effective_end ? (
                          <>
                            {rule.effective_start ? new Date(rule.effective_start).toLocaleDateString() : 'Any'}
                            {' - '}
                            {rule.effective_end ? new Date(rule.effective_end).toLocaleDateString() : 'Any'}
                          </>
                        ) : (
                          'Always'
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          rule.is_active
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setIsRuleModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-2 rounded-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRuleDelete(rule.id)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors p-2 rounded-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Zone Edit Modal */}
      {editingZone && (
        <ZoneEditModal
          zone={editingZone}
          onSave={handleZoneSave}
          onClose={() => setEditingZone(null)}
        />
      )}

      {/* Rule Edit Modal */}
      {isRuleModalOpen && (
        <RuleEditModal
          rule={editingRule}
          onSave={handleRuleSave}
          onClose={() => {
            setEditingRule(null);
            setIsRuleModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default ShippingZonesTab;
