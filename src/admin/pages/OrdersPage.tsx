import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useOrders, ORDER_STATUSES, ORDER_STATUS_CONFIG, OrderStatus, Order, useUpdateOrderStatus, ViewOrderHandler } from '../hooks/useOrders';
import { supabase } from '../../lib/supabase';
import { Printer, X, RefreshCw, Search, Plus, Mail, Trash2, FileText } from 'lucide-react';

const formatStatusLabel = (status: string) =>
  ORDER_STATUS_CONFIG[status as OrderStatus]?.label || status.replace(/_/g, ' ');

interface OrdersPageProps {
  onViewOrder: ViewOrderHandler;
  onNavigate?: (page: string) => void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onViewOrder, onNavigate }) => {

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

  // Bulk actions state
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'print' | 'email' | 'archive'>('status');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Update order status hook
  const { updateStatus } = useUpdateOrderStatus();

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
    setBulkStatus('');
  }, []);

  // Bulk action handlers
  const handleBulkStatusChange = useCallback(() => {
    if (!bulkStatus || selectedOrders.size === 0) return;
    setBulkActionType('status');
    setShowBulkConfirm(true);
  }, [bulkStatus, selectedOrders.size]);

  const executeBulkStatusChange = useCallback(async () => {
    if (!bulkStatus || selectedOrders.size === 0) return;

    setBulkLoading(true);
    try {
      const orderIds = Array.from(selectedOrders);
      const results = await Promise.all(
        orderIds.map(orderId =>
          updateStatus(orderId, bulkStatus as OrderStatus, `Bulk status change to ${ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}`)
        )
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        alert(`Updated ${successCount} orders. ${failCount} failed.`);
      } else {
        alert(`Successfully updated ${successCount} orders to ${ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}`);
      }

      // Clear selection and refetch
      clearSelection();
      refetch();
    } catch (err: any) {
      console.error('Bulk status update error:', err);
      alert('Failed to update orders: ' + err.message);
    } finally {
      setBulkLoading(false);
      setShowBulkConfirm(false);
    }
  }, [bulkStatus, selectedOrders, updateStatus, clearSelection, refetch]);

  const handleBulkPrintInvoices = useCallback(() => {
    alert('Print Invoices feature coming soon!');
  }, []);

  const handleBulkEmailInvoices = useCallback(() => {
    alert('Email Invoices feature coming soon!');
  }, []);

  const handleBulkArchive = useCallback(() => {
    setBulkActionType('archive');
    setShowBulkConfirm(true);
  }, []);

  const executeBulkAction = useCallback(async () => {
    if (bulkActionType === 'status') {
      await executeBulkStatusChange();
    } else if (bulkActionType === 'archive') {
      alert('Archive feature coming soon!');
      setShowBulkConfirm(false);
    }
  }, [bulkActionType, executeBulkStatusChange]);

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
          .status-pending_payment { background: #fbbf24; color: #1f2937; }
          .status-processing { background: #3b82f6; color: white; }
          .status-on_hold { background: #a855f7; color: white; }
          .status-completed { background: #10b981; color: white; }
          .status-cancelled { background: #ef4444; color: white; }
          .status-refunded { background: #f43f5e; color: white; }
          .status-failed { background: #475569; color: white; }
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
                  <span class="status-badge status-${order.status}">${formatStatusLabel(order.status)}</span>
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

  const handlePrintAllProcessing = useCallback(async () => {
    setPrintLoading(true);
    try {
      // Fetch all processing orders (not just current page)
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
        .eq('status', 'processing')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No processing orders to print');
        return;
      }

      // Transform to Order format
      const processingOrders: Order[] = data.map((order: any) => ({
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

      openPrintWindow(processingOrders);
    } catch (err: any) {
      console.error('Error fetching processing orders:', err);
      alert('Failed to fetch processing orders: ' + err.message);
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

  // Get status badge - light theme version
  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
      processing: 'bg-blue-50 text-blue-700 border-blue-200',
      on_hold: 'bg-purple-50 text-purple-700 border-purple-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
      refunded: 'bg-rose-50 text-rose-700 border-rose-200',
      failed: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    const config = ORDER_STATUS_CONFIG[status as OrderStatus] || { label: formatStatusLabel(status) };
    const style = statusStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
    return (
      <span className={`${style} text-xs px-3 py-1 rounded-full font-semibold border`}>
        {config.label}
      </span>
    );
  };

  // Navigate to order detail
  const handleRowClick = (orderId: string, isLegacy?: boolean) => {
    onViewOrder(orderId, { isLegacy });
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
      <div className="flex items-center justify-between mt-4 px-6 py-4 border-t border-slate-100">
        <div className="text-sm text-slate-500">
          Showing {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalCount)} of {totalCount} orders
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && setCurrentPage(page)}
              disabled={typeof page !== 'number'}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-emerald-500 text-white'
                  : typeof page === 'number'
                  ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-transparent text-slate-400 cursor-default'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Orders</h1>
            <p className="text-slate-500 mt-1">
              {totalCount} {totalCount === 1 ? 'order' : 'orders'} total
              {selectedOrders.size > 0 && (
                <span className="ml-2 text-emerald-600 font-medium">
                  ({selectedOrders.size} selected)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print All Processing Button */}
            <button
              onClick={handlePrintAllProcessing}
              disabled={printLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
            >
              {printLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Printer size={18} />
              )}
              Print All Processing
            </button>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('order-create')}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
              >
                <Plus size={20} />
                Create Order
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-wrap items-end gap-4">
            {/* Status Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
              <label className="block text-sm font-medium text-slate-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Search */}
            <div className="flex-[2] min-w-[250px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Search
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Order # or customer email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap font-medium"
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
                className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200"
              >
                <span className="text-sm text-slate-500">Active filters:</span>
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    Status: {ORDER_STATUS_CONFIG[statusFilter as OrderStatus]?.label || statusFilter}
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {dateFrom && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    From: {dateFrom}
                    <button
                      onClick={() => setDateFrom('')}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    To: {dateTo}
                    <button
                      onClick={() => setDateTo('')}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSearchInput('');
                      }}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        <AnimatePresence>
          {selectedOrders.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg border border-emerald-400/60 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Selection Count */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold">{selectedOrders.size}</span>
                    </div>
                    <span className="text-white font-medium">
                      {selectedOrders.size} {selectedOrders.size === 1 ? 'order' : 'orders'} selected
                    </span>
                  </div>

                  <div className="h-8 w-px bg-white/30"></div>

                  {/* Change Status - Primary Action */}
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                      className="bg-white border-2 border-white/30 rounded-xl px-4 py-2 text-slate-800 font-medium focus:outline-none focus:border-white transition-all"
                    >
                      <option value="">Change Status...</option>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_CONFIG[status].label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkStatusChange}
                      disabled={!bulkStatus || bulkLoading}
                      className="px-4 py-2 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="h-8 w-px bg-white/30"></div>

                  {/* Other Bulk Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handlePrintSelected}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Print packing lists"
                    >
                      <Printer size={18} />
                      <span className="hidden sm:inline">Packing Lists</span>
                    </button>
                    <button
                      onClick={handleBulkPrintInvoices}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Print invoices (coming soon)"
                    >
                      <FileText size={18} />
                      <span className="hidden sm:inline">Invoices</span>
                    </button>
                    <button
                      onClick={handleBulkEmailInvoices}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Email invoices (coming soon)"
                    >
                      <Mail size={18} />
                      <span className="hidden sm:inline">Email</span>
                    </button>
                    <button
                      onClick={handleBulkArchive}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Archive orders (coming soon)"
                    >
                      <Trash2 size={18} />
                      <span className="hidden sm:inline">Archive</span>
                    </button>
                  </div>

                  {/* Clear Selection */}
                  <button
                    onClick={clearSelection}
                    className="ml-auto p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors border border-white/30"
                    title="Clear selection"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {hasActiveFilters ? (
                <>
                  <p>No orders match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-emerald-600 hover:text-emerald-700 font-medium"
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
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedOrders.size === orders.length && orders.length > 0
                            ? 'bg-emerald-500 border-emerald-500'
                            : selectedOrders.size > 0
                            ? 'bg-emerald-500/50 border-emerald-500'
                            : 'border-slate-300 hover:border-slate-400'
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
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Order #
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Date
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Customer
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Email
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Items
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Total
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedOrders.has(order.id) ? 'bg-emerald-50' : ''
                      }`}
                      onClick={() => handleRowClick(order.id, order.isLegacy)}
                    >
                      <td className="px-2 py-4 text-center">
                        <button
                          onClick={(e) => toggleOrderSelection(order.id, e)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedOrders.has(order.id)
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {selectedOrders.has(order.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-800 font-medium">
                            {order.order_number}
                          </span>
                          {order.isLegacy && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              Legacy
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 text-slate-800">
                        {order.customer_name || (
                          <span className="text-slate-400 italic">Guest</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {order.customer_email}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600">
                        {order.items?.length || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-800 font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.status)}
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

        {/* Confirmation Dialog */}
        <AnimatePresence>
          {showBulkConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !bulkLoading && setShowBulkConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Confirm Bulk Action
                </h3>
                <p className="text-slate-600 mb-6">
                  {bulkActionType === 'status' && bulkStatus && (
                    <>
                      Are you sure you want to change the status of{' '}
                      <strong>{selectedOrders.size}</strong> {selectedOrders.size === 1 ? 'order' : 'orders'} to{' '}
                      <strong>{ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}</strong>?
                    </>
                  )}
                  {bulkActionType === 'archive' && (
                    <>
                      Are you sure you want to archive{' '}
                      <strong>{selectedOrders.size}</strong> {selectedOrders.size === 1 ? 'order' : 'orders'}?
                    </>
                  )}
                </p>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => setShowBulkConfirm(false)}
                    disabled={bulkLoading}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeBulkAction}
                    disabled={bulkLoading}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {bulkLoading ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  );
};

export default OrdersPage;
