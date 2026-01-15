import React from 'react';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  field_changed: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface AuditDetailModalProps {
  entry: AuditEntry;
  onClose: () => void;
}

// Map table names to admin routes
const TABLE_ROUTES: Record<string, string> = {
  products: '/admin/products',
  product_categories: '/admin/categories',
  orders: '/admin/orders',
  customers: '/admin/customers',
  shipping_zones: '/admin/shipping-zones',
  shipping_services: '/admin/shipping-services',
  faq_items: '/admin/faq',
  content_pages: '/admin/content-pages',
  feature_flags: '/admin/feature-flags',
  config_settings: '/admin/settings',
};

const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ entry, onClose }) => {
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format JSON for display
  const formatJson = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  // Get action badge styles
  const getActionBadge = (action: string) => {
    const config = {
      create: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Created' },
      update: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Updated' },
      delete: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Deleted' }
    };
    return config[action as keyof typeof config] || { bg: 'bg-slate-500/20', text: 'text-slate-400', label: action };
  };

  // Get link to affected record
  const getRecordLink = () => {
    const baseRoute = TABLE_ROUTES[entry.table_name];
    if (!baseRoute) return null;

    // For tables with detail pages, construct the link
    if (['orders', 'customers', 'products'].includes(entry.table_name)) {
      return `${baseRoute}/${entry.record_id}`;
    }

    // For other tables, just link to the list page
    return baseRoute;
  };

  const actionConfig = getActionBadge(entry.action);
  const recordLink = getRecordLink();

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
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${actionConfig.bg}`}>
              {entry.action === 'create' && (
                <svg className={`w-5 h-5 ${actionConfig.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {entry.action === 'update' && (
                <svg className={`w-5 h-5 ${actionConfig.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
              {entry.action === 'delete' && (
                <svg className={`w-5 h-5 ${actionConfig.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Audit Entry Details</h2>
              <p className="text-slate-400 text-sm mt-0.5">{formatTimestamp(entry.created_at)}</p>
            </div>
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
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Action</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${actionConfig.bg} ${actionConfig.text}`}>
                {actionConfig.label}
              </span>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Table</label>
              <span className="font-mono text-sm bg-slate-700 px-2 py-1 rounded text-white">
                {entry.table_name}
              </span>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Record ID</label>
              <span className="font-mono text-sm text-slate-300 break-all">{entry.record_id}</span>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Changed By</label>
              <span className="text-sm text-white">{entry.changed_by_email || <span className="text-slate-500 italic">System</span>}</span>
            </div>
          </div>

          {/* Field Changed */}
          {entry.field_changed && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Field Changed</label>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <span className="font-mono text-sm text-emerald-400">{entry.field_changed}</span>
              </div>
            </div>
          )}

          {/* Old Value */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Old Value</label>
            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
              <pre className="font-mono text-sm text-red-400 whitespace-pre-wrap break-words">
                {formatJson(entry.old_value)}
              </pre>
            </div>
          </div>

          {/* New Value */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Value</label>
            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
              <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap break-words">
                {formatJson(entry.new_value)}
              </pre>
            </div>
          </div>

          {/* Metadata (if present) */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Additional Metadata</label>
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap break-words">
                  {formatJson(entry.metadata)}
                </pre>
              </div>
            </div>
          )}

          {/* Link to Record */}
          {recordLink && entry.action !== 'delete' && (
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Affected Record</label>
              <a
                href={recordLink}
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>View Record</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end bg-slate-800/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditDetailModal;
