import React from 'react';
import { X, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';

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
      create: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Created' },
      update: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Updated' },
      delete: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Deleted' }
    };
    return config[action as keyof typeof config] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: action };
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${actionConfig.bg}`}>
              {entry.action === 'create' && <Plus size={20} className={actionConfig.text} />}
              {entry.action === 'update' && <Edit2 size={20} className={actionConfig.text} />}
              {entry.action === 'delete' && <Trash2 size={20} className={actionConfig.text} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Audit Entry Details</h2>
              <p className="text-slate-500 text-sm mt-0.5">{formatTimestamp(entry.created_at)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Action</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${actionConfig.bg} ${actionConfig.text} ${actionConfig.border}`}>
                {actionConfig.label}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Table</label>
              <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-700">
                {entry.table_name}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Record ID</label>
              <span className="font-mono text-sm text-slate-600 break-all">{entry.record_id}</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Changed By</label>
              <span className="text-sm text-slate-800">{entry.changed_by_email || <span className="text-slate-400 italic">System</span>}</span>
            </div>
          </div>

          {/* Field Changed */}
          {entry.field_changed && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Field Changed</label>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="font-mono text-sm text-emerald-600">{entry.field_changed}</span>
              </div>
            </div>
          )}

          {/* Old Value */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Old Value</label>
            <div className="bg-slate-50 rounded-xl p-4 overflow-x-auto border border-slate-200">
              <pre className="font-mono text-sm text-red-600 whitespace-pre-wrap break-words">
                {formatJson(entry.old_value)}
              </pre>
            </div>
          </div>

          {/* New Value */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">New Value</label>
            <div className="bg-slate-50 rounded-xl p-4 overflow-x-auto border border-slate-200">
              <pre className="font-mono text-sm text-emerald-600 whitespace-pre-wrap break-words">
                {formatJson(entry.new_value)}
              </pre>
            </div>
          </div>

          {/* Metadata (if present) */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Additional Metadata</label>
              <div className="bg-slate-50 rounded-xl p-4 overflow-x-auto border border-slate-200">
                <pre className="font-mono text-sm text-slate-600 whitespace-pre-wrap break-words">
                  {formatJson(entry.metadata)}
                </pre>
              </div>
            </div>
          )}

          {/* Link to Record */}
          {recordLink && entry.action !== 'delete' && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Affected Record</label>
              <a
                href={recordLink}
                className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <span>View Record</span>
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditDetailModal;
