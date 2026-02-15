import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import { useSettings } from '../../hooks/useSettings';

interface DbCarrier {
  id: string;
  carrier_code: string;
  carrier_name: string;
  is_enabled: boolean;
  is_sandbox: boolean;
  api_credentials: {
    shipengine_carrier_id?: string;
    account_number?: string;
    source?: string;
    client_id?: string;
    client_secret?: string;
  } | null;
  allowed_service_codes: string[] | null;
  last_successful_call: string | null;
  updated_at: string;
}

interface ShipEngineCarrier {
  carrier_id: string;
  carrier_code: string;
  friendly_name: string;
  nickname: string | null;
  account_number: string | null;
  is_primary: boolean;
  disabled: boolean;
  services: Array<{
    service_code: string;
    name: string;
    domestic: boolean;
    international: boolean;
  }>;
}

interface SyncResult {
  carrier_code: string;
  carrier_name: string;
  carrier_id: string;
  synced: boolean;
  error: string | null;
}

const ShippingCarriersTab: React.FC = () => {
  const { settings, loading: settingsLoading } = useSettings();
  const [dbCarriers, setDbCarriers] = useState<DbCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [discoveredCarriers, setDiscoveredCarriers] = useState<ShipEngineCarrier[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const apiKey = !settingsLoading ? (settings.integrations || {}).shipengine_api_key : null;
  const hasApiKey = !!apiKey;
  const isSandboxKey = hasApiKey && typeof apiKey === 'string' && apiKey.startsWith('TEST_');

  // Load carriers from carrier_configurations table
  const loadDbCarriers = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_configurations')
        .select('*')
        .order('carrier_name', { ascending: true });

      if (error) {
        console.error('Error loading carriers:', error);
        return;
      }
      setDbCarriers(data || []);
    } catch (err) {
      console.error('Error loading carriers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsLoading) {
      loadDbCarriers();
    }
  }, [settingsLoading]);

  // Sync carriers from ShipEngine
  const handleSyncCarriers = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setDiscoveredCarriers(null);

    try {
      const { data, error } = await supabase.functions.invoke('shipengine-list-carriers', {
        body: { sync: true }
      });

      if (error) {
        let msg = 'Failed to sync carriers';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error?.message || msg;
          }
        } catch { /* ignore */ }
        setSyncMessage({ type: 'error', text: msg });
        return;
      }

      if (!data.success) {
        setSyncMessage({ type: 'error', text: data.error?.message || 'Failed to sync carriers' });
        return;
      }

      setDiscoveredCarriers(data.carriers);

      const synced = (data.sync_results as SyncResult[])?.filter(r => r.synced).length || 0;
      const failed = (data.sync_results as SyncResult[])?.filter(r => !r.synced).length || 0;

      if (failed > 0) {
        setSyncMessage({
          type: 'error',
          text: `Synced ${synced} carrier(s), ${failed} failed. Check console for details.`
        });
      } else {
        setSyncMessage({
          type: 'success',
          text: `Found ${data.total} carrier(s) in ShipEngine (${data.active} active). ${synced} synced to database.`
        });
      }

      // Reload DB carriers
      await loadDbCarriers();
    } catch (err: any) {
      console.error('Sync error:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Failed to sync carriers' });
    } finally {
      setSyncing(false);
    }
  };

  // Toggle carrier enabled/disabled
  const handleToggleCarrier = async (carrier: DbCarrier) => {
    setTogglingId(carrier.id);
    try {
      const { error } = await supabase
        .from('carrier_configurations')
        .update({
          is_enabled: !carrier.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', carrier.id);

      if (error) {
        console.error('Error toggling carrier:', error);
        return;
      }

      setDbCarriers(prev =>
        prev.map(c => c.id === carrier.id ? { ...c, is_enabled: !c.is_enabled } : c)
      );
    } catch (err) {
      console.error('Error toggling carrier:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const getSourceLabel = (carrier: DbCarrier): string => {
    const source = carrier.api_credentials?.source;
    if (source === 'shipstation') return 'ShipStation';
    if (source === 'direct') return 'Direct';
    if (carrier.api_credentials?.client_id) return 'Direct API';
    return 'Unknown';
  };

  const getSourceBadgeClass = (carrier: DbCarrier): string => {
    const source = carrier.api_credentials?.source;
    if (source === 'shipstation') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (source === 'direct') return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const enabledCount = dbCarriers.filter(c => c.is_enabled).length;

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="text-slate-800 font-medium">Carrier Rate Sources</h4>
              <p className="text-sm text-slate-500">
                {dbCarriers.length === 0
                  ? 'No carriers synced yet'
                  : `${enabledCount} of ${dbCarriers.length} carrier(s) enabled for rate shopping`}
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncCarriers}
            disabled={syncing || !hasApiKey}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync from ShipEngine
              </>
            )}
          </button>
        </div>
        {!hasApiKey && (
          <p className="text-xs text-amber-600 mt-3">
            ShipEngine API key not configured. Set it in{' '}
            <span className="font-medium">Configuration &rarr; Integrations</span> first.
          </p>
        )}
      </div>

      {/* Sandbox API key warning */}
      {isSandboxKey && (
        <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-xl text-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">&#9888;</span>
            <div>
              <p className="font-semibold text-orange-800">Sandbox Mode Active</p>
              <p className="text-orange-700 mt-1">
                Your ShipEngine API key starts with <code className="bg-orange-100 px-1 rounded text-xs">TEST_</code> — this is a sandbox key.
                Rates returned are <strong>estimated retail prices</strong>, not your negotiated Shipstation rates.
                Replace with your production API key in <strong>Configuration &rarr; Integrations</strong> for accurate pricing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync message */}
      {syncMessage && (
        <div className={`p-4 rounded-xl border text-sm ${
          syncMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {syncMessage.text}
        </div>
      )}

      {/* Discovered carriers detail (shown after sync) */}
      {discoveredCarriers && discoveredCarriers.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
          <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            ShipEngine Account Carriers
          </h4>
          <div className="space-y-2">
            {discoveredCarriers.map((c) => (
              <div key={c.carrier_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 text-sm">
                <div>
                  <span className="font-medium text-slate-800">
                    {c.nickname || c.friendly_name}
                  </span>
                  {c.nickname && c.nickname !== c.friendly_name && (
                    <span className="text-slate-500 ml-2">({c.friendly_name})</span>
                  )}
                  <span className="text-xs text-slate-400 ml-2">{c.carrier_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {c.services.filter(s => s.domestic).length} domestic services
                  </span>
                  <span className={`w-2 h-2 rounded-full ${c.disabled ? 'bg-red-400' : 'bg-emerald-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DB Carrier configurations */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Configured Carriers
        </h4>

        {dbCarriers.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200/60 shadow-sm text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <h5 className="text-slate-700 font-medium mb-2">No carriers configured</h5>
            <p className="text-sm text-slate-500 mb-4">
              Click "Sync from ShipEngine" to discover and import your carrier accounts.
            </p>
          </div>
        ) : (
          dbCarriers.map((carrier) => (
            <motion.div
              key={carrier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {carrier.carrier_code.includes('ups') ? '🟤' :
                   carrier.carrier_code.includes('usps') ? '🔵' :
                   carrier.carrier_code.includes('fedex') ? '🟣' :
                   carrier.carrier_code.includes('dhl') ? '🟡' : '📦'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h5 className="text-lg font-medium text-slate-800">
                      {carrier.carrier_name}
                      {carrier.carrier_name.toLowerCase().includes('test account') && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          Test Carrier
                        </span>
                      )}
                    </h5>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      carrier.is_enabled
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${carrier.is_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {carrier.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSourceBadgeClass(carrier)}`}>
                      {getSourceLabel(carrier)}
                    </span>
                  </div>

                  {/* Carrier ID */}
                  {carrier.api_credentials?.shipengine_carrier_id && (
                    <p className="text-xs text-slate-400 mb-2 font-mono">
                      {carrier.api_credentials.shipengine_carrier_id}
                    </p>
                  )}

                  {/* Services */}
                  {carrier.allowed_service_codes && carrier.allowed_service_codes.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-xs text-slate-500">Services:</span>
                      {carrier.allowed_service_codes.slice(0, 6).map((code) => (
                        <span
                          key={code}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200"
                        >
                          {code}
                        </span>
                      ))}
                      {carrier.allowed_service_codes.length > 6 && (
                        <span className="text-xs text-slate-400">
                          +{carrier.allowed_service_codes.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Account number */}
                  {carrier.api_credentials?.account_number && (
                    <p className="text-xs text-slate-500 mt-2">
                      Account: {carrier.api_credentials.account_number}
                    </p>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleToggleCarrier(carrier)}
                    disabled={togglingId === carrier.id}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      carrier.is_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    } ${togglingId === carrier.id ? 'opacity-50' : ''}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      carrier.is_enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Rate Shopping Info */}
      {enabledCount > 0 && (
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
                <p className="text-sm text-slate-800">Only enabled carriers are queried for rates</p>
                <p className="text-xs text-slate-500 mt-1">
                  Toggle carriers on/off to control which rate sources are included.
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
                  Cheapest options shown first, regardless of carrier source.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-slate-800">ShipStation carriers often have negotiated rates</p>
                <p className="text-xs text-slate-500 mt-1">
                  ShipStation UPS rates are typically cheaper than direct UPS account rates.
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
          Carrier integrations are configured in the Integrations page. Click "Sync from ShipEngine"
          to discover all carriers connected to your ShipEngine account, including ShipStation carriers.
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
        </div>
      </div>
    </div>
  );
};

export default ShippingCarriersTab;
