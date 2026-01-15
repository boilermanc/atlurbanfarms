import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import {
  useOrder,
  useUpdateOrderStatus,
  useAddOrderNote,
  useCancelOrder,
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
} from '../hooks/useOrders';
import { useAdminAuth } from '../hooks/useAdminAuth';

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { adminUser } = useAdminAuth();

  // Fetch order data
  const { order, loading, error, refetch } = useOrder(orderId || null);

  // Hooks for actions
  const { updateStatus, loading: updatingStatus } = useUpdateOrderStatus();
  const { addNote, loading: addingNote } = useAddOrderNote();
  const { cancelOrder, loading: cancellingOrder } = useCancelOrder();

  // Local state
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Format date
  const formatDate = (dateString: string, includeTime = false) => {
    const date = new Date(dateString);
    if (includeTime) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
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
  const getStatusBadge = (status: string, size: 'sm' | 'md' = 'md') => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus] || {
      label: status,
      color: 'bg-slate-500',
    };
    const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
    return (
      <span className={`${config.color} text-white ${sizeClasses} rounded-full font-medium`}>
        {config.label}
      </span>
    );
  };

  // Handle status update
  const handleUpdateStatus = async () => {
    if (!order || !newStatus) return;

    const result = await updateStatus(
      order.id,
      newStatus as OrderStatus,
      statusNote || undefined,
      adminUser?.id
    );

    if (result.success) {
      setNewStatus('');
      setStatusNote('');
      refetch();
    }
  };

  // Handle add note
  const handleAddNote = async () => {
    if (!order || !newNote.trim()) return;

    const result = await addNote(order.id, newNote.trim());

    if (result.success) {
      setNewNote('');
      refetch();
    }
  };

  // Handle cancel order
  const handleCancelOrder = async () => {
    if (!order) return;

    const result = await cancelOrder(
      order.id,
      cancelReason || undefined,
      adminUser?.id
    );

    if (result.success) {
      setShowCancelModal(false);
      setCancelReason('');
      refetch();
    }
  };

  // Print order
  const handlePrint = () => {
    window.print();
  };

  // Export order (placeholder)
  const handleExport = () => {
    if (!order) return;

    const exportData = {
      order_number: order.order_number,
      date: order.created_at,
      status: order.status,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      shipping_address: order.shipping_address,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping_cost,
      tax: order.tax,
      total: order.total,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${order.order_number}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get tracking URL
  const getTrackingUrl = (trackingNumber: string) => {
    // Simple heuristic for carrier detection
    if (trackingNumber.startsWith('1Z')) {
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    } else if (trackingNumber.length === 22 || trackingNumber.length === 20) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    } else {
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  if (error || !order) {
    return (
      <AdminPageWrapper>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Orders
          </button>
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
            {error || 'Order not found'}
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6 print:space-y-4">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Orders
        </button>

        {/* Order Header */}
        <div className="bg-slate-800 rounded-lg p-6 print:bg-white print:border print:border-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white print:text-slate-900 font-mono">
                  {order.order_number}
                </h1>
                {getStatusBadge(order.status)}
              </div>
              <p className="text-slate-400 mt-1 print:text-slate-600">
                Placed on {formatDate(order.created_at, true)}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Card */}
            <div className="bg-slate-800 rounded-lg overflow-hidden print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Order Items</h2>
              </div>
              <div className="divide-y divide-slate-700 print:divide-slate-200">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4">
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded-lg bg-slate-700"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium print:text-slate-900 truncate">
                        {item.product_name}
                      </h3>
                      <p className="text-slate-400 text-sm print:text-slate-600">
                        {formatCurrency(item.unit_price)} x {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium print:text-slate-900">
                        {formatCurrency(item.line_total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-slate-700 print:border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-300 print:text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-300 print:text-slate-600">
                  <span>Shipping</span>
                  <span>{formatCurrency(order.shipping_cost)}</span>
                </div>
                <div className="flex justify-between text-slate-300 print:text-slate-600">
                  <span>Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg print:text-slate-900 pt-2 border-t border-slate-700 print:border-slate-200">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Order Timeline Card */}
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Order Timeline</h2>
              </div>
              <div className="p-6">
                {order.status_history && order.status_history.length > 0 ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700 print:bg-slate-200" />

                    <div className="space-y-6">
                      {order.status_history.map((history, index) => (
                        <div key={history.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            index === order.status_history!.length - 1
                              ? 'bg-emerald-500'
                              : 'bg-slate-600 print:bg-slate-300'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(history.status, 'sm')}
                              <span className="text-slate-400 text-sm print:text-slate-600">
                                {formatDate(history.created_at, true)}
                              </span>
                            </div>
                            {history.note && (
                              <p className="text-slate-300 text-sm mt-1 print:text-slate-700">
                                {history.note}
                              </p>
                            )}
                            <p className="text-slate-500 text-xs mt-1">
                              by {history.changed_by_name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">No status history available</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Customer Card */}
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Customer</h2>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <p className="text-white font-medium print:text-slate-900">
                    {order.customer_name || <span className="text-slate-500 italic">Guest</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-slate-300 print:text-slate-600">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${order.customer_email}`} className="hover:text-emerald-400">
                    {order.customer_email}
                  </a>
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-slate-300 print:text-slate-600">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${order.customer_phone}`} className="hover:text-emerald-400">
                      {order.customer_phone}
                    </a>
                  </div>
                )}
                {order.customer_id && (
                  <Link
                    to={`/admin/customers/${order.customer_id}`}
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm mt-2 print:hidden"
                  >
                    View Profile
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Shipping Address Card */}
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Shipping Address</h2>
              </div>
              <div className="p-6">
                {order.shipping_address ? (
                  <address className="text-slate-300 print:text-slate-600 not-italic leading-relaxed">
                    <p className="font-medium text-white print:text-slate-900">{order.shipping_address.name}</p>
                    <p>{order.shipping_address.street}</p>
                    {order.shipping_address.street2 && <p>{order.shipping_address.street2}</p>}
                    <p>
                      {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
                    </p>
                  </address>
                ) : (
                  <p className="text-slate-500 italic">No shipping address</p>
                )}
              </div>
            </div>

            {/* Shipping Info Card */}
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Shipping Info</h2>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <p className="text-slate-500 text-sm">Method</p>
                  <p className="text-slate-300 print:text-slate-600">
                    {order.shipping_method || 'Standard Shipping'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Cost</p>
                  <p className="text-slate-300 print:text-slate-600">
                    {formatCurrency(order.shipping_cost)}
                  </p>
                </div>
                {order.tracking_number && (
                  <div>
                    <p className="text-slate-500 text-sm">Tracking Number</p>
                    <a
                      href={getTrackingUrl(order.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 font-mono text-sm"
                    >
                      {order.tracking_number}
                      <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
                {order.estimated_delivery && (
                  <div>
                    <p className="text-slate-500 text-sm">Estimated Delivery</p>
                    <p className="text-slate-300 print:text-slate-600">
                      {formatDate(order.estimated_delivery)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Internal Notes Card */}
            <div className="bg-slate-800 rounded-lg print:hidden">
              <div className="px-6 py-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Internal Notes</h2>
              </div>
              <div className="p-6 space-y-4">
                {order.internal_notes && (
                  <div className="bg-slate-900 rounded-lg p-4 text-slate-300 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {order.internal_notes}
                  </div>
                )}
                <div className="space-y-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-slate-800 rounded-lg print:hidden">
              <div className="px-6 py-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Actions</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Update Status */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Update Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select new status...</option>
                    {ORDER_STATUSES.filter(s => s !== order.status).map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                  {newStatus && (
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Add a note (optional)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                  <button
                    onClick={handleUpdateStatus}
                    disabled={!newStatus || updatingStatus}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status'}
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-700 pt-4">
                  {/* Cancel Order */}
                  {order.status !== 'cancelled' && order.status !== 'delivered' && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {/* Refund Button (Placeholder) */}
                  {(order.status === 'cancelled' || order.status === 'delivered') && (
                    <button
                      className="w-full py-2 bg-slate-700 text-slate-400 rounded-lg cursor-not-allowed"
                      disabled
                    >
                      Refund (Coming Soon)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Order Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCancelModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white mb-4">Cancel Order</h3>
                <p className="text-slate-400 mb-4">
                  Are you sure you want to cancel order <span className="font-mono text-white">{order.order_number}</span>?
                  This action cannot be undone.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    disabled={cancellingOrder}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {cancellingOrder ? 'Cancelling...' : 'Cancel Order'}
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

export default OrderDetailPage;
