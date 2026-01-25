import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import {
  useOrder,
  useUpdateOrderStatus,
  useAddOrderNote,
  useCancelOrder,
  useOrderRefund,
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
  OrderRefund,
  OrderRefundItem,
} from '../hooks/useOrders';
import { getOrderStatusLabel } from '../../constants/orderStatus';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useShipmentManagement } from '../hooks/useShipmentManagement';
import { useTrackingEvents, formatTrackingDate as formatTrackingEventDate } from '../../hooks/useTracking';
import { supabase } from '../../lib/supabase';

// Helper to format pickup time
const formatPickupTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

interface OrderDetailPageProps {
  orderId: string;
  onBack: () => void;
  onBackToCustomer?: () => void;
  customerContextName?: string;
}

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ orderId, onBack, onBackToCustomer, customerContextName }) => {
  const { adminUser } = useAdminAuth();

  // Fetch order data
  const { order, loading, error, refetch } = useOrder(orderId);

  // Hooks for actions
  const { updateStatus, loading: updatingStatus } = useUpdateOrderStatus();
  const { addNote, loading: addingNote } = useAddOrderNote();
  const { cancelOrder, loading: cancellingOrder } = useCancelOrder();
  const {
    shipment,
    loading: shipmentLoading,
    error: shipmentError,
    createLabel,
    voidLabel,
    canCreateLabel,
    canVoidLabel
  } = useShipmentManagement(orderId);

  // Tracking events (from shipment)
  const {
    events: trackingEvents,
    loading: trackingEventsLoading,
    refetch: refetchTrackingEvents
  } = useTrackingEvents(shipment?.id || null);

  // Local state
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [voidingLabel, setVoidingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [markingPickedUp, setMarkingPickedUp] = useState(false);
  const { refundOrder, loading: refunding } = useOrderRefund();
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundMode, setRefundMode] = useState<'items' | 'full'>('items');
  const [itemRefundQuantities, setItemRefundQuantities] = useState<Record<string, number>>({});
  const [manualRefundAmount, setManualRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

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

  // Handle create label
  const handleCreateLabel = async () => {
    setCreatingLabel(true);
    setLabelError(null);

    const result = await createLabel();

    if (!result.success) {
      setLabelError(result.error?.message || 'Failed to create label');
    }

    setCreatingLabel(false);
  };

  // Handle void label
  const handleVoidLabel = async () => {
    if (!shipment?.label_id) return;

    setVoidingLabel(true);
    setLabelError(null);

    const result = await voidLabel(shipment.label_id);

    if (!result.success) {
      setLabelError(result.error?.message || 'Failed to void label');
    }

    setVoidingLabel(false);
  };

  // Handle download label
  const handleDownloadLabel = () => {
    if (shipment?.label_url) {
      window.open(shipment.label_url, '_blank');
    }
  };

  // Handle mark pickup as picked up
  const handleMarkPickedUp = async () => {
    if (!order?.pickup_reservation?.id) return;

    setMarkingPickedUp(true);

    try {
      // Update the pickup reservation status
      const { error: reservationError } = await supabase
        .from('pickup_reservations')
        .update({ status: 'picked_up' })
        .eq('id', order.pickup_reservation.id);

      if (reservationError) throw reservationError;

      // Also update the order status to completed
      await updateStatus(order.id, 'completed', 'Marked as picked up', adminUser?.id);

      refetch();
    } catch (err: any) {
      console.error('Error marking as picked up:', err);
    } finally {
      setMarkingPickedUp(false);
    }
  };

  const resetRefundForm = () => {
    setRefundMode('items');
    setItemRefundQuantities({});
    setManualRefundAmount('');
    setRefundReason('');
    setRefundError(null);
  };

  const handleOpenRefundModal = () => {
    resetRefundForm();
    setShowRefundModal(true);
  };

  const handleCloseRefundModal = () => {
    resetRefundForm();
    setShowRefundModal(false);
  };

  const handleRefundModeChange = (mode: 'items' | 'full') => {
    if (!order) return;
    setRefundMode(mode);
    setRefundError(null);

    if (mode === 'full') {
      const defaults: Record<string, number> = {};
      order.items?.forEach((item) => {
        defaults[item.id] = item.quantity;
      });
      setItemRefundQuantities(defaults);
      setManualRefundAmount(remainingRefundable.toFixed(2));
    } else {
      setManualRefundAmount('');
    }
  };

  const toggleRefundItem = (itemId: string, enabled: boolean, maxQuantity: number) => {
    if (refundMode === 'full') {
      setRefundMode('items');
    }
    setItemRefundQuantities((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[itemId] = maxQuantity;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const updateRefundQuantity = (itemId: string, quantity: number, maxQuantity: number) => {
    if (refundMode === 'full') {
      setRefundMode('items');
    }
    const safeQuantity = Math.max(0, Math.min(maxQuantity, Math.floor(quantity) || 0));
    setItemRefundQuantities((prev) => ({
      ...prev,
      [itemId]: safeQuantity,
    }));
  };

  const handleSubmitRefund = async () => {
    if (!order) return;

    if (!hasValidSelection) {
      setRefundError('Select items, use Full Order, or enter a manual amount.');
      return;
    }

    if (manualAmountInvalid) {
      setRefundError('Enter a valid refund amount.');
      return;
    }

    if (exceedsRemaining) {
      setRefundError('Refund cannot exceed the remaining balance.');
      return;
    }

    if (clampedRefundAmount <= 0) {
      setRefundError('Refund amount must be greater than zero.');
      return;
    }

    const payloadItems: OrderRefundItem[] = orderItems
      .map((item) => {
        const qty = itemRefundQuantities[item.id] || 0;
        if (qty <= 0) return null;
        const perUnit = item.unit_price ?? (item.line_total / Math.max(item.quantity, 1));
        return {
          order_item_id: item.id,
          quantity: qty,
          amount: Math.round(perUnit * qty * 100) / 100,
          description: item.product_name,
        };
      })
      .filter((value): value is OrderRefundItem => Boolean(value));

    setRefundError(null);

    const result = await refundOrder({
      orderId: order.id,
      amount: Math.round(clampedRefundAmount * 100) / 100,
      reason: refundReason.trim() || undefined,
      items: payloadItems.length > 0 ? payloadItems : undefined,
      adminUserId: adminUser?.id,
    });

    if (result.success) {
      handleCloseRefundModal();
      refetch();
    } else {
      setRefundError(result.error || 'Failed to process refund');
    }
  };

  // Get label status badge
  const getLabelStatusBadge = () => {
    if (!shipment) return null;

    if (shipment.voided) {
      return (
        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
          Voided
        </span>
      );
    }

    if (shipment.label_id) {
      return (
        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-medium">
          Label Created
        </span>
      );
    }

    return (
      <span className="bg-slate-500/20 text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">
        Pending
      </span>
    );
  };

  const getRefundStatusClasses = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-emerald-500/20 text-emerald-300';
      case 'pending':
        return 'bg-amber-500/20 text-amber-200';
      case 'failed':
      case 'canceled':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-slate-500/20 text-slate-200';
    }
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
          <div className="flex items-center gap-3">
            {onBackToCustomer && (
              <button
                onClick={onBackToCustomer}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
              </button>
            )}
            <button
              onClick={() => onBack()}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Orders
            </button>
          </div>
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
            {error || 'Order not found'}
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  const orderItems = order.items || [];
  const totalPaid = order.total || 0;
  const refundedTotal = order.refunded_total || 0;
  const remainingRefundable = Math.max(0, totalPaid - refundedTotal);
  const paymentState = (order.payment_status || order.status || '').toLowerCase();
  const paidStates = new Set(['processing', 'on_hold', 'completed', 'refunded']);
  const isPaidOrder = paidStates.has(paymentState);
  const canRefund = Boolean(order.stripe_payment_intent_id && remainingRefundable > 0 && isPaidOrder);
  const calculatedItemAmount = orderItems.reduce((sum, item) => {
    const qty = itemRefundQuantities[item.id] || 0;
    if (qty <= 0) return sum;
    const perUnit = item.unit_price ?? (item.line_total / Math.max(item.quantity, 1));
    return sum + perUnit * Math.min(qty, item.quantity);
  }, 0);
  const trimmedManualAmount = manualRefundAmount.trim();
  const manualAmountValue = trimmedManualAmount === '' ? null : parseFloat(trimmedManualAmount);
  const manualAmountInvalid = trimmedManualAmount !== '' && (manualAmountValue === null || Number.isNaN(manualAmountValue));
  const provisionalRefundAmount = manualAmountInvalid ? 0 : (manualAmountValue ?? calculatedItemAmount);
  const exceedsRemaining = provisionalRefundAmount > remainingRefundable + 0.0001;
  const clampedRefundAmount = Math.min(Math.max(provisionalRefundAmount, 0), remainingRefundable);
  const hasManualAmount = manualAmountValue !== null && !Number.isNaN(manualAmountValue) && manualAmountValue > 0;
  const hasItemSelection = orderItems.some((item) => (itemRefundQuantities[item.id] || 0) > 0);
  const hasValidSelection = refundMode === 'full'
    ? remainingRefundable > 0
    : hasItemSelection || hasManualAmount;
  const selectedItemCount = orderItems.filter((item) => (itemRefundQuantities[item.id] || 0) > 0).length;
  const canSubmitRefund = hasValidSelection && !manualAmountInvalid && !exceedsRemaining && clampedRefundAmount > 0 && !refunding;
  const refundHistory: OrderRefund[] = order.refunds || [];
  const remainingAfterPlannedRefund = Math.max(0, remainingRefundable - clampedRefundAmount);

  return (
    <AdminPageWrapper>
      <div className="space-y-6 print:space-y-4">
        {/* Back Buttons */}
        <div className="flex items-center gap-3 print:hidden">
          {onBackToCustomer && (
            <button
              onClick={onBackToCustomer}
              className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
            </button>
          )}
          <button
            onClick={() => onBack()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Orders
          </button>
        </div>

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
                onClick={handleExport}
                title="Download order data as JSON for backup or integration purposes"
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

        {/* Customer and Shipping Info - Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <span className="inline-flex items-center gap-1 text-slate-500 text-sm mt-2 print:hidden">
                  Customer ID: {order.customer_id.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>

          {/* Ship To Card - Pickup or Shipping */}
          {order.is_pickup && order.pickup_reservation ? (
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white print:text-slate-900">Pickup Location</h2>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.pickup_reservation.status === 'picked_up' ? 'bg-emerald-500/20 text-emerald-400' :
                    order.pickup_reservation.status === 'missed' ? 'bg-red-500/20 text-red-400' :
                    order.pickup_reservation.status === 'cancelled' ? 'bg-slate-500/20 text-slate-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {order.pickup_reservation.status === 'picked_up' ? 'Picked Up' :
                     order.pickup_reservation.status === 'missed' ? 'Missed' :
                     order.pickup_reservation.status === 'cancelled' ? 'Cancelled' :
                     'Scheduled'}
                  </span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="font-medium text-white print:text-slate-900">{order.pickup_reservation.location.name}</p>
                  <address className="text-slate-300 print:text-slate-600 not-italic leading-relaxed mt-1">
                    <p>{order.pickup_reservation.location.address_line1}</p>
                    {order.pickup_reservation.location.address_line2 && (
                      <p>{order.pickup_reservation.location.address_line2}</p>
                    )}
                    <p>
                      {order.pickup_reservation.location.city}, {order.pickup_reservation.location.state} {order.pickup_reservation.location.postal_code}
                    </p>
                  </address>
                  {order.pickup_reservation.location.phone && (
                    <p className="text-slate-400 text-sm mt-2">{order.pickup_reservation.location.phone}</p>
                  )}
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-slate-500 text-sm">Pickup Date & Time</p>
                  <p className="text-white font-medium">
                    {new Date(order.pickup_reservation.pickup_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-slate-300">
                    {formatPickupTime(order.pickup_reservation.pickup_time_start)} - {formatPickupTime(order.pickup_reservation.pickup_time_end)}
                  </p>
                </div>

                {order.pickup_reservation.location.instructions && (
                  <div className="border-t border-slate-700 pt-4">
                    <p className="text-slate-500 text-sm">Pickup Instructions</p>
                    <p className="text-slate-300 text-sm mt-1">{order.pickup_reservation.location.instructions}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Ship To</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-slate-500 text-sm mb-2">Shipping Address</p>
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

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-slate-500 text-sm">Shipping Method</p>
                  <p className="text-slate-300 print:text-slate-600">
                    {order.shipping_method_name || order.shipping_method || 'Standard Shipping'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order Items Card - Full Width */}
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
            {refundedTotal > 0 && (
              <>
                <div className="flex justify-between text-rose-300 font-medium text-sm print:text-rose-600">
                  <span>Refunded</span>
                  <span>-{formatCurrency(refundedTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-200 print:text-slate-700">
                  <span>Remaining Refundable</span>
                  <span>{formatCurrency(remainingRefundable)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Order Timeline - Full Width */}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {history.from_status ? (
                            <p className="text-white text-sm font-medium print:text-slate-900">
                              Status changed from <span className="text-slate-300 print:text-slate-700">{getOrderStatusLabel(history.from_status)}</span> to <span className="text-emerald-400 print:text-emerald-700">{getOrderStatusLabel(history.status)}</span>
                            </p>
                          ) : (
                            <p className="text-white text-sm font-medium print:text-slate-900">
                              Status set to <span className="text-emerald-400 print:text-emerald-700">{getOrderStatusLabel(history.status)}</span>
                            </p>
                          )}
                        </div>
                        <span className="text-slate-400 text-xs print:text-slate-600 block mt-1">
                          {formatDate(history.created_at, true)}
                        </span>
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

        {/* Additional Info - Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Refund History */}
          {refundHistory.length > 0 && (
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <h2 className="text-lg font-semibold text-white print:text-slate-900">Refund History</h2>
              </div>
              <div className="divide-y divide-slate-700 print:divide-slate-200">
                {refundHistory.map((refund) => (
                  <div key={refund.id} className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold print:text-slate-900">
                          {formatCurrency(refund.amount)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(refund.created_at, true)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRefundStatusClasses(refund.status)}`}>
                        {refund.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    {refund.reason && (
                      <p className="text-sm text-slate-300 print:text-slate-700">
                        {refund.reason}
                      </p>
                    )}
                    {refund.created_by_name && (
                      <p className="text-xs text-slate-500">
                        Issued by {refund.created_by_name}
                      </p>
                    )}
                    {refund.items && refund.items.length > 0 && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Items</p>
                        <div className="space-y-1 text-sm text-slate-200">
                          {refund.items.map((item, idx) => (
                            <div key={`${refund.id}-${idx}`} className="flex items-center justify-between gap-3">
                              <span className="truncate">{item.description || 'Line Item'}</span>
                              <span className="text-slate-400">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipping/Tracking Info Card (for non-pickup orders) */}
          {!order.is_pickup && (
            <div className="bg-slate-800 rounded-lg print:bg-white print:border print:border-slate-200">
              <div className="px-6 py-4 border-b border-slate-700 print:border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white print:text-slate-900">Shipping & Tracking</h2>
                  {getLabelStatusBadge()}
                </div>
              </div>
              <div className="p-6 space-y-3">
                {(shipment?.tracking_number || order.tracking_number) && (
                  <div>
                    <p className="text-slate-500 text-sm">Tracking Number</p>
                    <a
                      href={getTrackingUrl(shipment?.tracking_number || order.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 font-mono text-sm"
                    >
                      {shipment?.tracking_number || order.tracking_number}
                      <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
                {shipment?.tracking_status && (
                  <div>
                    <p className="text-slate-500 text-sm">Tracking Status</p>
                    <p className="text-slate-300 print:text-slate-600">
                      {shipment.tracking_status_description || shipment.tracking_status}
                    </p>
                  </div>
                )}
                {(shipment?.estimated_delivery_date || order.estimated_delivery_date || order.estimated_delivery) && (
                  <div>
                    <p className="text-slate-500 text-sm">Estimated Delivery</p>
                    <p className="text-slate-300 print:text-slate-600">
                      {formatDate(shipment?.estimated_delivery_date || order.estimated_delivery_date || order.estimated_delivery)}
                    </p>
                  </div>
                )}
                {shipment?.shipment_cost && (
                  <div>
                    <p className="text-slate-500 text-sm">Label Cost</p>
                    <p className="text-slate-300 print:text-slate-600">
                      {formatCurrency(shipment.shipment_cost)}
                    </p>
                  </div>
                )}
                {shipment?.carrier_code && (
                  <div>
                    <p className="text-slate-500 text-sm">Carrier</p>
                    <p className="text-slate-300 print:text-slate-600 capitalize">
                      {shipment.carrier_code.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}

                {/* Label Error */}
                {labelError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm print:hidden">
                    {labelError}
                  </div>
                )}

                {/* Label Actions */}
                <div className="pt-3 space-y-2 print:hidden">
                  {canCreateLabel && order.status !== 'cancelled' && (
                    <button
                      onClick={handleCreateLabel}
                      disabled={creatingLabel || shipmentLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creatingLabel ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Creating Label...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Create Shipping Label
                        </>
                      )}
                    </button>
                  )}

                  {shipment?.label_url && !shipment.voided && (
                    <button
                      onClick={handleDownloadLabel}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Label
                    </button>
                  )}

                  {canVoidLabel && (
                    <button
                      onClick={handleVoidLabel}
                      disabled={voidingLabel || shipmentLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded-lg hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {voidingLabel ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Voiding Label...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Void Label
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Tracking Timeline */}
                {shipment?.tracking_number && (
                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-400">Tracking History</h3>
                      <button
                        onClick={() => refetchTrackingEvents()}
                        disabled={trackingEventsLoading}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        {trackingEventsLoading ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>

                    {trackingEvents.length > 0 ? (
                      <div className="relative max-h-64 overflow-y-auto pr-2">
                        {/* Timeline line */}
                        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-700"></div>

                        <div className="space-y-3">
                          {trackingEvents.map((event, index) => (
                            <div key={index} className="relative pl-6">
                              {/* Timeline dot */}
                              <div className={`absolute left-0 w-4 h-4 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                              </div>

                              <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className={`text-sm font-medium ${index === 0 ? 'text-white' : 'text-slate-300'}`}>
                                  {event.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                  <span>{formatTrackingEventDate(event.occurred_at)}</span>
                                  {(event.city_locality || event.state_province) && (
                                    <>
                                      <span className="text-slate-700">•</span>
                                      <span>
                                        {[event.city_locality, event.state_province].filter(Boolean).join(', ')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        <p>No tracking events yet.</p>
                        <p className="text-xs mt-1">Events will appear here as the carrier updates tracking.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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

                {/* Mark as Picked Up (for pickup orders) */}
                {order.is_pickup && order.pickup_reservation?.status === 'scheduled' && order.status !== 'cancelled' && (
                  <div className="border-t border-slate-700 pt-4">
                    <button
                      onClick={handleMarkPickedUp}
                      disabled={markingPickedUp}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {markingPickedUp ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Mark as Picked Up
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-slate-700 pt-4 space-y-3">
                  {/* Cancel Order */}
                  {order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'refunded' && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {/* Refund Button */}
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 text-center">
                      Remaining refundable: {formatCurrency(remainingRefundable)}
                    </p>
                    {canRefund ? (
                      <button
                        onClick={handleOpenRefundModal}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                      >
                        Issue Refund
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-700 text-slate-400 rounded-lg cursor-not-allowed"
                      >
                        Refund Unavailable
                      </button>
                    )}
                    {!order.stripe_payment_intent_id && (
                      <p className="text-xs text-slate-500 text-center">
                        Stripe payment required to issue refunds.
                      </p>
                    )}
                    {order.stripe_payment_intent_id && !isPaidOrder && (
                      <p className="text-xs text-slate-500 text-center">
                        Refunds unlock once the order is marked as paid.
                      </p>
                    )}
                    {remainingRefundable <= 0 && (
                      <p className="text-xs text-slate-500 text-center">
                        This order has been fully refunded.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Refund Modal */}
        <AnimatePresence>
          {showRefundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={handleCloseRefundModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 rounded-2xl p-6 max-w-3xl w-full space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Issue Refund</h3>
                  <button
                    onClick={handleCloseRefundModal}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-xs">Order Total</p>
                    <p className="text-white font-semibold">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-xs">Refunded</p>
                    <p className="text-white font-semibold">{formatCurrency(refundedTotal)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-xs">Remaining</p>
                    <p className="text-white font-semibold">{formatCurrency(remainingRefundable)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleRefundModeChange('items')}
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      refundMode === 'items'
                        ? 'bg-slate-800 border-emerald-500 text-white'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    Select Items
                  </button>
                  <button
                    onClick={() => handleRefundModeChange('full')}
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      refundMode === 'full'
                        ? 'bg-slate-800 border-emerald-500 text-white'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    Full Order
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {orderItems.length > 0 ? (
                    orderItems.map((item) => {
                      const selectedQty = itemRefundQuantities[item.id] || 0;
                      const isSelected = selectedQty > 0;
                      const perUnit = item.unit_price ?? (item.line_total / Math.max(item.quantity, 1));
                      return (
                        <div key={item.id} className="border border-slate-700 rounded-lg p-3 flex gap-3">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleRefundItem(item.id, e.target.checked, item.quantity)}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-white font-medium">{item.product_name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatCurrency(perUnit)} × {item.quantity}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-400">Selected</p>
                                <p className="text-sm text-white">
                                  {isSelected ? formatCurrency(perUnit * selectedQty) : formatCurrency(0)}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-400">Qty to refund</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantity}
                                  value={selectedQty}
                                  onChange={(e) => updateRefundQuantity(item.id, Number(e.target.value), item.quantity)}
                                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">No items to refund.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Manual Adjustment (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={manualRefundAmount}
                        onChange={(e) => {
                          setManualRefundAmount(e.target.value);
                          setRefundError(null);
                        }}
                        placeholder="Leave blank to use item total"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Use this to include shipping or tax adjustments. Cannot exceed remaining balance.
                    </p>
                    {manualAmountInvalid && (
                      <p className="text-xs text-red-400">Enter a valid amount.</p>
                    )}
                    {exceedsRemaining && (
                      <p className="text-xs text-red-400">
                        This exceeds the refundable balance.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Reason (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Damaged on arrival, out of stock, etc."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>

                <div className="bg-slate-800/70 rounded-xl p-4 space-y-2 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span>Items Selected</span>
                    <span>{selectedItemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selected Items Total</span>
                    <span>{formatCurrency(calculatedItemAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-white">
                    <span>Refund Amount</span>
                    <span>{formatCurrency(clampedRefundAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>Remaining After Refund</span>
                    <span>{formatCurrency(remainingAfterPlannedRefund)}</span>
                  </div>
                </div>

                {refundError && (
                  <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-sm text-red-300">
                    {refundError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={handleCloseRefundModal}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRefund}
                    disabled={!canSubmitRefund}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {refunding ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Process Refund'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
