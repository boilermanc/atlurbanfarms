import React from 'react';
import { useWooImportStats, useWooCustomerCount, useLegacyOrderItemsCount, useLegacyOrdersCount } from '../../hooks/useWooImport';
import {
  Users,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Terminal,
  Database,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';

interface WooImportDashboardProps {
  onViewHistory: () => void;
}

const WooImportDashboard: React.FC<WooImportDashboardProps> = ({ onViewHistory }) => {
  const { stats, loading: statsLoading, error: statsError, refetch } = useWooImportStats();
  const { count: customerCount, loading: customerLoading } = useWooCustomerCount();
  const { count: lineItemsCount, loading: lineItemsLoading } = useLegacyOrderItemsCount();
  const { count: ordersCount, loading: ordersLoading } = useLegacyOrdersCount();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
            <CheckCircle size={14} />
            Completed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
            <Loader2 size={14} className="animate-spin" />
            Running
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
            <AlertCircle size={14} />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
            No imports yet
          </span>
        );
    }
  };

  if (statsLoading || customerLoading || lineItemsLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        <p className="font-medium">Error loading stats</p>
        <p className="text-sm mt-1">{statsError}</p>
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Customers Imported */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-5 border border-emerald-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg">
              <Users size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-emerald-600 font-medium">Customers Synced</p>
              <p className="text-2xl font-bold text-emerald-800">
                {customerCount?.withWooId.toLocaleString() || 0}
              </p>
              <p className="text-xs text-emerald-600/70 mt-0.5">
                of {customerCount?.total.toLocaleString() || 0} total
              </p>
            </div>
          </div>
        </div>

        {/* Total Orders Imported */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Orders Imported</p>
              <p className="text-2xl font-bold text-blue-800">
                {ordersCount.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600/70 mt-0.5">legacy orders</p>
            </div>
          </div>
        </div>

        {/* Total Line Items Imported */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-5 border border-amber-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg">
              <ShoppingCart size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Line Items</p>
              <p className="text-2xl font-bold text-amber-800">
                {lineItemsCount.toLocaleString()}
              </p>
              <p className="text-xs text-amber-600/70 mt-0.5">order products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Last Import Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg">
              <Clock size={20} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Last Import</p>
              <p className="text-lg font-semibold text-slate-800">
                {formatDate(stats?.lastImportDate || null)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg">
              <Database size={20} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Status</p>
              <div className="mt-1">
                {getStatusBadge(stats?.lastImportStatus || null)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/60">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Quick Reference</h3>

        <div className="space-y-4">
          {/* SSH Command */}
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-2">
              <Terminal size={14} />
              SSH Connection
            </div>
            <code className="text-sm text-slate-300 font-mono">
              ssh atlurbanfarms.com_rjv10m6w4t@great-banach
            </code>
          </div>

          {/* Import Commands */}
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-2">
              <Terminal size={14} />
              Import Commands
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">Check status:</p>
                <code className="text-sm text-slate-300 font-mono">
                  cd ~/woo-import-service && node run-import.js stats
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Import customers:</p>
                <code className="text-sm text-slate-300 font-mono">
                  node run-import.js customers 2026-01-01
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Import orders:</p>
                <code className="text-sm text-slate-300 font-mono">
                  node run-import.js orders 2026-01-01
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Import line items:</p>
                <code className="text-sm text-slate-300 font-mono">
                  node run-import.js lineitems
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Full sync:</p>
                <code className="text-sm text-slate-300 font-mono">
                  node run-import.js full
                </code>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onViewHistory}
          className="mt-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
        >
          View import history
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Running Imports Alert */}
      {stats?.runningImports && stats.runningImports > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-800">Import in Progress</p>
              <p className="text-sm text-blue-600 mt-0.5">
                {stats.runningImports} import{stats.runningImports > 1 ? 's' : ''} currently running.
                Check history for details.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WooImportDashboard;
