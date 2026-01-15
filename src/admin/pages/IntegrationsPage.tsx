import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings } from '../hooks/useSettings';

type IntegrationStatus = 'connected' | 'disconnected' | 'error';
type HealthStatus = 'healthy' | 'warning' | 'error';

interface IntegrationHealth {
  status: HealthStatus;
  label: string;
  metrics: { label: string; value: string }[];
}

interface WebhookEvent {
  id: string;
  type: string;
  status: 'success' | 'failed';
  timestamp: string;
  details?: string;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: 'delivered' | 'bounced' | 'failed';
  timestamp: string;
}

interface SyncLog {
  id: string;
  action: string;
  status: 'success' | 'failed';
  itemsProcessed: number;
  timestamp: string;
}

// Mock data for demonstration - in production, these would come from APIs
const MOCK_STRIPE_WEBHOOKS: WebhookEvent[] = [
  { id: '1', type: 'payment_intent.succeeded', status: 'success', timestamp: '2025-01-15T10:30:00Z' },
  { id: '2', type: 'checkout.session.completed', status: 'success', timestamp: '2025-01-15T10:25:00Z' },
  { id: '3', type: 'customer.created', status: 'success', timestamp: '2025-01-15T10:20:00Z' },
  { id: '4', type: 'payment_intent.failed', status: 'failed', timestamp: '2025-01-15T10:15:00Z', details: 'Card declined' },
  { id: '5', type: 'invoice.paid', status: 'success', timestamp: '2025-01-15T10:10:00Z' },
];

const MOCK_EMAILS: EmailLog[] = [
  { id: '1', to: 'customer@example.com', subject: 'Order Confirmation #1234', status: 'delivered', timestamp: '2025-01-15T10:30:00Z' },
  { id: '2', to: 'user@example.com', subject: 'Shipping Update', status: 'delivered', timestamp: '2025-01-15T10:25:00Z' },
  { id: '3', to: 'test@invalid.com', subject: 'Welcome Email', status: 'bounced', timestamp: '2025-01-15T10:20:00Z' },
  { id: '4', to: 'another@example.com', subject: 'Order Shipped #1233', status: 'delivered', timestamp: '2025-01-15T10:15:00Z' },
  { id: '5', to: 'customer2@example.com', subject: 'Order Confirmation #1232', status: 'delivered', timestamp: '2025-01-15T10:10:00Z' },
];

const MOCK_SYNC_LOGS: SyncLog[] = [
  { id: '1', action: 'Order sync', status: 'success', itemsProcessed: 15, timestamp: '2025-01-15T10:30:00Z' },
  { id: '2', action: 'Inventory update', status: 'success', itemsProcessed: 42, timestamp: '2025-01-15T10:00:00Z' },
  { id: '3', action: 'Tracking import', status: 'failed', itemsProcessed: 0, timestamp: '2025-01-15T09:30:00Z' },
  { id: '4', action: 'Order sync', status: 'success', itemsProcessed: 8, timestamp: '2025-01-15T09:00:00Z' },
];

// Default integration settings
const DEFAULT_INTEGRATION_SETTINGS = {
  // Stripe
  stripe_enabled: { value: false, dataType: 'boolean' as const },
  stripe_publishable_key: { value: '', dataType: 'string' as const },
  stripe_secret_key: { value: '', dataType: 'string' as const },
  stripe_webhook_secret: { value: '', dataType: 'string' as const },
  // ShipStation
  shipstation_enabled: { value: false, dataType: 'boolean' as const },
  shipstation_api_key: { value: '', dataType: 'string' as const },
  shipstation_api_secret: { value: '', dataType: 'string' as const },
  shipstation_store_id: { value: '', dataType: 'string' as const },
  // Resend
  resend_enabled: { value: false, dataType: 'boolean' as const },
  resend_api_key: { value: '', dataType: 'string' as const },
  resend_from_email: { value: '', dataType: 'string' as const },
  resend_from_name: { value: '', dataType: 'string' as const },
  // Trellis
  trellis_enabled: { value: false, dataType: 'boolean' as const },
  trellis_api_endpoint: { value: '', dataType: 'string' as const },
  trellis_api_key: { value: '', dataType: 'string' as const },
};

