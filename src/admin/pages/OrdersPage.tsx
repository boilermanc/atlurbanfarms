import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useOrders, ORDER_STATUSES, ORDER_STATUS_CONFIG, OrderStatus, Order } from '../hooks/useOrders';
import { supabase } from '../../lib/supabase';

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

  // Selection state for batch printing
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [printLoading, setPrintLoading] = useState(false);

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

  // Selection handlers
  const toggleOrderSelection = useCallback((orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  }, [orders, selectedOrders.size]);

  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  // Print functions
  const openPrintWindow = useCallback((ordersToprint: Order[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print orders');
      return;
    }

    const formatCurrencyForPrint = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    const formatDateForPrint = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pick Lists - ATL Urban Farms</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; }
          .order { page-break-after: always; padding: 20px; }
          .order:last-child { page-break-after: auto; }
          .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header .order-number { font-family: monospace; font-size: 20px; font-weight: bold; }
          .header .date { color: #666; font-size: 12px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .customer-info { display: flex; gap: 40px; }
          .customer-info div { flex: 1; }
          .customer-info p { margin: 4px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .items-table th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
          .items-table .qty { text-align: center; font-weight: bold; font-size: 18px; width: 60px; }
          .items-table .product { font-weight: 500; }
          .items-table .price { text-align: right; width: 100px; }
          .items-table .checkbox { width: 40px; text-align: center; }
          .items-table .checkbox-box { display: inline-block; width: 20px; height: 20px; border: 2px solid #000; }
          .totals { margin-top: 20px; text-align: right; }
          .totals table { margin-left: auto; }
          .totals td { padding: 4px 12px; }
          .totals .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #000; }
          .shipping-address { background: #f9f9f9; padding: 12px; border-radius: 4px; }
          .notes { background: #fff9e6; padding: 12px; border-radius: 4px; border: 1px solid #f0e6cc; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .status-paid { background: #3b82f6; color: white; }
          .status-pending { background: #64748b; color: white; }
          .status-allocated { background: #8b5cf6; color: white; }
          .status-picking { background: #f59e0b; color: white; }
          .status-packed { background: #f97316; color: white; }
          .status-shipped { background: #06b6d4; color: white; }
          .status-delivered { background: #10b981; color: white; }
          .status-cancelled { background: #ef4444; color: white; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${ordersToprint.map(order => `
          <div class="order">
            <div class="header">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h1>Pick List</h1>
                  <div class="order-number">${order.order_number}</div>
                  <div class="date">${formatDateForPrint(order.created_at)}</div>
                </div>
                <div>
                  <span class="status-badge status-${order.status}">${order.status}</span>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Customer & Shipping</div>
              <div class="customer-info">
                <div>
                  <p><strong>${order.customer_name || 'Guest'}</strong></p>
                  <p>${order.customer_email}</p>
                  ${order.customer_phone ? `<p>${order.customer_phone}</p>` : ''}
                </div>
                <div class="shipping-address">
                  ${order.shipping_address ? `
                    <p><strong>${order.shipping_address.name}</strong></p>
                    <p>${order.shipping_address.street}</p>
                    ${order.shipping_address.street2 ? `<p>${order.shipping_address.street2}</p>` : ''}
                    <p>${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}</p>
                  ` : '<p>No shipping address</p>'}
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Items to Pick</div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th class="checkbox">Pick</th>
                    <th class="qty">Qty</th>
                    <th class="product">Product</th>
                    <th class="price">Unit Price</th>
                    <th class="price">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(order.items || []).map(item => `
                    <tr>
                      <td class="checkbox"><span class="checkbox-box"></span></td>
                      <td class="qty">${item.quantity}</td>
                      <td class="product">${item.product_name}</td>
                      <td class="price">${formatCurrencyForPrint(item.unit_price)}</td>
                      <td class="price">${formatCurrencyForPrint(item.line_total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="totals">
              <table>
                <tr>
                  <td>Subtotal:</td>
                  <td>${formatCurrencyForPrint(order.subtotal)}</td>
                </tr>
                <tr>
                  <td>Shipping (${order.shipping_method || 'Standard'}):</td>
                  <td>${formatCurrencyForPrint(order.shipping_cost)}</td>
                </tr>
                <tr>
                  <td>Tax:</td>
                  <td>${formatCurrencyForPrint(order.tax)}</td>
                </tr>
                <tr class="total-row">
                  <td>Total:</td>
                  <td>${formatCurrencyForPrint(order.total)}</td>
                </tr>
              </table>
            </div>

            ${order.internal_notes ? `
              <div class="section" style="margin-top: 20px;">
                <div class="section-title">Internal Notes</div>
                <div class="notes">${order.internal_notes.replace(/\n/g, '<br>')}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, []);

  const handlePrintSelected = useCallback(() => {
    const ordersToPrint = orders.filter(o => selectedOrders.has(o.id));
    if (ordersToPrint.length === 0) return;
    openPrintWindow(ordersToPrint);
  }, [orders, selectedOrders, openPrintWindow]);

  const handlePrintAllPaid = useCallback(async () => {
    setPrintLoading(true);
    try {
      // Fetch all paid orders (not just current page)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          order_items (
            id,
            product_id,
            product_name,
            product_price,
            quantity,
            line_total,
            products (
              name
            )
          )
        `)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No paid orders to print');
        return;
      }

      // Transform to Order format
      const paidOrders: Order[] = data.map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers
          ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || null
          : order.shipping_address?.name || `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim() || null,
        customer_email: order.customer_email || order.guest_email || order.customers?.email,
        customer_phone: order.customers?.phone || order.shipping_phone || null,
        status: order.status,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        shipping_address: order.shipping_address || (order.shipping_address_line1 ? {
          name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
          street: order.shipping_address_line1,
          street2: order.shipping_address_line2 || null,
          city: order.shipping_city,
          state: order.shipping_state,
          zip: order.shipping_zip
        } : null),
        shipping_method: order.shipping_method,
        tracking_number: order.tracking_number,
        estimated_delivery: order.estimated_delivery,
        internal_notes: order.internal_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || 'Unknown Product',
          product_image: null,
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
        })),
      }));

      openPrintWindow(paidOrders);
    } catch (err: any) {
      console.error('Error fetching paid orders:', err);
      alert('Failed to fetch paid orders: ' + err.message);
    } finally {
      setPrintLoading(false);
    }
  }, [openPrintWindow]);

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
              {selectedOrders.size > 0 && (
                <span className="ml-2 text-emerald-400">
                  ({selectedOrders.size} selected)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print Selected Button */}
            {selectedOrders.size > 0 && (
              <>
                <button
                  onClick={handlePrintSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Selected ({selectedOrders.size})
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  title="Clear selection"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
            {/* Print All Paid Button */}
            <button
              onClick={handlePrintAllPaid}
              disabled={printLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {printLoading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              )}
              Print All Paid
            </button>
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
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-2 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedOrders.size === orders.length && orders.length > 0
                            ? 'bg-emerald-500 border-emerald-500'
                            : selectedOrders.size > 0
                            ? 'bg-emerald-500/50 border-emerald-500'
                            : 'border-slate-500 hover:border-slate-400'
                        }`}
                      >
                        {selectedOrders.size === orders.length && orders.length > 0 && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {selectedOrders.size > 0 && selectedOrders.size < orders.length && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                          </svg>
                        )}
                      </button>
                    </th>
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
                      className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${
                        selectedOrders.has(order.id) ? 'bg-emerald-500/10' : ''
                      }`}
                      onClick={() => handleRowClick(order.id)}
                    >
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={(e) => toggleOrderSelection(order.id, e)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedOrders.has(order.id)
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-500 hover:border-slate-400'
                          }`}
                        >
                          {selectedOrders.has(order.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
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
