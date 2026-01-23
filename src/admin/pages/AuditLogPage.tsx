import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import AuditDetailModal from '../components/AuditDetailModal';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Download, X } from 'lucide-react';

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

interface AdminUser {
  id: string;
  email: string;
}

const ITEMS_PER_PAGE = 50;

const TABLE_OPTIONS = [
  { value: 'all', label: 'All Tables' },
  { value: 'config_settings', label: 'Config Settings' },
  { value: 'feature_flags', label: 'Feature Flags' },
  { value: 'products', label: 'Products' },
  { value: 'product_categories', label: 'Product Categories' },
  { value: 'orders', label: 'Orders' },
  { value: 'customers', label: 'Customers' },
  { value: 'shipping_zones', label: 'Shipping Zones' },
  { value: 'shipping_services', label: 'Shipping Services' },
  { value: 'faq_items', label: 'FAQ Items' },
  { value: 'content_pages', label: 'Content Pages' },
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
];

const AuditLogPage: React.FC = () => {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  // Fetch admin users for filter dropdown
  const fetchAdminUsers = useCallback(async () => {
    try {
      // First, get a sample row to check available columns
      const { data: sampleData, error: sampleError } = await supabase
        .from('config_audit_log')
        .select('*')
        .limit(1);

      if (sampleError) throw sampleError;

      // Check which user columns exist
      const hasChangedBy = sampleData?.[0] && 'changed_by' in sampleData[0];
      const hasUserId = sampleData?.[0] && 'user_id' in sampleData[0];

      if (!hasChangedBy && !hasUserId) {
        // No user tracking columns exist, skip user filtering
        setAdminUsers([]);
        return;
      }

      const userIdColumn = hasChangedBy ? 'changed_by' : 'user_id';
      const userEmailColumn = hasChangedBy ? 'changed_by_email' : 'user_email';

      const { data, error: fetchError } = await supabase
        .from('config_audit_log')
        .select('*')
        .not(userIdColumn, 'is', null);

      if (fetchError) throw fetchError;

      // Get unique users
      const uniqueUsers = new Map<string, AdminUser>();
      (data || []).forEach((entry: Record<string, unknown>) => {
        const userId = entry[userIdColumn] as string | undefined;
        const userEmail = entry[userEmailColumn] as string | undefined;
        if (userId && userEmail) {
          uniqueUsers.set(userId, {
            id: userId,
            email: userEmail
          });
        }
      });

      setAdminUsers(Array.from(uniqueUsers.values()));
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
      setAdminUsers([]);
    }
  }, []);

  // Fetch audit entries
  const fetchAuditEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('config_audit_log')
        .select('*', { count: 'exact' });

      // Apply filters
      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (userFilter !== 'all') {
        // Try both column names for user filtering
        query = query.or(`changed_by.eq.${userFilter},user_id.eq.${userFilter}`);
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      // Pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      // Normalize data to use consistent property names
      const normalizedData = (data || []).map((entry: Record<string, unknown>) => ({
        id: entry.id as string,
        table_name: entry.table_name as string,
        record_id: entry.record_id as string,
        action: entry.action as 'create' | 'update' | 'delete',
        field_changed: entry.field_changed as string | null,
        old_value: entry.old_value,
        new_value: entry.new_value,
        changed_by: (entry.changed_by || entry.user_id) as string | null,
        changed_by_email: (entry.changed_by_email || entry.user_email) as string | null,
        created_at: entry.created_at as string,
        metadata: entry.metadata as Record<string, unknown> | null,
      }));

      setAuditEntries(normalizedData);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [tableFilter, actionFilter, userFilter, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  useEffect(() => {
    fetchAuditEntries();
  }, [fetchAuditEntries]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tableFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Check if any filters are active
  const hasActiveFilters = tableFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo;

  // Clear all filters
  const clearFilters = () => {
    setTableFilter('all');
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format value for display (truncate if too long)
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  // Get action badge styles
  const getActionBadge = (action: string) => {
    const styles = {
      create: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      update: 'bg-blue-100 text-blue-700 border-blue-200',
      delete: 'bg-red-100 text-red-700 border-red-200'
    };
    return styles[action as keyof typeof styles] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // Export to CSV
  const exportToCSV = useCallback(async () => {
    try {
      // Fetch all entries with current filters (without pagination)
      let query = supabase
        .from('config_audit_log')
        .select('*');

      if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (userFilter !== 'all') query = query.or(`changed_by.eq.${userFilter},user_id.eq.${userFilter}`);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      // Create CSV content
      const headers = ['Timestamp', 'User', 'Table', 'Record ID', 'Action', 'Field Changed', 'Old Value', 'New Value'];
      const rows = data.map((entry: Record<string, unknown>) => [
        entry.created_at,
        (entry.changed_by_email || entry.user_email || 'System') as string,
        entry.table_name,
        entry.record_id,
        entry.action,
        entry.field_changed || '',
        JSON.stringify(entry.old_value),
        JSON.stringify(entry.new_value)
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }, [tableFilter, actionFilter, userFilter, dateFrom, dateTo]);

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (showEllipsisStart) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (showEllipsisEnd) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
        <div className="text-sm text-slate-500">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && setCurrentPage(page)}
              disabled={typeof page !== 'number'}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                page === currentPage
                  ? 'bg-emerald-500 text-white'
                  : typeof page === 'number'
                  ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                  : 'text-slate-400 cursor-default'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Audit Log</h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalCount} {totalCount === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAuditEntries}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Table Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Table
              </label>
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {TABLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                User
              </label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="all">All Users</option>
                {adminUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Date To */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200">
              <span className="text-sm text-slate-500">Active filters:</span>
              {tableFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  Table: {TABLE_OPTIONS.find(o => o.value === tableFilter)?.label}
                  <button onClick={() => setTableFilter('all')} className="hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </span>
              )}
              {actionFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  Action: {actionFilter}
                  <button onClick={() => setActionFilter('all')} className="hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </span>
              )}
              {userFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  User: {adminUsers.find(u => u.id === userFilter)?.email}
                  <button onClick={() => setUserFilter('all')} className="hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  From: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  To: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-emerald-900">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : auditEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {hasActiveFilters ? (
                <>
                  <p>No audit entries match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-emerald-600 hover:text-emerald-700"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <p>No audit log entries yet.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Timestamp
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      User
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Table
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Record ID
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Action
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Field
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Old Value
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      New Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="px-4 py-3 text-slate-600 text-sm whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {entry.changed_by_email || (
                          <span className="text-slate-400 italic">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                          {entry.table_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {entry.record_id.length > 20
                          ? entry.record_id.substring(0, 20) + '...'
                          : entry.record_id}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize border ${getActionBadge(entry.action)}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {entry.field_changed || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm max-w-[150px] truncate">
                        {formatValue(entry.old_value)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm max-w-[150px] truncate">
                        {formatValue(entry.new_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && auditEntries.length > 0 && <Pagination />}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <AuditDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </AdminPageWrapper>
  );
};

export default AuditLogPage;
