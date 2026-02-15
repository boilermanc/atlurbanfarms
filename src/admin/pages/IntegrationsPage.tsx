import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings } from '../hooks/useSettings';
import { useTestIntegration, useEmailService } from '../../hooks/useIntegrations';
import { supabase } from '../../lib/supabase';
import {
  CreditCard,
  Package,
  Mail,
  Leaf,
  Bot,
  Truck,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  X,
  ExternalLink,
  Send,
  Copy,
} from 'lucide-react';

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

// Helper functions moved outside component
const getStatusColor = (status: HealthStatus): string => {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'error':
      return 'bg-red-500';
  }
};

const getStatusBgColor = (status: HealthStatus): string => {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-50 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'error':
      return 'bg-red-50 border-red-200';
  }
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

// Input with toggle visibility for secrets - moved outside
const SecretInput = memo<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  helpText?: string;
}>(({ label, value, onChange, placeholder, readOnly, helpText }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 transition-all"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}
    </div>
  );
});
SecretInput.displayName = 'SecretInput';

// Health Overview Card Component - moved outside
const HealthCard = memo<{
  title: string;
  icon: React.ReactNode;
  health: IntegrationHealth;
  onClick: () => void;
}>(({ title, icon, health, onClick }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border transition-all hover:scale-[1.02] text-left w-full ${getStatusBgColor(health.status)}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="text-slate-600">{icon}</div>
        <div>
          <h3 className="text-slate-800 font-medium">{title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(health.status)}`} />
            <span className="text-sm text-slate-500">{health.label}</span>
          </div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 mt-3">
      {health.metrics.map((metric, idx) => (
        <div key={idx} className="text-xs">
          <span className="text-slate-500">{metric.label}:</span>
          <span className="text-slate-700 ml-1">{metric.value}</span>
        </div>
      ))}
    </div>
  </button>
));
HealthCard.displayName = 'HealthCard';

// Expandable Section Component - moved outside
const IntegrationSection = memo<{
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  health: IntegrationHealth;
  children: React.ReactNode;
}>(({ id, title, icon, expanded, onToggle, health, children }) => (
  <div id={`section-${id}`} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
          {icon}
        </div>
        <div className="text-left">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(health.status)}`} />
            <span className="text-sm text-slate-500">{health.label}</span>
          </div>
        </div>
      </div>
      <motion.div
        animate={{ rotate: expanded ? 180 : 0 }}
        className="text-slate-400"
      >
        <ChevronDown size={20} />
      </motion.div>
    </button>
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
IntegrationSection.displayName = 'IntegrationSection';

// Webhook/Events Table Component - moved outside
const EventsTable = memo<{
  title: string;
  events: WebhookEvent[];
}>(({ title, events }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-medium text-slate-700">{title}</h4>
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {events.slice(0, 10).map((event) => (
            <tr key={event.id}>
              <td className="px-4 py-2 text-slate-700 font-mono text-xs">{event.type}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  event.status === 'success'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    event.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  {event.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">{formatTimestamp(event.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));
EventsTable.displayName = 'EventsTable';

// Email Log Table Component - moved outside
const EmailsTable = memo<{
  title: string;
  emails: EmailLog[];
}>(({ title, emails }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-medium text-slate-700">{title}</h4>
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">To</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {emails.slice(0, 10).map((email) => (
            <tr key={email.id}>
              <td className="px-4 py-2 text-slate-700 text-xs">{email.to}</td>
              <td className="px-4 py-2 text-slate-700 text-xs truncate max-w-[200px]">{email.subject}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  email.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : email.status === 'bounced'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  {email.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">{formatTimestamp(email.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));
EmailsTable.displayName = 'EmailsTable';

// Sync Log Table Component - moved outside
const SyncLogTable = memo<{
  title: string;
  logs: SyncLog[];
}>(({ title, logs }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-medium text-slate-700">{title}</h4>
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Items</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-2 text-slate-700 text-xs">{log.action}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  log.status === 'success'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  {log.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">{log.itemsProcessed}</td>
              <td className="px-4 py-2 text-slate-500 text-xs">{formatTimestamp(log.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));
SyncLogTable.displayName = 'SyncLogTable';

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
  stripe_webhook_url: { value: 'https://povudgtvzggnxwgtjexa.supabase.co/functions/v1/stripe-webhook', dataType: 'string' as const },
  // ShipEngine (shipping integration)
  shipstation_enabled: { value: false, dataType: 'boolean' as const },
  shipengine_mode: { value: 'sandbox', dataType: 'string' as const },
  shipengine_api_key_production: { value: '', dataType: 'string' as const },
  shipengine_api_key_sandbox: { value: '', dataType: 'string' as const },
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
  // Gemini (Sage AI)
  gemini_enabled: { value: false, dataType: 'boolean' as const },
  gemini_api_key: { value: '', dataType: 'string' as const },
};

const IntegrationsPage: React.FC = () => {
  const { settings, loading, error, refetch } = useSettings();
  const { bulkUpdate, loading: saving } = useBulkUpdateSettings();
  const { testConnection: testIntegrationConnection, testing: testingIntegration } = useTestIntegration();
  const { sendEmail } = useEmailService();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stripe: false,
    shipstation: false,
    resend: false,
    trellis: false,
    gemini: false,
    ups: false,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [lastError, setLastError] = useState<{ integration: string; error: string; details?: string; timestamp: Date } | null>(null);
  const [reportingIssue, setReportingIssue] = useState(false);

  // UPS-specific state (stored in carrier_configurations, not config_settings)
  const [upsConfig, setUpsConfig] = useState({
    enabled: false,
    is_sandbox: true,
    client_id: '',
    client_secret: '',
    account_number: '',
  });
  const [upsLoading, setUpsLoading] = useState(true);
  const [upsSaving, setUpsSaving] = useState(false);
  const [upsTestResult, setUpsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Derived: active ShipEngine key based on mode
  const activeShipEngineKey = formData.shipengine_mode === 'production'
    ? formData.shipengine_api_key_production
    : formData.shipengine_api_key_sandbox;

  // Initialize form data with defaults and loaded settings
  useEffect(() => {
    const integrationSettings = settings.integrations || {};
    const newFormData: Record<string, any> = {};

    Object.entries(DEFAULT_INTEGRATION_SETTINGS).forEach(([key, config]) => {
      newFormData[key] = integrationSettings[key] ?? config.value;
    });

    setFormData(newFormData);
  }, [settings]);

  // Load UPS config from carrier_configurations table
  useEffect(() => {
    async function loadUpsConfig() {
      try {
        const { data, error: fetchError } = await supabase
          .from('carrier_configurations')
          .select('*')
          .eq('carrier_code', 'ups_direct')
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error loading UPS config:', fetchError);
        }

        if (data) {
          setUpsConfig({
            enabled: data.is_enabled ?? false,
            is_sandbox: data.is_sandbox ?? true,
            client_id: data.api_credentials?.client_id || '',
            client_secret: data.api_credentials?.client_secret || '',
            account_number: data.api_credentials?.account_number || '',
          });
        }
      } catch (err) {
        console.error('Error loading UPS config:', err);
      } finally {
        setUpsLoading(false);
      }
    }

    loadUpsConfig();
  }, []);

  const updateUpsField = useCallback((key: keyof typeof upsConfig, value: any) => {
    setUpsConfig(prev => ({ ...prev, [key]: value }));
    setSaveMessage(null);
    setUpsTestResult(null);
  }, []);

  const saveUpsConfig = useCallback(async () => {
    setUpsSaving(true);
    try {
      const { error: upsertError } = await supabase
        .from('carrier_configurations')
        .upsert({
          carrier_code: 'ups_direct',
          carrier_name: 'UPS Direct',
          is_enabled: upsConfig.enabled,
          is_sandbox: upsConfig.is_sandbox,
          api_credentials: {
            client_id: upsConfig.client_id,
            client_secret: upsConfig.client_secret,
            account_number: upsConfig.account_number,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'carrier_code',
        });

      if (upsertError) throw upsertError;

      setSaveMessage('UPS configuration saved!');
      setTimeout(() => setSaveMessage(null), 3000);
      return true;
    } catch (err: any) {
      console.error('Error saving UPS config:', err);
      setSaveMessage(`Failed to save UPS config: ${err.message}`);
      return false;
    } finally {
      setUpsSaving(false);
    }
  }, [upsConfig]);

  const testUpsConnection = useCallback(async () => {
    setTestingConnection('UPS');
    setUpsTestResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ups-test-connection', {
        body: {
          client_id: upsConfig.client_id,
          client_secret: upsConfig.client_secret,
          account_number: upsConfig.account_number,
          is_sandbox: upsConfig.is_sandbox,
        },
      });

      if (invokeError) {
        setUpsTestResult({ success: false, message: invokeError.message || 'Connection test failed' });
        setSaveMessage(`UPS connection failed: ${invokeError.message}`);
        return;
      }

      if (data.success) {
        setUpsTestResult({ success: true, message: 'Connection successful!' });
        setSaveMessage('UPS connection successful!');

        // Update last_successful_call in carrier_configurations
        await supabase
          .from('carrier_configurations')
          .update({ last_successful_call: new Date().toISOString() })
          .eq('carrier_code', 'ups_direct');
      } else {
        setUpsTestResult({ success: false, message: data.error || 'Connection failed' });
        setSaveMessage(`UPS connection failed: ${data.error}`);
      }

      setTimeout(() => {
        setSaveMessage(null);
        setUpsTestResult(null);
      }, 5000);
    } catch (err: any) {
      setUpsTestResult({ success: false, message: err.message || 'Connection test failed' });
      setSaveMessage(`UPS test error: ${err.message}`);
    } finally {
      setTestingConnection(null);
    }
  }, [upsConfig]);

  const updateField = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    console.log('🔵 Save clicked');
    const settingsToSave: Record<string, { value: any; dataType: 'string' | 'number' | 'boolean' | 'json' }> = {};

    Object.entries(DEFAULT_INTEGRATION_SETTINGS).forEach(([key, config]) => {
      settingsToSave[key] = {
        value: formData[key],
        dataType: config.dataType,
      };
    });

    console.log('🔵 Saving data:', settingsToSave);
    const success = await bulkUpdate('integrations', settingsToSave);
    console.log('🔵 Save result:', success);

    if (success) {
      setSaveMessage('Settings saved!');
      setTimeout(() => setSaveMessage(null), 3000);
      refetch();
    } else {
      setSaveMessage('Failed to save settings. Check console for details.');
      setTimeout(() => setSaveMessage(null), 5000);
    }
  }, [formData, bulkUpdate, refetch]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const scrollToSection = useCallback((section: string) => {
    // Expand the section
    setExpandedSections(prev => ({ ...prev, [section]: true }));
    // Scroll to the section after a brief delay to allow expansion
    setTimeout(() => {
      const element = document.getElementById(`section-${section}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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
    console.log('🔵 testConnection called with:', integration);
    setTestingConnection(integration);
    setTestResult(null);

    // Map display name to integration key
    const integrationMap: Record<string, string> = {
      'Stripe': 'stripe',
      'Resend': 'resend',
      'ShipEngine': 'shipstation',
      'Trellis': 'trellis',
      'Gemini': 'gemini'
    };

    const integrationKey = integrationMap[integration] || integration.toLowerCase();
    console.log('🔵 Testing integration key:', integrationKey);

    try {
      const result = await testIntegrationConnection(integrationKey);
      console.log('🔵 Test result:', result);

      setTestingConnection(null);
      setTestResult(result);

      if (result.success) {
        setSaveMessage(`${integration} connection successful!`);
        setLastError(null);
        setTimeout(() => {
          setSaveMessage(null);
          setTestResult(null);
        }, 5000);
      } else {
        // Show detailed error with any additional details
        const detailsStr = result.details ? JSON.stringify(result.details) : undefined;
        const errorMsg = `${integration} failed: ${result.message}`;
        setSaveMessage(errorMsg + (detailsStr ? ` | Details: ${detailsStr}` : ''));
        setLastError({
          integration,
          error: result.message,
          details: detailsStr,
          timestamp: new Date()
        });
      }
    } catch (err: any) {
      console.error('🔴 testConnection error:', err);
      setTestingConnection(null);
      const errorMsg = err.message || String(err);
      setSaveMessage(`${integration} test error: ${errorMsg}`);
      setLastError({
        integration,
        error: errorMsg,
        timestamp: new Date()
      });
    }
  };

  const sendTestEmail = async () => {
    const recipient = testEmailAddress || formData.resend_from_email || 'test@example.com';
    console.log('🔵 sendTestEmail called');
    console.log('🔵 Sending to:', recipient);
    setTestingConnection('ResendEmail');

    try {
      const result = await sendEmail({
        to: recipient,
        subject: 'Test Email from ATL Urban Farms',
        html: '<h1>Test Email</h1><p>This is a test email from your ATL Urban Farms integration.</p>'
      });
      console.log('🔵 sendEmail result:', result);

      setTestingConnection(null);
      if (result.success) {
        setSaveMessage(`Test email sent to ${recipient}!`);
        setLastError(null);
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        // Show detailed error message
        const errorDetails = result.details ? ` (${result.details})` : '';
        setSaveMessage(`Failed to send email: ${result.error}${errorDetails}`);
        setLastError({
          integration: 'Resend Email',
          error: result.error || 'Unknown error',
          details: result.details,
          timestamp: new Date()
        });
      }
    } catch (err: any) {
      console.error('🔴 sendTestEmail error:', err);
      setTestingConnection(null);
      const errorMsg = err.message || String(err);
      setSaveMessage(`Failed to send email: ${errorMsg}`);
      setLastError({
        integration: 'Resend Email',
        error: errorMsg,
        timestamp: new Date()
      });
    }
  };

  const reportIssueToSupport = async () => {
    if (!lastError) return;

    setReportingIssue(true);
    try {
      // Check and refresh session if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          setSaveMessage('Session expired. Please log in again to report issues.');
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      const result = await sendEmail({
        to: 'team@sproutify.app',
        subject: `Integration Issue Report: ${lastError.integration}`,
        html: `
          <h2>Integration Issue Report</h2>
          <p><strong>Integration:</strong> ${lastError.integration}</p>
          <p><strong>Error:</strong> ${lastError.error}</p>
          ${lastError.details ? `<p><strong>Details:</strong> ${lastError.details}</p>` : ''}
          <p><strong>Timestamp:</strong> ${lastError.timestamp.toISOString()}</p>
          <hr/>
          <h3>User Info</h3>
          <p><strong>Email:</strong> ${user?.email || 'Unknown'}</p>
          <p><strong>User ID:</strong> ${user?.id || 'Unknown'}</p>
          <hr/>
          <p><em>This report was automatically generated from the ATL Urban Farms admin panel.</em></p>
        `
      });

      if (result.success) {
        setSaveMessage('Issue reported to support team!');
        setLastError(null);
      } else {
        setSaveMessage(`Failed to send report: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Failed to report issue:', err);
      setSaveMessage(`Failed to send report: ${err.message}`);
    } finally {
      setReportingIssue(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const triggerSync = async (integration: string) => {
    setSyncing(integration);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncing(null);
    setSaveMessage(`${integration} sync completed!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Calculate health metrics for each integration
  const getIntegrationHealth = (): Record<string, IntegrationHealth> => {
    const stripeStatus = getConnectionStatus(
      formData.stripe_enabled,
      !!(formData.stripe_publishable_key && formData.stripe_secret_key)
    );
    const activeShipEngineKey = formData.shipengine_mode === 'production'
      ? formData.shipengine_api_key_production
      : formData.shipengine_api_key_sandbox;
    const shipstationStatus = getConnectionStatus(
      formData.shipstation_enabled,
      !!activeShipEngineKey
    );
    const resendStatus = getConnectionStatus(
      formData.resend_enabled,
      !!formData.resend_api_key
    );
    const trellisStatus = getConnectionStatus(
      formData.trellis_enabled,
      !!(formData.trellis_api_endpoint && formData.trellis_api_key)
    );
    const geminiStatus = getConnectionStatus(
      formData.gemini_enabled,
      !!formData.gemini_api_key
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
      gemini: {
        status: getHealthStatus(geminiStatus),
        label: geminiStatus === 'connected' ? 'Connected' : geminiStatus === 'disconnected' ? 'Disabled' : 'Missing Credentials',
        metrics: [
          { label: 'Model', value: 'Gemini 1.5 Flash' },
          { label: 'Usage', value: 'Sage AI Assistant' },
        ],
      },
      ups: {
        status: getHealthStatus(
          getConnectionStatus(
            upsConfig.enabled,
            !!(upsConfig.client_id && upsConfig.client_secret && upsConfig.account_number)
          )
        ),
        label: upsConfig.enabled
          ? (upsConfig.client_id && upsConfig.client_secret && upsConfig.account_number)
            ? 'Connected'
            : 'Missing Credentials'
          : 'Disabled',
        metrics: [
          { label: 'Environment', value: upsConfig.is_sandbox ? 'Sandbox' : 'Production' },
          { label: 'Account', value: upsConfig.account_number ? `...${upsConfig.account_number.slice(-4)}` : 'Not set' },
        ],
      },
    };
  };

  const health = getIntegrationHealth();

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
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Integrations</h1>
            <p className="text-slate-500 text-sm mt-1">Connect and manage third-party services</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-emerald-600 font-medium text-sm"
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save All
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <HealthCard
            title="Stripe"
            icon={<CreditCard size={24} />}
            health={health.stripe}
            onClick={() => scrollToSection('stripe')}
          />
          <HealthCard
            title="ShipEngine"
            icon={<Package size={24} />}
            health={health.shipstation}
            onClick={() => scrollToSection('shipstation')}
          />
          <HealthCard
            title="Resend"
            icon={<Mail size={24} />}
            health={health.resend}
            onClick={() => scrollToSection('resend')}
          />
          <HealthCard
            title="Trellis"
            icon={<Leaf size={24} />}
            health={health.trellis}
            onClick={() => scrollToSection('trellis')}
          />
          <HealthCard
            title="Gemini AI"
            icon={<Bot size={24} />}
            health={health.gemini}
            onClick={() => scrollToSection('gemini')}
          />
          <HealthCard
            title="UPS Direct"
            icon={<Truck size={24} />}
            health={health.ups}
            onClick={() => scrollToSection('ups')}
          />
        </div>

        {/* Integration Detail Sections */}
        <div className="space-y-4">
          {/* STRIPE Section */}
          <IntegrationSection
            id="stripe"
            title="Stripe"
            icon={<CreditCard size={24} />}
            expanded={expandedSections.stripe}
            onToggle={() => toggleSection('stripe')}
            health={health.stripe}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable Stripe</h4>
                  <p className="text-sm text-slate-500">Process payments via Stripe</p>
                </div>
                <button
                  onClick={() => updateField('stripe_enabled', !formData.stripe_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.stripe_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.stripe_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
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
                <label className="block text-sm font-medium text-slate-600">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.stripe_webhook_url || ''}
                    onChange={(e) => updateField('stripe_webhook_url', e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="https://your-project.supabase.co/functions/v1/stripe-webhook"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(formData.stripe_webhook_url || '')}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500">Configure this URL in your Stripe Dashboard under Webhooks. Use your Supabase Edge Function URL.</p>
              </div>

              {/* Test Connection Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Stripe')}
                  disabled={testingConnection === 'Stripe' || !formData.stripe_secret_key}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Stripe' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {/* Recent Webhooks Table */}
              <EventsTable title="Recent Webhooks (Last 10)" events={MOCK_STRIPE_WEBHOOKS} />
            </div>
          </IntegrationSection>

          {/* SHIPENGINE Section */}
          <IntegrationSection
            id="shipstation"
            title="ShipEngine"
            icon={<Package size={24} />}
            expanded={expandedSections.shipstation}
            onToggle={() => toggleSection('shipstation')}
            health={health.shipstation}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable ShipEngine</h4>
                  <p className="text-sm text-slate-500">Sync orders and manage shipping via ShipEngine API</p>
                </div>
                <button
                  onClick={() => updateField('shipstation_enabled', !formData.shipstation_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.shipstation_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.shipstation_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Environment Mode Toggle */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-600">Environment</label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => updateField('shipengine_mode', 'sandbox')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.shipengine_mode !== 'production'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Sandbox
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('shipengine_mode', 'production')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.shipengine_mode === 'production'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Production
                  </button>
                </div>
                {formData.shipengine_mode !== 'production' && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <span>&#9888;</span> Sandbox mode returns estimated retail rates, not your negotiated Shipstation rates.
                  </p>
                )}
                {formData.shipengine_mode === 'production' && (
                  <p className="text-xs text-emerald-600">Using production API key with negotiated carrier rates.</p>
                )}
              </div>

              {/* Dual API Key Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`rounded-xl border-2 p-4 transition-colors ${
                  formData.shipengine_mode === 'production'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-slate-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {formData.shipengine_mode === 'production' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <span className="text-sm font-medium text-slate-700">Production Key</span>
                  </div>
                  <SecretInput
                    label=""
                    value={formData.shipengine_api_key_production || ''}
                    onChange={(v) => updateField('shipengine_api_key_production', v)}
                    placeholder="Your live ShipEngine API key"
                    helpText="From your ShipEngine dashboard (Shipstation-connected account)"
                  />
                </div>
                <div className={`rounded-xl border-2 p-4 transition-colors ${
                  formData.shipengine_mode !== 'production'
                    ? 'border-orange-300 bg-orange-50/50'
                    : 'border-slate-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {formData.shipengine_mode !== 'production' && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    )}
                    <span className="text-sm font-medium text-slate-700">Sandbox Key</span>
                  </div>
                  <SecretInput
                    label=""
                    value={formData.shipengine_api_key_sandbox || ''}
                    onChange={(v) => updateField('shipengine_api_key_sandbox', v)}
                    placeholder="TEST_... sandbox API key"
                    helpText="For testing (returns estimated retail rates)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600">Store ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.shipstation_store_id || ''}
                    onChange={(e) => updateField('shipstation_store_id', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="123456"
                  />
                  <p className="text-xs text-slate-500">Optional store identifier for order routing</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600">Last Sync</label>
                  <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                    {MOCK_SYNC_LOGS[0] ? formatTimestamp(MOCK_SYNC_LOGS[0].timestamp) : 'Never'}
                  </div>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${webhookBaseUrl}/shipengine`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${webhookBaseUrl}/shipengine`)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500">Configure this URL in ShipEngine Dashboard under Webhooks</p>
              </div>

              {/* Test Connection & Sync */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <div className="text-sm text-slate-500">Pending Orders</div>
                  <div className="text-2xl font-bold text-slate-800">3</div>
                </div>
                <button
                  onClick={() => testConnection('ShipEngine')}
                  disabled={testingConnection === 'ShipEngine' || !activeShipEngineKey}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'ShipEngine' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
                <button
                  onClick={() => triggerSync('ShipEngine')}
                  disabled={syncing === 'ShipEngine' || !activeShipEngineKey}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {syncing === 'ShipEngine' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
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
            icon={<Mail size={24} />}
            expanded={expandedSections.resend}
            onToggle={() => toggleSection('resend')}
            health={health.resend}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable Resend</h4>
                  <p className="text-sm text-slate-500">Send transactional emails via Resend</p>
                </div>
                <button
                  onClick={() => updateField('resend_enabled', !formData.resend_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.resend_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.resend_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
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
                  <label className="block text-sm font-medium text-slate-600">From Email</label>
                  <input
                    type="email"
                    value={formData.resend_from_email || ''}
                    onChange={(e) => updateField('resend_from_email', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="orders@yourdomain.com"
                  />
                  <p className="text-xs text-slate-500">Must be a verified domain in Resend</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600">From Name</label>
                  <input
                    type="text"
                    value={formData.resend_from_name || ''}
                    onChange={(e) => updateField('resend_from_name', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="ATL Urban Farms"
                  />
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Resend')}
                  disabled={testingConnection === 'Resend' || !formData.resend_api_key}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Resend' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {/* Send Test Email */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-slate-800 font-medium">Send Test Email</h4>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder={formData.resend_from_email || 'Enter email address'}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    onClick={sendTestEmail}
                    disabled={testingConnection === 'ResendEmail' || !formData.resend_api_key || !formData.resend_from_email}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {testingConnection === 'ResendEmail' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Leave empty to send to your configured From Email address</p>
              </div>

              {/* Recent Emails Table */}
              <EmailsTable title="Recent Emails (Last 10)" emails={MOCK_EMAILS} />
            </div>
          </IntegrationSection>

          {/* TRELLIS Section */}
          <IntegrationSection
            id="trellis"
            title="Trellis"
            icon={<Leaf size={24} />}
            expanded={expandedSections.trellis}
            onToggle={() => toggleSection('trellis')}
            health={health.trellis}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable Trellis</h4>
                  <p className="text-sm text-slate-500">Sync subscribers with Trellis marketing platform</p>
                </div>
                <button
                  onClick={() => updateField('trellis_enabled', !formData.trellis_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.trellis_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.trellis_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600">API Endpoint</label>
                  <input
                    type="url"
                    value={formData.trellis_api_endpoint || ''}
                    onChange={(e) => updateField('trellis_api_endpoint', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm text-slate-500">Subscribers Synced</div>
                  <div className="text-2xl font-bold text-slate-800">1,234</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm text-slate-500">Last Sync</div>
                  <div className="text-lg font-medium text-slate-800">2 hours ago</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
                  <button
                    onClick={() => triggerSync('Trellis')}
                    disabled={syncing === 'Trellis' || !formData.trellis_api_key}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {syncing === 'Trellis' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
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
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Trellis' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
              </div>
            </div>
          </IntegrationSection>

          {/* GEMINI AI Section */}
          <IntegrationSection
            id="gemini"
            title="Gemini AI (Sage)"
            icon={<Bot size={24} />}
            expanded={expandedSections.gemini}
            onToggle={() => toggleSection('gemini')}
            health={health.gemini}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable Sage AI</h4>
                  <p className="text-sm text-slate-500">Power the Sage gardening assistant with Google Gemini</p>
                </div>
                <button
                  onClick={() => updateField('gemini_enabled', !formData.gemini_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.gemini_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      formData.gemini_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <SecretInput
                label="Gemini API Key"
                value={formData.gemini_api_key || ''}
                onChange={(v) => updateField('gemini_api_key', v)}
                placeholder="AIza..."
                helpText="Get your API key from Google AI Studio (aistudio.google.com)"
              />

              {/* Info Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-2">About Sage AI</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Sage is your AI-powered gardening assistant. It helps customers choose the right plants based on their sunlight, space, and experience level.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Model:</span>
                    <span className="text-slate-700 ml-2">Gemini 1.5 Flash</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Usage:</span>
                    <span className="text-slate-700 ml-2">Customer Chat Widget</span>
                  </div>
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Gemini')}
                  disabled={testingConnection === 'Gemini' || !formData.gemini_api_key}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Gemini' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
              </div>
            </div>
          </IntegrationSection>

          {/* UPS DIRECT Section */}
          <IntegrationSection
            id="ups"
            title="UPS Direct"
            icon={<Truck size={24} />}
            expanded={expandedSections.ups}
            onToggle={() => toggleSection('ups')}
            health={health.ups}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Enable UPS Direct</h4>
                  <p className="text-sm text-slate-500">Get real-time shipping rates directly from UPS</p>
                </div>
                <button
                  onClick={() => updateUpsField('enabled', !upsConfig.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    upsConfig.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      upsConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Environment Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-slate-800 font-medium">Environment</h4>
                  <p className="text-sm text-slate-500">
                    {upsConfig.is_sandbox ? 'Using sandbox/test API' : 'Using production API'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${upsConfig.is_sandbox ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                    Sandbox
                  </span>
                  <button
                    onClick={() => updateUpsField('is_sandbox', !upsConfig.is_sandbox)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      !upsConfig.is_sandbox ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        !upsConfig.is_sandbox ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className={`text-sm ${!upsConfig.is_sandbox ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    Production
                  </span>
                </div>
              </div>

              {/* Credentials */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">Client ID</label>
                <input
                  type="text"
                  value={upsConfig.client_id}
                  onChange={(e) => updateUpsField('client_id', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Your UPS Client ID"
                />
                <p className="text-xs text-slate-500">OAuth Client ID from UPS Developer Portal</p>
              </div>

              <SecretInput
                label="Client Secret"
                value={upsConfig.client_secret}
                onChange={(v) => updateUpsField('client_secret', v)}
                placeholder="Your UPS Client Secret"
                helpText="OAuth Client Secret from UPS Developer Portal"
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">Account Number</label>
                <input
                  type="text"
                  value={upsConfig.account_number}
                  onChange={(e) => updateUpsField('account_number', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Your 6-digit UPS Account Number"
                />
                <p className="text-xs text-slate-500">Your UPS shipper account number</p>
              </div>

              {/* Test Result */}
              <AnimatePresence>
                {upsTestResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-4 rounded-xl border ${
                      upsTestResult.success
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {upsTestResult.success ? (
                        <CheckCircle size={20} className="text-emerald-600" />
                      ) : (
                        <AlertCircle size={20} className="text-red-600" />
                      )}
                      <span className={upsTestResult.success ? 'text-emerald-700' : 'text-red-700'}>
                        {upsTestResult.message}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Test Connection & Save Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={testUpsConnection}
                  disabled={testingConnection === 'UPS' || !upsConfig.client_id || !upsConfig.client_secret || !upsConfig.account_number}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'UPS' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Test Connection
                    </>
                  )}
                </button>
                <button
                  onClick={saveUpsConfig}
                  disabled={upsSaving}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {upsSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save UPS Config
                    </>
                  )}
                </button>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-2">About UPS Direct Integration</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Connect directly to UPS APIs for real-time shipping rates. This integration requires a UPS Developer account and OAuth credentials.
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://developer.ups.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    UPS Developer Portal
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </IntegrationSection>
        </div>
      </div>

      {/* Fixed Toast Notification */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-lg z-50 flex flex-col gap-3 max-w-md relative ${
              !saveMessage.includes('failed') && !saveMessage.includes('Failed') && !saveMessage.includes('error')
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setSaveMessage(null);
                setLastError(null);
              }}
              className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 pr-6">
              {!saveMessage.includes('failed') && !saveMessage.includes('Failed') && !saveMessage.includes('error') ? (
                <Check size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span className="font-medium text-sm">{saveMessage}</span>
            </div>
            {/* Report Issue Button - only show for errors */}
            {lastError && (saveMessage.includes('failed') || saveMessage.includes('Failed') || saveMessage.includes('error')) && (
              <button
                onClick={reportIssueToSupport}
                disabled={reportingIssue}
                className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reportingIssue ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Report...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Report Issue to Support
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPageWrapper>
  );
};

export default IntegrationsPage;
