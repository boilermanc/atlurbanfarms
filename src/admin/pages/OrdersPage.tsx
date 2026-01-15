import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useOrders, ORDER_STATUSES, ORDER_STATUS_CONFIG, OrderStatus } from '../hooks/useOrders';

interface OrdersPageProps {
  onViewOrder: (orderId: string) => void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onViewOrder }) => {

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Build filters object
  const filters = useMemo(() => ({
    status: statusFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: searchTerm || undefined,
    page: currentPage,
    perPage: 20,
  }), [statusFilter, dateFrom, dateTo, searchTerm, currentPage]);

  // Fetch orders
  const { orders, totalCount, totalPages, loading, error, refetch } = useOrders(filters);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setSearchInput('');
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || dateFrom || dateTo || searchTerm;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus] || {
      label: status,
      color: 'bg-slate-500',
    };
    return (
      <span className={`${config.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
        {config.label}
      </span>
    );
  };

  // Navigate to order detail
  const handleRowClick = (orderId: string) => {
    onViewOrder(orderId);
  };

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
      <div className="flex items-center justify-between mt-4 px-4">
        <div className="text-sm text-slate-400">
          Showing {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalCount)} of {totalCount} orders
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && setCurrentPage(page)}
              disabled={typeof page !== 'number'}
              className={`px-3 py-1 rounded ${
                page === currentPage
                  ? 'bg-emerald-500 text-white'
                  : typeof page === 'number'
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-transparent text-slate-500 cursor-default'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h1 className="text-2xl font-bold text-white">Orders</h1>
            <p className="text-slate-400 mt-1">
              {totalCount} {totalCount === 1 ? 'order' : 'orders'} total
            </p>
          </div>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Status Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_CONFIG[status].label}
                  </option>
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
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Search */}
            <div className="flex-[2] min-w-[250px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Search
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Order # or customer email..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Search
                </button>
              </form>
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
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700"
              >
                <span className="text-sm text-slate-400">Active filters:</span>
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                    Status: {ORDER_STATUS_CONFIG[statusFilter as OrderStatus]?.label || statusFilter}
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="hover:text-emerald-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {dateFrom && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                    From: {dateFrom}
                    <button
                      onClick={() => setDateFrom('')}
                      className="hover:text-emerald-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                    To: {dateTo}
                    <button
                      onClick={() => setDateTo('')}
                      className="hover:text-emerald-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSearchInput('');
                      }}
                      className="hover:text-emerald-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {hasActiveFilters ? (
                <>
                  <p>No orders match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-emerald-400 hover:text-emerald-300"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <p>No orders yet.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Order #
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Date
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Customer
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Email
                    </th>
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Items
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Total
                    </th>
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(order.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-white font-medium">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.customer_name || (
                          <span className="text-slate-500 italic">Guest</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {order.customer_email}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {order.items?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(order.id);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && orders.length > 0 && <Pagination />}
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default OrdersPage;
