import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useSettings, useBulkUpdateSettings } from '../hooks/useSettings';
import { useTestIntegration, useEmailService } from '../../hooks/useIntegrations';
import { supabase } from '../../lib/supabase';

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
  <div id={`section-${id}`} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
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
));
IntegrationSection.displayName = 'IntegrationSection';

// Webhook/Events Table Component - moved outside
const EventsTable = memo<{
  title: string;
  events: WebhookEvent[];
}>(({ title, events }) => (
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
));
EventsTable.displayName = 'EventsTable';

// Email Log Table Component - moved outside
const EmailsTable = memo<{
  title: string;
  emails: EmailLog[];
}>(({ title, emails }) => (
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
));
EmailsTable.displayName = 'EmailsTable';

// Sync Log Table Component - moved outside
const SyncLogTable = memo<{
  title: string;
  logs: SyncLog[];
}>(({ title, logs }) => (
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
  shipengine_api_key: { value: '', dataType: 'string' as const },
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
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [lastError, setLastError] = useState<{ integration: string; error: string; details?: string; timestamp: Date } | null>(null);
  const [reportingIssue, setReportingIssue] = useState(false);

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
    const shipstationStatus = getConnectionStatus(
      formData.shipstation_enabled,
      !!formData.shipengine_api_key
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <HealthCard
            title="Stripe"
            icon={<span>💳</span>}
            health={health.stripe}
            onClick={() => scrollToSection('stripe')}
          />
          <HealthCard
            title="ShipEngine"
            icon={<span>📦</span>}
            health={health.shipstation}
            onClick={() => scrollToSection('shipstation')}
          />
          <HealthCard
            title="Resend"
            icon={<span>📧</span>}
            health={health.resend}
            onClick={() => scrollToSection('resend')}
          />
          <HealthCard
            title="Trellis"
            icon={<span>🌱</span>}
            health={health.trellis}
            onClick={() => scrollToSection('trellis')}
          />
          <HealthCard
            title="Gemini AI"
            icon={<span>🤖</span>}
            health={health.gemini}
            onClick={() => scrollToSection('gemini')}
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
                    value={formData.stripe_webhook_url || ''}
                    onChange={(e) => updateField('stripe_webhook_url', e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://your-project.supabase.co/functions/v1/stripe-webhook"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(formData.stripe_webhook_url || '')}
                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-400">Configure this URL in your Stripe Dashboard under Webhooks. Use your Supabase Edge Function URL.</p>
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

          {/* SHIPENGINE Section */}
          <IntegrationSection
            id="shipstation"
            title="ShipEngine"
            icon={<span>📦</span>}
            expanded={expandedSections.shipstation}
            onToggle={() => toggleSection('shipstation')}
            health={health.shipstation}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable ShipEngine</h4>
                  <p className="text-sm text-slate-400">Sync orders and manage shipping via ShipEngine API</p>
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

              <SecretInput
                label="API Key"
                value={formData.shipengine_api_key || ''}
                onChange={(v) => updateField('shipengine_api_key', v)}
                placeholder="TEST_... or your production API key"
                helpText="Get your API key from ShipEngine Dashboard (shipengine.com)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Store ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.shipstation_store_id || ''}
                    onChange={(e) => updateField('shipstation_store_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="123456"
                  />
                  <p className="text-xs text-slate-400">Optional store identifier for order routing</p>
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
                    value={`${webhookBaseUrl}/shipengine`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-400 font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${webhookBaseUrl}/shipengine`)}
                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-400">Configure this URL in ShipEngine Dashboard under Webhooks</p>
              </div>

              {/* Test Connection & Sync */}
              <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="flex-1">
                  <div className="text-sm text-slate-400">Pending Orders</div>
                  <div className="text-2xl font-bold text-white">3</div>
                </div>
                <button
                  onClick={() => testConnection('ShipEngine')}
                  disabled={testingConnection === 'ShipEngine' || !formData.shipengine_api_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'ShipEngine' ? (
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
                <button
                  onClick={() => triggerSync('ShipEngine')}
                  disabled={syncing === 'ShipEngine' || !formData.shipengine_api_key}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {syncing === 'ShipEngine' ? (
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

              {/* Test Connection Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Resend')}
                  disabled={testingConnection === 'Resend' || !formData.resend_api_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Resend' ? (
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

              {/* Send Test Email */}
              <div className="p-4 bg-slate-700/50 rounded-lg space-y-3">
                <h4 className="text-white font-medium">Send Test Email</h4>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder={formData.resend_from_email || 'Enter email address'}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendTestEmail}
                    disabled={testingConnection === 'ResendEmail' || !formData.resend_api_key || !formData.resend_from_email}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {testingConnection === 'ResendEmail' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400">Leave empty to send to your configured From Email address</p>
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

          {/* GEMINI AI Section */}
          <IntegrationSection
            id="gemini"
            title="Gemini AI (Sage)"
            icon={<span>🤖</span>}
            expanded={expandedSections.gemini}
            onToggle={() => toggleSection('gemini')}
            health={health.gemini}
          >
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable Sage AI</h4>
                  <p className="text-sm text-slate-400">Power the Sage gardening assistant with Google Gemini</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.gemini_enabled ?? false}
                    onChange={(e) => updateField('gemini_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <SecretInput
                label="Gemini API Key"
                value={formData.gemini_api_key || ''}
                onChange={(v) => updateField('gemini_api_key', v)}
                placeholder="AIza..."
                helpText="Get your API key from Google AI Studio (aistudio.google.com)"
              />

              {/* Info Box */}
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <h4 className="text-sm font-medium text-slate-300 mb-2">About Sage AI</h4>
                <p className="text-xs text-slate-400 mb-3">
                  Sage is your AI-powered gardening assistant. It helps customers choose the right plants based on their sunlight, space, and experience level.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Model:</span>
                    <span className="text-slate-300 ml-2">Gemini 1.5 Flash</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Usage:</span>
                    <span className="text-slate-300 ml-2">Customer Chat Widget</span>
                  </div>
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex gap-3">
                <button
                  onClick={() => testConnection('Gemini')}
                  disabled={testingConnection === 'Gemini' || !formData.gemini_api_key}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {testingConnection === 'Gemini' ? (
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

      {/* Fixed Toast Notification */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-lg z-50 flex flex-col gap-3 max-w-md ${
              !saveMessage.includes('failed') && !saveMessage.includes('Failed') && !saveMessage.includes('error')
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {!saveMessage.includes('failed') && !saveMessage.includes('Failed') && !saveMessage.includes('error') ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-medium text-sm">{saveMessage}</span>
            </div>
            {/* Report Issue Button - only show for errors */}
            {lastError && (saveMessage.includes('failed') || saveMessage.includes('Failed') || saveMessage.includes('error')) && (
              <button
                onClick={reportIssueToSupport}
                disabled={reportingIssue}
                className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reportingIssue ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Report...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
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
