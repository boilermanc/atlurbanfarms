import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import AuditDetailModal from '../components/AuditDetailModal';
import { supabase } from '../../lib/supabase';

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
      const { data, error: fetchError } = await supabase
        .from('config_audit_log')
        .select('changed_by, changed_by_email')
        .not('changed_by', 'is', null);

      if (fetchError) throw fetchError;

      // Get unique users
      const uniqueUsers = new Map<string, AdminUser>();
      (data || []).forEach(entry => {
        if (entry.changed_by && entry.changed_by_email) {
          uniqueUsers.set(entry.changed_by, {
            id: entry.changed_by,
            email: entry.changed_by_email
          });
        }
      });

      setAdminUsers(Array.from(uniqueUsers.values()));
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
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
        query = query.eq('changed_by', userFilter);
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

      setAuditEntries(data || []);
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
      create: 'bg-emerald-500/20 text-emerald-400',
      update: 'bg-blue-500/20 text-blue-400',
      delete: 'bg-red-500/20 text-red-400'
    };
    return styles[action as keyof typeof styles] || 'bg-slate-500/20 text-slate-400';
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
      if (userFilter !== 'all') query = query.eq('changed_by', userFilter);
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
      const rows = data.map(entry => [
        entry.created_at,
        entry.changed_by_email || 'System',
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
        <div className="text-sm text-slate-400">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  ? 'bg-emerald-600 text-white'
                  : typeof page === 'number'
                  ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                  : 'text-slate-500 cursor-default'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h1 className="text-2xl font-bold text-white">Audit Log</h1>
            <p className="text-slate-400 mt-1">
              {totalCount} {totalCount === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAuditEntries}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Table Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Table
              </label>
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {TABLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                User
              </label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Users</option>
                {adminUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Date To */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700">
              <span className="text-sm text-slate-400">Active filters:</span>
              {tableFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  Table: {TABLE_OPTIONS.find(o => o.value === tableFilter)?.label}
                  <button onClick={() => setTableFilter('all')} className="hover:text-emerald-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {actionFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  Action: {actionFilter}
                  <button onClick={() => setActionFilter('all')} className="hover:text-emerald-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {userFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  User: {adminUsers.find(u => u.id === userFilter)?.email}
                  <button onClick={() => setUserFilter('all')} className="hover:text-emerald-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  From: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-emerald-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  To: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-emerald-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : auditEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {hasActiveFilters ? (
                <>
                  <p>No audit entries match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-emerald-400 hover:text-emerald-300"
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
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Timestamp
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      User
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Table
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Record ID
                    </th>
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Action
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Field
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Old Value
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      New Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {auditEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {entry.changed_by_email || (
                          <span className="text-slate-500 italic">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                          {entry.table_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {entry.record_id.length > 20
                          ? entry.record_id.substring(0, 20) + '...'
                          : entry.record_id}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getActionBadge(entry.action)}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {entry.field_changed || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm max-w-[150px] truncate">
                        {formatValue(entry.old_value)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm max-w-[150px] truncate">
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