const IntegrationsPage: React.FC = () => {
  const { settings, loading, error, refetch } = useSettings();
  const { bulkUpdate, loading: saving } = useBulkUpdateSettings();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stripe: false,
    shipstation: false,
    resend: false,
    trellis: false,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Initialize form data with defaults and loaded settings
  useEffect(() => {
    const integrationSettings = settings.integrations || {};
    const newFormData: Record<string, any> = {};

    Object.entries(DEFAULT_INTEGRATION_SETTINGS).forEach(([key, config]) => {
      newFormData[key] = integrationSettings[key] ?? config.value;
    });

    setFormData(newFormData);
  }, [settings]);

  const updateField = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    const settingsToSave: Record<string, { value: any; dataType: 'string' | 'number' | 'boolean' | 'json' }> = {};

    Object.entries(DEFAULT_INTEGRATION_SETTINGS).forEach(([key, config]) => {
      settingsToSave[key] = {
        value: formData[key],
        dataType: config.dataType,
      };
    });

    const success = await bulkUpdate('integrations', settingsToSave);

    if (success) {
      setSaveMessage('Settings saved!');
      setTimeout(() => setSaveMessage(null), 3000);
      refetch();
    }
  }, [formData, bulkUpdate, refetch]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const maskValue = (value: string, showLast: number = 4): string => {
    if (!value || value.length <= showLast) return value;
    return '*'.repeat(Math.min(value.length - showLast, 20)) + value.slice(-showLast);
  };

  const getConnectionStatus = (enabled: boolean, hasCredentials: boolean): IntegrationStatus => {
    if (!enabled) return 'disconnected';
    if (!hasCredentials) return 'error';
    return 'connected';
  };

  const getHealthStatus = (status: IntegrationStatus, errorRate?: number): HealthStatus => {
    if (status === 'disconnected') return 'warning';
    if (status === 'error') return 'error';
    if (errorRate && errorRate > 5) return 'warning';
    if (errorRate && errorRate > 10) return 'error';
    return 'healthy';
  };

  const testConnection = async (integration: string) => {
    setTestingConnection(integration);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTestingConnection(null);
    setSaveMessage(`${integration} connection successful!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const triggerSync = async (integration: string) => {
    setSyncing(integration);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncing(null);
    setSaveMessage(`${integration} sync completed!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
    }
  };

  const getStatusBgColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
    }
  };

  // Calculate health metrics for each integration
  const getIntegrationHealth = (): Record<string, IntegrationHealth> => {
    const stripeStatus = getConnectionStatus(
      formData.stripe_enabled,
      !!(formData.stripe_publishable_key && formData.stripe_secret_key)
    );
    const shipstationStatus = getConnectionStatus(
      formData.shipstation_enabled,
      !!(formData.shipstation_api_key && formData.shipstation_api_secret)
    );
    const resendStatus = getConnectionStatus(
      formData.resend_enabled,
      !!formData.resend_api_key
    );
    const trellisStatus = getConnectionStatus(
      formData.trellis_enabled,
      !!(formData.trellis_api_endpoint && formData.trellis_api_key)
    );

    return {
      stripe: {
        status: getHealthStatus(stripeStatus, 2),
        label: stripeStatus === 'connected' ? 'Connected' : stripeStatus === 'disconnected' ? 'Disabled' : 'Missing Credentials',
        metrics: [
          { label: 'Last Webhook', value: MOCK_STRIPE_WEBHOOKS[0] ? formatTimestamp(MOCK_STRIPE_WEBHOOKS[0].timestamp) : 'Never' },
          { label: 'Error Rate', value: '2.1%' },
        ],
      },
      shipstation: {
        status: getHealthStatus(shipstationStatus),
        label: shipstationStatus === 'connected' ? 'Connected' : shipstationStatus === 'disconnected' ? 'Disabled' : 'Missing Credentials',
        metrics: [
          { label: 'Last Sync', value: MOCK_SYNC_LOGS[0] ? formatTimestamp(MOCK_SYNC_LOGS[0].timestamp) : 'Never' },
          { label: 'Pending Orders', value: '3' },
        ],
      },
      resend: {
        status: getHealthStatus(resendStatus, 1.5),
        label: resendStatus === 'connected' ? 'Connected' : resendStatus === 'disconnected' ? 'Disabled' : 'Missing Credentials',
        metrics: [
          { label: 'Emails Today', value: '47' },
          { label: 'Bounce Rate', value: '1.5%' },
        ],
      },
      trellis: {
        status: getHealthStatus(trellisStatus),
        label: trellisStatus === 'connected' ? 'Connected' : trellisStatus === 'disconnected' ? 'Disabled' : 'Missing Credentials',
        metrics: [
          { label: 'Subscribers', value: '1,234' },
          { label: 'Last Sync', value: '2 hours ago' },
        ],
      },
    };
  };

  const health = getIntegrationHealth();

  // Health Overview Card Component
  const HealthCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    health: IntegrationHealth;
    onClick: () => void;
  }> = ({ title, icon, health, onClick }) => (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all hover:scale-[1.02] text-left w-full ${getStatusBgColor(health.status)}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <h3 className="text-white font-medium">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(health.status)}`} />
              <span className="text-sm text-slate-400">{health.label}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {health.metrics.map((metric, idx) => (
          <div key={idx} className="text-xs">
            <span className="text-slate-500">{metric.label}:</span>
            <span className="text-slate-300 ml-1">{metric.value}</span>
          </div>
        ))}
      </div>
    </button>
  );

  // Expandable Section Component
  const IntegrationSection: React.FC<{
    id: string;
    title: string;
    icon: React.ReactNode;
    expanded: boolean;
    onToggle: () => void;
    health: IntegrationHealth;
    children: React.ReactNode;
  }> = ({ id, title, icon, expanded, onToggle, health, children }) => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-2xl">{icon}</div>
          <div className="text-left">
            <h3 className="text-lg font-medium text-white">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(health.status)}`} />
              <span className="text-sm text-slate-400">{health.label}</span>
            </div>
          </div>
        </div>
        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          className="w-5 h-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-6 border-t border-slate-700 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Input with toggle visibility for secrets
  const SecretInput: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    helpText?: string;
  }> = ({ label, value, onChange, placeholder, readOnly, helpText }) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">{label}</label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {visible ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {helpText && <p className="text-xs text-slate-400">{helpText}</p>}
      </div>
    );
  };

  // Webhook/Events Table Component
  const EventsTable: React.FC<{
    title: string;
    events: WebhookEvent[];
  }> = ({ title, events }) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-300">{title}</h4>
      <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Type</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 10).map((event) => (
              <tr key={event.id} className="border-b border-slate-700/50 last:border-0">
                <td className="px-4 py-2 text-slate-300 font-mono text-xs">{event.type}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                    event.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      event.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 text-xs">{formatTimestamp(event.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Email Log Table Component
  const EmailsTable: React.FC<{
    title: string;
    emails: EmailLog[];
  }> = ({ title, emails }) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-300">{title}</h4>
      <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-2 text-left text-slate-400 font-medium">To</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Subject</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {emails.slice(0, 10).map((email) => (
              <tr key={email.id} className="border-b border-slate-700/50 last:border-0">
                <td className="px-4 py-2 text-slate-300 text-xs">{email.to}</td>
                <td className="px-4 py-2 text-slate-300 text-xs truncate max-w-[200px]">{email.subject}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                    email.status === 'delivered'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : email.status === 'bounced'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {email.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 text-xs">{formatTimestamp(email.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Sync Log Table Component
  const SyncLogTable: React.FC<{
    title: string;
    logs: SyncLog[];
  }> = ({ title, logs }) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-300">{title}</h4>
      <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Action</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Items</th>
              <th className="px-4 py-2 text-left text-slate-400 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-700/50 last:border-0">
                <td className="px-4 py-2 text-slate-300 text-xs">{log.action}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                    log.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 text-xs">{log.itemsProcessed}</td>
                <td className="px-4 py-2 text-slate-400 text-xs">{formatTimestamp(log.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  const webhookBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks` : '';

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-emerald-400 font-medium text-sm"
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save All
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthCard
            title="Stripe"
            icon={<span>💳</span>}
            health={health.stripe}
            onClick={() => toggleSection('stripe')}
          />
          <HealthCard
            title="ShipStation"
            icon={<span>📦</span>}
            health={health.shipstation}
            onClick={() => toggleSection('shipstation')}
          />
          <HealthCard
            title="Resend"
            icon={<span>📧</span>}
            health={health.resend}
            onClick={() => toggleSection('resend')}
          />
          <HealthCard
            title="Trellis"
            icon={<span>🌱</span>}
            health={health.trellis}
            onClick={() => toggleSection('trellis')}
          />
        </div>

        {/* Integration Detail Sections */}
        <div className="space-y-4">
          {/* STRIPE Section */}
          <IntegrationSection
            id="stripe"
            title="Stripe"
            icon={<span>💳</span>}
            expanded={expandedSections.stripe}
            onToggle={() => toggleSection('stripe')}
            health={health.stripe}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable Stripe</h4>
                  <p className="text-sm text-slate-400">Process payments via Stripe</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.stripe_enabled ?? false}
                    onChange={(e) => updateField('stripe_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SecretInput
                  label="Publishable Key"
                  value={formData.stripe_publishable_key || ''}
                  onChange={(v) => updateField('stripe_publishable_key', v)}
                  placeholder="pk_live_..."
                  helpText="Your Stripe publishable key (starts with pk_)"
                />
                <SecretInput
                  label="Secret Key"
                  value={formData.stripe_secret_key || ''}
                  onChange={(v) => updateField('stripe_secret_key', v)}
                  placeholder="sk_live_..."
                  helpText="Your Stripe secret key (starts with sk_)"
                />
              </div>

              <SecretInput
                label="Webhook Secret"
                value={formData.stripe_webhook_secret || ''}
                onChange={(v) => updateField('stripe_webhook_secret', v)}
                placeholder="whsec_..."
                helpText="Your Stripe webhook signing secret (starts with whsec_)"
              />

              {/* Webhook URL */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${webhookBaseUrl}/stripe`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-400 font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${webhookBaseUrl}/stripe`)}
                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-400">Configure this URL in your Stripe Dashboard under Webhooks</p>
              </div>

              {/* Test Connection Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Stripe')}
                  disabled={testingConnection === 'Stripe' || !formData.stripe_secret_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Stripe' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {/* Recent Webhooks Table */}
              <EventsTable title="Recent Webhooks (Last 10)" events={MOCK_STRIPE_WEBHOOKS} />
            </div>
          </IntegrationSection>

          {/* SHIPSTATION Section */}
          <IntegrationSection
            id="shipstation"
            title="ShipStation"
            icon={<span>📦</span>}
            expanded={expandedSections.shipstation}
            onToggle={() => toggleSection('shipstation')}
            health={health.shipstation}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable ShipStation</h4>
                  <p className="text-sm text-slate-400">Sync orders and manage shipping</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.shipstation_enabled ?? false}
                    onChange={(e) => updateField('shipstation_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SecretInput
                  label="API Key"
                  value={formData.shipstation_api_key || ''}
                  onChange={(v) => updateField('shipstation_api_key', v)}
                  placeholder="Your ShipStation API key"
                />
                <SecretInput
                  label="API Secret"
                  value={formData.shipstation_api_secret || ''}
                  onChange={(v) => updateField('shipstation_api_secret', v)}
                  placeholder="Your ShipStation API secret"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Store ID</label>
                  <input
                    type="text"
                    value={formData.shipstation_store_id || ''}
                    onChange={(e) => updateField('shipstation_store_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="123456"
                  />
                  <p className="text-xs text-slate-400">Your ShipStation store ID</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Last Sync</label>
                  <div className="px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-400">
                    {MOCK_SYNC_LOGS[0] ? formatTimestamp(MOCK_SYNC_LOGS[0].timestamp) : 'Never'}
                  </div>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${webhookBaseUrl}/shipstation`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-400 font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${webhookBaseUrl}/shipstation`)}
                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-400">Configure this URL in ShipStation under Account Settings &gt; Webhooks</p>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="flex-1">
                  <div className="text-sm text-slate-400">Pending Orders</div>
                  <div className="text-2xl font-bold text-white">3</div>
                </div>
                <button
                  onClick={() => triggerSync('ShipStation')}
                  disabled={syncing === 'ShipStation' || !formData.shipstation_api_key}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {syncing === 'ShipStation' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </>
                  )}
                </button>
              </div>

              {/* Recent Sync Log */}
              <SyncLogTable title="Recent Sync Log" logs={MOCK_SYNC_LOGS} />
            </div>
          </IntegrationSection>

          {/* RESEND Section */}
          <IntegrationSection
            id="resend"
            title="Resend"
            icon={<span>📧</span>}
            expanded={expandedSections.resend}
            onToggle={() => toggleSection('resend')}
            health={health.resend}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable Resend</h4>
                  <p className="text-sm text-slate-400">Send transactional emails via Resend</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.resend_enabled ?? false}
                    onChange={(e) => updateField('resend_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <SecretInput
                label="API Key"
                value={formData.resend_api_key || ''}
                onChange={(v) => updateField('resend_api_key', v)}
                placeholder="re_..."
                helpText="Your Resend API key (starts with re_)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">From Email</label>
                  <input
                    type="email"
                    value={formData.resend_from_email || ''}
                    onChange={(e) => updateField('resend_from_email', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="orders@yourdomain.com"
                  />
                  <p className="text-xs text-slate-400">Must be a verified domain in Resend</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">From Name</label>
                  <input
                    type="text"
                    value={formData.resend_from_name || ''}
                    onChange={(e) => updateField('resend_from_name', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="ATL Urban Farms"
                  />
                </div>
              </div>

              {/* Test Email Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Resend')}
                  disabled={testingConnection === 'Resend' || !formData.resend_api_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Resend' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Test Email
                    </>
                  )}
                </button>
              </div>

              {/* Recent Emails Table */}
              <EmailsTable title="Recent Emails (Last 10)" emails={MOCK_EMAILS} />
            </div>
          </IntegrationSection>

          {/* TRELLIS Section */}
          <IntegrationSection
            id="trellis"
            title="Trellis"
            icon={<span>🌱</span>}
            expanded={expandedSections.trellis}
            onToggle={() => toggleSection('trellis')}
            health={health.trellis}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable Trellis</h4>
                  <p className="text-sm text-slate-400">Sync subscribers with Trellis marketing platform</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.trellis_enabled ?? false}
                    onChange={(e) => updateField('trellis_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">API Endpoint</label>
                  <input
                    type="url"
                    value={formData.trellis_api_endpoint || ''}
                    onChange={(e) => updateField('trellis_api_endpoint', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://api.trellis.co/v1"
                  />
                </div>
                <SecretInput
                  label="API Key"
                  value={formData.trellis_api_key || ''}
                  onChange={(v) => updateField('trellis_api_key', v)}
                  placeholder="Your Trellis API key"
                />
              </div>

              {/* Status & Sync */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-sm text-slate-400">Subscribers Synced</div>
                  <div className="text-2xl font-bold text-white">1,234</div>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-sm text-slate-400">Last Sync</div>
                  <div className="text-lg font-medium text-white">2 hours ago</div>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => triggerSync('Trellis')}
                    disabled={syncing === 'Trellis' || !formData.trellis_api_key}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {syncing === 'Trellis' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Trellis')}
                  disabled={testingConnection === 'Trellis' || !formData.trellis_api_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Trellis' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Test Connection
                    </>
                  )}
                </button>
              </div>
            </div>
          </IntegrationSection>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default IntegrationsPage;
