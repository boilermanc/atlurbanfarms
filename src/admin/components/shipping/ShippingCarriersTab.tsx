import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import { useSettings } from '../../hooks/useSettings';

interface CarrierSource {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'aggregator' | 'direct';
  configKey: string; // Key to check in settings or carrier_configurations
  carriers: string[];
}

const CARRIER_SOURCES: CarrierSource[] = [
  {
    id: 'shipengine',
    name: 'ShipEngine',
    description: 'Multi-carrier aggregator for USPS, UPS, FedEx, and more',
    icon: '📦',
    type: 'aggregator',
    configKey: 'shipstation_enabled',
    carriers: ['USPS', 'UPS', 'FedEx', 'DHL'],
  },
  {
    id: 'ups_direct',
    name: 'UPS Direct',
    description: 'Direct connection to UPS APIs for real-time rates',
    icon: '🚚',
    type: 'direct',
    configKey: 'ups_direct',
    carriers: ['UPS'],
  },
];

interface CarrierStatus {
  connected: boolean;
  enabled: boolean;
  lastCall?: string;
}

const ShippingCarriersTab: React.FC = () => {
  const { settings, loading: settingsLoading } = useSettings();
  const [carrierStatuses, setCarrierStatuses] = useState<Record<string, CarrierStatus>>({});
  const [loading, setLoading] = useState(true);

  // Load carrier statuses
  useEffect(() => {
    async function loadStatuses() {
      try {
        const statuses: Record<string, CarrierStatus> = {};

        // Check ShipEngine status from settings
        const integrationSettings = settings.integrations || {};
        statuses['shipengine'] = {
          connected: !!integrationSettings.shipengine_api_key,
          enabled: integrationSettings.shipstation_enabled ?? false,
        };

        // Check UPS Direct status from carrier_configurations
        const { data: upsConfig } = await supabase
          .from('carrier_configurations')
          .select('is_enabled, api_credentials, last_successful_call')
          .eq('carrier_code', 'ups_direct')
          .single();

        if (upsConfig) {
          statuses['ups_direct'] = {
            connected: !!(upsConfig.api_credentials?.client_id && upsConfig.api_credentials?.client_secret),
            enabled: upsConfig.is_enabled ?? false,
            lastCall: upsConfig.last_successful_call,
          };
        } else {
          statuses['ups_direct'] = {
            connected: false,
            enabled: false,
          };
        }

        setCarrierStatuses(statuses);
      } catch (err) {
        console.error('Error loading carrier statuses:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!settingsLoading) {
      loadStatuses();
    }
  }, [settings, settingsLoading]);

  const getStatusBadge = (status: CarrierStatus) => {
    if (!status.connected) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
          Not Configured
        </span>
      );
    }
    if (!status.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
          Disabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
        Active
      </span>
    );
  };

  const formatLastCall = (dateStr?: string): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCarriers = CARRIER_SOURCES.filter(
    (source) => carrierStatuses[source.id]?.connected && carrierStatuses[source.id]?.enabled
  );

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h4 className="text-slate-800 font-medium">Carrier Rate Sources</h4>
            <p className="text-sm text-slate-500">
              {activeCarriers.length === 0
                ? 'No carriers configured'
                : `${activeCarriers.length} active carrier source${activeCarriers.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Configure carrier API credentials in{' '}
          <span className="text-emerald-600 font-medium">Configuration → Integrations</span>.
          Enable or disable carriers here for rate shopping.
        </p>
      </div>

      {/* Carrier Sources */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Available Carrier Sources</h4>

        {CARRIER_SOURCES.map((source) => {
          const status = carrierStatuses[source.id] || { connected: false, enabled: false };

          return (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {source.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h5 className="text-lg font-medium text-slate-800">{source.name}</h5>
                    {getStatusBadge(status)}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                      source.type === 'aggregator'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-purple-100 text-purple-700 border-purple-200'
                    }`}>
                      {source.type === 'aggregator' ? 'Aggregator' : 'Direct API'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{source.description}</p>

                  {/* Carriers */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Carriers:</span>
                    {source.carriers.map((carrier) => (
                      <span
                        key={carrier}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200"
                      >
                        {carrier}
                      </span>
                    ))}
                  </div>

                  {/* Last successful call */}
                  {status.connected && status.lastCall && (
                    <p className="text-xs text-slate-500 mt-2">
                      Last successful call: {formatLastCall(status.lastCall)}
                    </p>
                  )}
                </div>

                {/* Status & Action */}
                <div className="flex flex-col items-end gap-2">
                  {status.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">
                        {status.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${
                        status.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} />
                    </div>
                  ) : (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        // Navigate to integrations - this would need to be handled by parent
                        window.dispatchEvent(new CustomEvent('navigate-admin', { detail: 'integrations' }));
                      }}
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      Configure
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Rate Shopping Priority */}
      {activeCarriers.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">
            Rate Shopping Behavior
          </h4>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-slate-800">All active carrier sources are queried</p>
                <p className="text-xs text-slate-500 mt-1">
                  Rates from all enabled carriers are fetched and combined for the best options.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <div>
                <p className="text-sm text-slate-800">Rates are sorted by price</p>
                <p className="text-xs text-slate-500 mt-1">
                  Customers see the cheapest options first, regardless of carrier source.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-slate-800">Direct APIs may have better rates</p>
                <p className="text-xs text-slate-500 mt-1">
                  UPS Direct often provides negotiated account rates not available through aggregators.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
        <h4 className="text-sm font-medium text-slate-700 mb-2">Need Help?</h4>
        <p className="text-xs text-slate-500 mb-3">
          Carrier integrations are configured in the Integrations page. Each carrier source can be
          enabled or disabled independently.
        </p>
        <div className="flex gap-3">
          <a
            href="https://www.shipengine.com/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            ShipEngine Docs
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://developer.ups.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            UPS Developer Portal
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ShippingCarriersTab;
