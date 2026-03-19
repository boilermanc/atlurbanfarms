import React, { useState } from 'react';
import { usePurchaseOrders, usePOStats, useUpdatePOStatus } from '../hooks/usePurchaseOrders';
import { POStatus, PO_STATUS_CONFIG, PO_STATUSES } from '../types/purchaseOrders';

interface PurchaseOrdersPageProps {
  onViewOrder?: (orderId: string) => void;
}

const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({ onViewOrder }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const { orders, totalCount, totalPages, loading, error, refetch } = usePurchaseOrders({
    search,
    poStatus: statusFilter,
    page,
  });
  const { stats, refetch: refetchStats } = usePOStats();
  const { updateStatus, loading: updating } = useUpdatePOStatus();

  const handleStatusUpdate = async (orderId: string, newStatus: POStatus) => {
    const success = await updateStatus(orderId, newStatus);
    if (success) {
      refetch();
      refetchStats();
    }
  };

  const getCustomerName = (order: any) => {
    if (order.customers) {
      const { first_name, last_name, company } = order.customers;
      const name = [first_name, last_name].filter(Boolean).join(' ');
      return company ? `${name} (${company})` : name || order.customers.email;
    }
    return order.guest_email || '—';
  };

  const getNextStatuses = (current: POStatus): POStatus[] => {
    switch (current) {
      case 'pending_verification': return ['verified', 'cancelled'];
      case 'verified': return ['invoiced', 'cancelled'];
      case 'invoiced': return ['paid', 'cancelled'];
      case 'paid': return [];
      case 'cancelled': return ['pending_verification'];
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {PO_STATUSES.filter(s => s !== 'cancelled').map(status => {
          const config = PO_STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(statusFilter === status ? 'all' : status);
                setPage(1);
              }}
              className={`p-4 rounded-xl border transition-all text-left ${
                statusFilter === status
                  ? `${config.bgColor} ${config.borderColor} border-2`
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <p className="text-2xl font-bold text-gray-900">
                {stats[status]}
              </p>
              <p className={`text-xs font-bold uppercase tracking-widest ${config.color}`}>
                {config.label}
              </p>
            </button>
          );
        })}
        <div className="p-4 rounded-xl bg-white border border-gray-100">
          <p className="text-2xl font-bold text-gray-900">
            ${stats.total_value.toFixed(2)}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Total PO Value
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by order #, PO #, or customer..."
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as POStatus | 'all'); setPage(1); }}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">All Statuses</option>
          {PO_STATUSES.map(s => (
            <option key={s} value={s}>{PO_STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">
              {search || statusFilter !== 'all'
                ? 'No purchase orders match your filters.'
                : 'No purchase orders yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">PO #</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const statusConfig = PO_STATUS_CONFIG[order.po_status] || PO_STATUS_CONFIG.pending_verification;
                  const nextStatuses = getNextStatuses(order.po_status);

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onViewOrder?.(order.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-emerald-600">
                          #{order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {order.po_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {getCustomerName(order)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-gray-900">
                          ${Number(order.total).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor} border`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {nextStatuses.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleStatusUpdate(order.id, e.target.value as POStatus);
                              }
                            }}
                            disabled={updating}
                            className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="">Update →</option>
                            {nextStatuses.map(s => (
                              <option key={s} value={s}>{PO_STATUS_CONFIG[s].label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
