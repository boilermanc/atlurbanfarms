import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  useOrder,
  useAdjacentOrders,
  useUpdateOrderStatus,
  useAddOrderNote,
  useCancelOrder,
  useOrderRefund,
  useManualRefund,
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  OrderStatus,
  OrderRefund,
  OrderRefundItem,
  ManualRefundMethod,
  getOrderSeedlingTotal,
  logOrderActivity,
} from '../hooks/useOrders';
import { getOrderStatusLabel } from '../../constants/orderStatus';
import { useAdminAuth } from '../hooks/useAdminAuth';
import useShipmentManagement from '../hooks/useShipmentManagement';
import { useShippingPackages } from '../hooks/useShippingPackages';
import { supabase } from '../../lib/supabase';
import { useBrandingSettings } from '../../hooks/useSupabase';
import { Pencil, Check, Plus, X, Search, Loader2, AlertTriangle, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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
  onNavigateOrder?: (orderId: string) => void;
}

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ orderId, onBack, onBackToCustomer, customerContextName, onNavigateOrder }) => {
  const { adminUser } = useAdminAuth();
  const { settings: brandingSettings } = useBrandingSettings();
  const { getPackageForQuantity } = useShippingPackages();

  // Fetch order data
  const { order, loading, error, refetch } = useOrder(orderId);
  const { prevOrderId, nextOrderId } = useAdjacentOrders(orderId);

  // Hooks for actions
  const { updateStatus, loading: updatingStatus } = useUpdateOrderStatus();
  const { addNote, loading: addingNote } = useAddOrderNote();
  const { cancelOrder, loading: cancellingOrder } = useCancelOrder();
  // Local state
  const [newNote, setNewNote] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [markingPickedUp, setMarkingPickedUp] = useState(false);
  const [showConvertToShipModal, setShowConvertToShipModal] = useState(false);
  const [convertingToShip, setConvertingToShip] = useState(false);
  const { refundOrder, loading: refunding } = useOrderRefund();
  const { processManualRefund, loading: processingManualRefund } = useManualRefund();
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundMode, setRefundMode] = useState<'items' | 'full'>('items');
  const [itemRefundQuantities, setItemRefundQuantities] = useState<Record<string, number>>({});
  const [manualRefundAmount, setManualRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  // Manual refund state
  const [showManualRefundModal, setShowManualRefundModal] = useState(false);
  const [manualRefundAmountInput, setManualRefundAmountInput] = useState('');
  const [manualRefundMethod, setManualRefundMethod] = useState<ManualRefundMethod>('cash');
  const [manualRefundNotes, setManualRefundNotes] = useState('');
  const [manualRefundError, setManualRefundError] = useState<string | null>(null);

  // Line item editing state
  const [editingItems, setEditingItems] = useState(false);
  const [editableItems, setEditableItems] = useState<Array<{
    id: string | null;
    product_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
  }>>([]);
  const [itemSaving, setItemSaving] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Array<{
    id: string;
    name: string;
    price: number;
    quantity_available: number;
  }>>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Section 1: Status & Payment editing
  const [editingStatus, setEditingStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', payment_status: '', internal_notes: '', customer_notes: '' });

  // Section 2: Shipping Address editing
  const [editingShipping, setEditingShipping] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingForm, setShippingForm] = useState({ shipping_first_name: '', shipping_last_name: '', shipping_address_line1: '', shipping_address_line2: '', shipping_city: '', shipping_state: '', shipping_zip: '', shipping_phone: '' });

  // Section 3: Billing Address editing
  const [editingBilling, setEditingBilling] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingForm, setBillingForm] = useState({ billing_first_name: '', billing_last_name: '', billing_address_line1: '', billing_address_line2: '', billing_city: '', billing_state: '', billing_zip: '' });

  // Section 4: Shipping Method & Tracking editing
  const [editingTracking, setEditingTracking] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingForm, setTrackingForm] = useState({ shipping_method_name: '', shipping_cost: 0, tracking_number: '', tracking_url: '', estimated_delivery_date: '' });

  // Shipping Label state
  const { shipment, loading: shipmentLoading, error: shipmentError, createLabel, voidLabel, canCreateLabel, canVoidLabel, refetch: refetchShipment } = useShipmentManagement(orderId);
  const [labelServiceCode, setLabelServiceCode] = useState('ups_ground');
  const [labelPackages, setLabelPackages] = useState<Array<{ weight: number; length: number; width: number; height: number }>>([
    { weight: 1, length: 12, width: 5, height: 5 }
  ]);
  const [labelCreating, setLabelCreating] = useState(false);
  const [labelVoiding, setLabelVoiding] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [overridePickup, setOverridePickup] = useState(false);
  // Rates state
  const [fetchedRates, setFetchedRates] = useState<Array<{ rate_id: string; carrier_id: string; carrier_code: string; carrier_friendly_name: string; service_code: string; service_type: string; shipping_amount: number; currency: string; delivery_days: number | null; estimated_delivery_date: string | null; guaranteed_service: boolean }>>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [selectedRate, setSelectedRate] = useState<typeof fetchedRates[number] | null>(null);

  // Sync service code from order when loaded
  useEffect(() => {
    if (order?.shipping_service_code) {
      setLabelServiceCode(order.shipping_service_code);
    }
  }, [order?.shipping_service_code]);

  // Pre-fill label package weight/dimensions from order seedling count
  useEffect(() => {
    if (!order?.items || order.items.length === 0) return;
    // Use bundle-aware seedling count (e.g., "20 Seedling Variety Pack" = 20 seedlings, not 1)
    const totalQty = getOrderSeedlingTotal(order.items);
    if (totalQty <= 0) return;

    const SEEDLING_WEIGHT_LBS = 0.12;
    const pkg = getPackageForQuantity(totalQty);
    if (!pkg) return;

    const weight = Math.round((pkg.empty_weight + totalQty * SEEDLING_WEIGHT_LBS) * 100) / 100;
    setLabelPackages([{ weight, length: pkg.length, width: pkg.width, height: pkg.height }]);
  }, [order?.items, getPackageForQuantity]);

  // Print mode: auto-print when opened via ?print=true
  const [isPrintMode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('print') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isPrintMode && order && !loading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, order, loading]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Product search debounce
  useEffect(() => {
    if (productSearchQuery.length < 2) {
      setProductSearchResults([]);
      setShowProductDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const { data, error: searchError } = await supabase
          .from('products')
          .select('id, name, price, quantity_available')
          .ilike('name', `%${productSearchQuery}%`)
          .eq('is_active', true)
          .limit(10);

        if (searchError) throw searchError;
        setProductSearchResults(data || []);
        setShowProductDropdown((data || []).length > 0);
      } catch {
        setProductSearchResults([]);
      } finally {
        setProductSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearchQuery]);

  // Click outside to close product search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date - handles null/undefined/invalid dates
  const formatDate = (dateString: string | null | undefined, includeTime = false) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
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

  // Format currency - handles null/undefined/NaN amounts
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // --- Line item editing handlers ---
  const handleStartEditItems = async () => {
    if (!order?.items) return;
    const items = order.items.map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_price: item.unit_price,
      quantity: item.quantity,
    }));
    setEditableItems(items);
    setEditingItems(true);
    setProductSearchQuery('');
    setProductSearchResults([]);
    setShowProductDropdown(false);

    // Fetch stock for existing items
    const productIds = items.map(i => i.product_id);
    if (productIds.length > 0) {
      const { data } = await supabase
        .from('products')
        .select('id, quantity_available')
        .in('id', productIds);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach(p => { map[p.id] = p.quantity_available; });
        setStockMap(map);
      }
    }
  };

  const handleAddProductToEdit = (product: { id: string; name: string; price: number; quantity_available: number }) => {
    const existingIndex = editableItems.findIndex(i => i.product_id === product.id);
    if (existingIndex >= 0) {
      const updated = [...editableItems];
      updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + 1 };
      setEditableItems(updated);
    } else {
      setEditableItems([...editableItems, {
        id: null,
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity: 1,
      }]);
    }
    setStockMap(prev => ({ ...prev, [product.id]: product.quantity_available }));
    setProductSearchQuery('');
    setShowProductDropdown(false);
  };

  const handleRemoveEditItem = (index: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== index));
  };

  const handleEditItemQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const updated = [...editableItems];
    updated[index] = { ...updated[index], quantity: newQuantity };
    setEditableItems(updated);
  };

  const editSubtotal = editableItems.reduce((sum, item) => sum + item.quantity * item.product_price, 0);
  const editTotal = editSubtotal + (order?.shipping_cost || 0) + (order?.tax || 0) - (order?.discount_amount || 0);

  const handleSaveItems = async () => {
    if (!order) return;
    setItemSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('update_order_line_items', {
        p_order_id: order.id,
        p_items: editableItems.map(item => ({
          order_item_id: item.id || null,
          product_id: item.product_id,
          quantity: item.quantity,
          product_name: item.product_name,
          product_price: item.product_price,
          line_total: item.quantity * item.product_price,
        })),
      });
      if (rpcError) throw rpcError;

      await logOrderActivity({
        orderId: order.id,
        activityType: 'items_updated',
        description: 'Order items updated',
        details: { item_count: editableItems.length },
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      setEditingItems(false);
      setEditableItems([]);
      await refetch();
      setToast({ message: 'Order items updated', type: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update order items';
      setToast({ message, type: 'error' });
    } finally {
      setItemSaving(false);
    }
  };

  const handleCancelEditItems = () => {
    setEditingItems(false);
    setEditableItems([]);
    setProductSearchQuery('');
    setProductSearchResults([]);
    setShowProductDropdown(false);
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

  // Handle add note
  const handleAddNote = async () => {
    if (!order || !newNote.trim()) return;

    const result = await addNote(order.id, newNote.trim());

    if (result.success) {
      await logOrderActivity({
        orderId: order.id,
        activityType: 'note_added',
        description: `Note added: ${newNote.trim().substring(0, 100)}${newNote.trim().length > 100 ? '...' : ''}`,
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });
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
      await logOrderActivity({
        orderId: order.id,
        activityType: 'order_cancelled',
        description: cancelReason ? `Order cancelled: ${cancelReason}` : 'Order cancelled',
        details: { reason: cancelReason || null },
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      // Restore gift card balance if one was used
      if (order.gift_card_code && order.giftup_transaction_id) {
        try {
          const { data } = await supabase.functions.invoke('giftup-undo-redemption', {
            body: { order_id: order.id }
          });
          if (data?.success) {
            console.log(`Gift card ${order.gift_card_code} balance restored`);
          } else {
            console.warn('Gift card balance could not be restored automatically. Check Gift Up dashboard.');
          }
        } catch (err) {
          console.warn('Gift card undo-redemption failed:', err);
        }
      }

      setShowCancelModal(false);
      setCancelReason('');
      refetch();
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

      await logOrderActivity({
        orderId: order.id,
        activityType: 'marked_picked_up',
        description: 'Order marked as picked up',
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      refetch();
    } catch (err: any) {
      console.error('Error marking as picked up:', err);
    } finally {
      setMarkingPickedUp(false);
    }
  };

  // Handle converting a pickup order to a ship order
  const handleConvertToShip = async () => {
    if (!order) return;

    setConvertingToShip(true);
    try {
      // Update the order: clear pickup fields, set as shipping order
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          is_pickup: false,
          shipping_method: 'standard',
          shipping_method_name: null,
          pickup_location_id: null,
          pickup_date: null,
          pickup_time_start: null,
          pickup_time_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Cancel the pickup reservation if one exists
      if (order.pickup_reservation?.id) {
        const { error: reservationError } = await supabase
          .from('pickup_reservations')
          .update({ status: 'cancelled' })
          .eq('id', order.pickup_reservation.id);

        if (reservationError) throw reservationError;
      }

      await logOrderActivity({
        orderId: order.id,
        activityType: 'converted_to_ship',
        description: 'Order converted from pickup to shipping',
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      setShowConvertToShipModal(false);
      setToast({ message: 'Order converted to ship order', type: 'success' });
      await refetch();

      // Auto-open shipping address edit if no address exists
      if (!order.shipping_address_line1) {
        startEditShipping();
      }
    } catch (err: any) {
      console.error('Error converting to ship order:', err);
      setToast({ message: 'Failed to convert order: ' + (err.message || 'Unknown error'), type: 'error' });
    } finally {
      setConvertingToShip(false);
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
      await logOrderActivity({
        orderId: order.id,
        activityType: 'refund_issued',
        description: `Refund of $${(Math.round(clampedRefundAmount * 100) / 100).toFixed(2)} issued via Stripe`,
        details: { amount: Math.round(clampedRefundAmount * 100) / 100, reason: refundReason.trim() || null },
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      // Restore gift card balance if one was used
      if (order.gift_card_code && order.giftup_transaction_id) {
        try {
          const { data } = await supabase.functions.invoke('giftup-undo-redemption', {
            body: { order_id: order.id }
          });
          if (data?.success) {
            console.log(`Gift card ${order.gift_card_code} balance restored`);
          } else {
            console.warn('Gift card balance could not be restored automatically. Check Gift Up dashboard.');
          }
        } catch (err) {
          console.warn('Gift card undo-redemption failed:', err);
        }
      }

      handleCloseRefundModal();
      refetch();
    } else {
      setRefundError(result.error || 'Failed to process refund');
    }
  };

  // Manual refund handlers
  const resetManualRefundForm = () => {
    setManualRefundAmountInput('');
    setManualRefundMethod('cash');
    setManualRefundNotes('');
    setManualRefundError(null);
  };

  const handleOpenManualRefundModal = () => {
    resetManualRefundForm();
    setShowManualRefundModal(true);
  };

  const handleCloseManualRefundModal = () => {
    resetManualRefundForm();
    setShowManualRefundModal(false);
  };

  const handleSubmitManualRefund = async () => {
    if (!order) return;

    const amount = parseFloat(manualRefundAmountInput);

    if (isNaN(amount) || amount <= 0) {
      setManualRefundError('Please enter a valid refund amount.');
      return;
    }

    if (amount > remainingRefundable) {
      setManualRefundError('Refund amount cannot exceed the remaining balance.');
      return;
    }

    setManualRefundError(null);

    const roundedAmount = Math.round(amount * 100) / 100;

    const result = await processManualRefund({
      orderId: order.id,
      amount: roundedAmount,
      method: manualRefundMethod,
      reason: manualRefundNotes.trim() || undefined,
      adminUserId: adminUser?.id,
    });

    if (result.success) {
      await logOrderActivity({
        orderId: order.id,
        activityType: 'refund_issued',
        description: `Manual refund of $${roundedAmount.toFixed(2)} issued (${manualRefundMethod})`,
        details: { amount: roundedAmount, method: manualRefundMethod, reason: manualRefundNotes.trim() || null },
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      // Restore gift card balance if one was used
      if (order.gift_card_code && order.giftup_transaction_id) {
        try {
          const { data } = await supabase.functions.invoke('giftup-undo-redemption', {
            body: { order_id: order.id }
          });
          if (data?.success) {
            console.log(`Gift card ${order.gift_card_code} balance restored`);
          } else {
            console.warn('Gift card balance could not be restored automatically. Check Gift Up dashboard.');
          }
        } catch (err) {
          console.warn('Gift card undo-redemption failed:', err);
        }
      }

      handleCloseManualRefundModal();
      refetch();
    } else {
      setManualRefundError(result.error || 'Failed to process manual refund');
    }
  };


  const getRefundStatusClasses = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'failed':
      case 'canceled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
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
      shipping_address: {
        name: [order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(' '),
        street: order.shipping_address_line1,
        street2: order.shipping_address_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        zip: order.shipping_zip,
        phone: order.shipping_phone,
      },
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

  const handlePrintInvoice = () => {
    if (!order) return;

    const orderItems = order.items || [];
    const orderNum = order.order_number;
    const orderDate = formatDate(order.created_at);
    const paidDate = formatDate((order as any).paid_at);

    // Line items — compressed rows
    let itemsHtml = '';
    orderItems.forEach((item) => {
      itemsHtml += `
        <tr>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${item.product_name || 'Product'}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px;">${item.quantity}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${formatCurrency(item.line_total)}</td>
        </tr>`;
    });

    // Customer info
    const customerName = order.customer_name || `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim();
    const customerEmail = order.customer_email || '';
    const customerPhone = order.customer_phone || '';
    const customerHtml = `
      <div style="flex: 1;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Customer</h3>
        ${customerName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${customerName}</p>` : ''}
        ${customerEmail ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${customerEmail}</p>` : ''}
        ${customerPhone ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${customerPhone}</p>` : ''}
      </div>`;

    // Bill To
    const billName = `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim();
    const billStreet = order.billing_address_line1;
    const billStreet2 = order.billing_address_line2;
    const billCity = order.billing_city;
    const billState = order.billing_state;
    const billZip = order.billing_zip;
    const billToHtml = `
      <div style="flex: 1;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Bill To</h3>
        ${billName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${billName}</p>` : ''}
        ${billStreet ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${billStreet}</p>` : ''}
        ${billStreet2 ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${billStreet2}</p>` : ''}
        ${billStreet ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${billCity || ''}${billCity && billState ? ', ' : ''}${billState || ''} ${billZip || ''}</p>` : ''}
      </div>`;

    // Ship To / Pickup
    let deliveryHtml = '';
    if (order.is_pickup) {
      const pickupDate = order.pickup_date ? new Date(order.pickup_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const pickupStart = order.pickup_time_start ? formatPickupTime(order.pickup_time_start) : '';
      const pickupEnd = order.pickup_time_end ? formatPickupTime(order.pickup_time_end) : '';
      const timeRange = pickupStart && pickupEnd ? `${pickupStart} - ${pickupEnd}` : pickupStart || '';
      deliveryHtml = `
        <div style="flex: 1;">
          <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Pickup</h3>
          <p style="margin: 0; font-size: 12px; line-height: 1.4;">Local Pickup</p>
          ${pickupDate ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${pickupDate}</p>` : ''}
          ${timeRange ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${timeRange}</p>` : ''}
        </div>`;
    } else {
      const shipName = `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim();
      const shipStreet = order.shipping_address_line1;
      const shipStreet2 = order.shipping_address_line2;
      const shipCity = order.shipping_city;
      const shipState = order.shipping_state;
      const shipZip = order.shipping_zip;
      deliveryHtml = `
        <div style="flex: 1;">
          <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Ship To</h3>
          ${shipName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${shipName}</p>` : ''}
          ${shipStreet ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${shipStreet}</p>` : ''}
          ${shipStreet2 ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${shipStreet2}</p>` : ''}
          ${shipStreet ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${shipCity || ''}${shipCity && shipState ? ', ' : ''}${shipState || ''} ${shipZip || ''}</p>` : ''}
        </div>`;
    }

    // Payment info — reflect actual payment status
    const paymentStatus = (order.payment_status || '').toLowerCase();
    const payMethod = (order as any).payment_method || 'stripe';
    const payMethodLabel = payMethod === 'stripe' ? 'Credit Card (Stripe)' : payMethod === 'purchase_order' ? `Purchase Order (${(order as any).po_number || 'N/A'})` : payMethod.charAt(0).toUpperCase() + payMethod.slice(1);
    const isPaid = ['paid', 'completed', 'refunded'].includes(paymentStatus);
    let paymentDisplayHtml: string;
    if (isPaid) {
      paymentDisplayHtml = `<strong style="color: #111827;">Payment:</strong> ${payMethodLabel}${paidDate && paidDate !== 'N/A' ? ` &mdash; Paid ${paidDate}` : ''}`;
    } else if (paymentStatus === 'pending' || paymentStatus === 'pending_payment') {
      paymentDisplayHtml = `<strong style="color: #111827;">Payment:</strong> <span style="color: #f59e0b; font-weight: 600;">Pending Payment</span>`;
    } else if (paymentStatus === 'failed') {
      paymentDisplayHtml = `<strong style="color: #111827;">Payment:</strong> <span style="color: #ef4444; font-weight: 600;">Payment Failed</span>`;
    } else {
      paymentDisplayHtml = `<strong style="color: #111827;">Payment:</strong> ${paymentStatus || 'Unknown'}`;
    }
    const paymentHtml = `<div style="font-size: 12px; color: #4b5563; line-height: 1.5;">${paymentDisplayHtml}</div>`;

    // Customer notes
    const notesHtml = order.customer_notes ? `
      <div style="font-size: 12px; color: #4b5563; line-height: 1.5; margin-top: 4px;">
        <strong style="color: #111827;">Customer Notes:</strong> ${order.customer_notes}
      </div>` : '';

    // Logo
    const logoUrl = brandingSettings.logo_url;
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="ATL Urban Farms" style="max-height: 48px; width: auto;" />`
      : `<p style="margin: 0 0 4px; font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: 0.5px;">ATL URBAN FARMS</p>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${orderNum} - ATL Urban Farms</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 30px; color: #111827; font-size: 13px; }
          @media print {
            body { padding: 15px; }
            @page { size: portrait; margin: 0.4in; }
          }
        </style>
      </head>
      <body>
        <div style="max-width: 700px; margin: 0 auto;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #10b981; padding-bottom: 14px;">
            <div>
              ${logoHtml}
              <h1 style="margin: 4px 0 0; font-size: 24px; font-weight: 800; color: #111827;">INVOICE</h1>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 700; font-size: 14px;">Order #${orderNum}</p>
              <p style="margin: 3px 0 0; color: #6b7280; font-size: 12px;">Ordered: ${orderDate}</p>
              ${paidDate && paidDate !== 'N/A' ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">Paid: ${paidDate}</p>` : ''}
            </div>
          </div>

          <!-- Customer / Bill To / Ship To — 3 columns -->
          <div style="display: flex; gap: 24px; margin-bottom: 20px;">
            ${customerHtml}
            ${billToHtml}
            ${deliveryHtml}
          </div>

          <!-- Line Items Table -->
          ${itemsHtml ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 5px 6px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Product</th>
                <th style="padding: 5px 6px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Qty</th>
                <th style="padding: 5px 6px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Unit Price</th>
                <th style="padding: 5px 6px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ` : '<p style="color: #6b7280; font-style: italic;">No line items.</p>'}

          <!-- Totals Block -->
          <div style="margin-left: auto; width: 240px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Subtotal</span>
              <span>${formatCurrency(order.subtotal)}</span>
            </div>
            ${order.discount_amount && order.discount_amount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #16a34a;">${(order as any).promotion_code ? `Discount (${(order as any).promotion_code})` : 'Discount'}</span>
              <span style="color: #16a34a;">-${formatCurrency(order.discount_amount)}</span>
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Shipping</span>
              <span>${order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : (order.is_pickup ? 'Pickup' : '$0.00')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Tax</span>
              <span>${formatCurrency(order.tax)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #111827; font-weight: 700; font-size: 15px;">
              <span>Total</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>

          <!-- Payment & Notes -->
          <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            ${paymentHtml}
            ${notesHtml}
          </div>

          <!-- Footer -->
          <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
            <p style="margin: 0;">Thank you for your order!</p>
            <p style="margin: 3px 0 0;">ATL Urban Farms &bull; www.atlurbanfarms.com</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintPackingList = () => {
    if (!order) return;

    const orderItems = order.items || [];
    const orderNum = order.order_number;
    const orderDate = formatDate(order.created_at);

    // Line items — quantity focused, no prices
    let itemsHtml = '';
    orderItems.forEach((item, idx) => {
      itemsHtml += `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${idx + 1}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 600;">${item.product_name || 'Product'}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 15px; font-weight: 700;">${item.quantity}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px; width: 60px;">☐</td>
        </tr>`;
    });

    // Ship To / Pickup destination
    let destinationHtml = '';
    if (order.is_pickup) {
      const pickupDate = order.pickup_date ? new Date(order.pickup_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const pickupStart = order.pickup_time_start ? formatPickupTime(order.pickup_time_start) : '';
      const pickupEnd = order.pickup_time_end ? formatPickupTime(order.pickup_time_end) : '';
      const timeRange = pickupStart && pickupEnd ? `${pickupStart} - ${pickupEnd}` : pickupStart || '';
      destinationHtml = `
        <div>
          <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 6px;">Pickup</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; font-weight: 600;">Local Pickup</p>
          ${pickupDate ? `<p style="margin: 0; font-size: 13px; line-height: 1.5;">${pickupDate}</p>` : ''}
          ${timeRange ? `<p style="margin: 0; font-size: 13px; line-height: 1.5;">${timeRange}</p>` : ''}
        </div>`;
    } else {
      const shipName = `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim();
      const shipStreet = order.shipping_address_line1;
      const shipStreet2 = order.shipping_address_line2;
      const shipCity = order.shipping_city;
      const shipState = order.shipping_state;
      const shipZip = order.shipping_zip;
      destinationHtml = `
        <div>
          <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 6px;">Ship To</h3>
          ${shipName ? `<p style="margin: 0; font-size: 14px; line-height: 1.5; font-weight: 600;">${shipName}</p>` : ''}
          ${shipStreet ? `<p style="margin: 0; font-size: 13px; line-height: 1.5;">${shipStreet}</p>` : ''}
          ${shipStreet2 ? `<p style="margin: 0; font-size: 13px; line-height: 1.5;">${shipStreet2}</p>` : ''}
          ${shipStreet ? `<p style="margin: 0; font-size: 13px; line-height: 1.5;">${shipCity || ''}${shipCity && shipState ? ', ' : ''}${shipState || ''} ${shipZip || ''}</p>` : ''}
        </div>`;
    }

    // Shipping method
    const shippingMethod = order.is_pickup ? 'Local Pickup' : (order.shipping_method || order.shipping_carrier || 'Standard Shipping');

    // Customer notes
    const notesHtml = order.customer_notes ? `
      <div style="margin-top: 16px; padding: 12px; background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin: 0 0 4px;">Customer Notes</h3>
        <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${order.customer_notes}</p>
      </div>` : '';

    // Logo
    const logoUrl = brandingSettings.logo_url;
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="ATL Urban Farms" style="max-height: 40px; width: auto;" />`
      : `<p style="margin: 0; font-size: 16px; font-weight: 800; color: #10b981;">ATL URBAN FARMS</p>`;

    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packing List #${orderNum} - ATL Urban Farms</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 30px; color: #111827; font-size: 13px; }
          @media print {
            body { padding: 15px; }
            @page { size: portrait; margin: 0.4in; }
          }
        </style>
      </head>
      <body>
        <div style="max-width: 700px; margin: 0 auto;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #10b981; padding-bottom: 14px;">
            <div>
              ${logoHtml}
              <h1 style="margin: 4px 0 0; font-size: 24px; font-weight: 800; color: #111827;">PACKING LIST</h1>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 700; font-size: 14px;">Order #${orderNum}</p>
              <p style="margin: 3px 0 0; color: #6b7280; font-size: 12px;">Date: ${orderDate}</p>
              <p style="margin: 3px 0 0; color: #6b7280; font-size: 12px;">Method: ${shippingMethod}</p>
            </div>
          </div>

          <!-- Destination -->
          <div style="margin-bottom: 20px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${destinationHtml}
          </div>

          ${notesHtml}

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 6px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; width: 30px;">#</th>
                <th style="padding: 6px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Item</th>
                <th style="padding: 6px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; width: 60px;">Qty</th>
                <th style="padding: 6px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; width: 60px;">Packed</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <!-- Summary -->
          <div style="margin-top: 16px; padding-top: 12px; border-top: 2px solid #111827; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">Total Items: <strong style="color: #111827;">${totalItems}</strong> (${orderItems.length} unique)</span>
          </div>

          <!-- Packed By -->
          <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Packed By</p>
              <div style="margin-top: 6px; width: 200px; border-bottom: 1px solid #d1d5db;">&nbsp;</div>
            </div>
            <div>
              <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Date</p>
              <div style="margin-top: 6px; width: 120px; border-bottom: 1px solid #d1d5db;">&nbsp;</div>
            </div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Inline editing: start-edit helpers ---
  const startEditStatus = () => {
    if (!order) return;
    setStatusForm({
      status: order.status,
      payment_status: order.payment_status || '',
      internal_notes: order.internal_notes || '',
      customer_notes: order.customer_notes || '',
    });
    setEditingStatus(true);
  };

  const startEditShipping = () => {
    if (!order) return;
    setShippingForm({
      shipping_first_name: order.shipping_first_name || '',
      shipping_last_name: order.shipping_last_name || '',
      shipping_address_line1: order.shipping_address_line1 || '',
      shipping_address_line2: order.shipping_address_line2 || '',
      shipping_city: order.shipping_city || '',
      shipping_state: order.shipping_state || '',
      shipping_zip: order.shipping_zip || '',
      shipping_phone: order.shipping_phone || order.customer_phone || '',
    });
    setEditingShipping(true);
  };

  const startEditBilling = () => {
    if (!order) return;
    setBillingForm({
      billing_first_name: order.billing_first_name || '',
      billing_last_name: order.billing_last_name || '',
      billing_address_line1: order.billing_address_line1 || '',
      billing_address_line2: order.billing_address_line2 || '',
      billing_city: order.billing_city || '',
      billing_state: order.billing_state || '',
      billing_zip: order.billing_zip || '',
    });
    setEditingBilling(true);
  };

  const startEditTracking = () => {
    if (!order) return;
    setTrackingForm({
      shipping_method_name: order.shipping_method_name || order.shipping_method || '',
      shipping_cost: order.shipping_cost || 0,
      tracking_number: order.tracking_number || '',
      tracking_url: order.tracking_url || '',
      estimated_delivery_date: order.estimated_delivery_date || '',
    });
    setEditingTracking(true);
  };

  // --- Inline editing: save handlers ---
  const handleSaveStatus = async () => {
    if (!order) return;
    setSavingStatus(true);
    try {
      // Capture previous status BEFORE the update for history tracking
      const previousStatus = order.status;
      const newOrderStatus = statusForm.status;

      const { error: err } = await supabase.from('orders').update({
        status: newOrderStatus,
        payment_status: statusForm.payment_status,
        internal_notes: statusForm.internal_notes || null,
        customer_notes: statusForm.customer_notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (err) throw err;

      // Record status change in order_status_history if status actually changed
      if (newOrderStatus !== previousStatus) {
        const { error: historyError } = await supabase
          .from('order_status_history')
          .insert({
            order_id: order.id,
            status: newOrderStatus,
            from_status: previousStatus || null,
            changed_by: adminUser?.id || null,
            change_source: 'admin',
          });
        if (historyError) {
          console.warn('Could not add status history:', historyError);
        }
      }

      // Log payment status change
      if (statusForm.payment_status !== order.payment_status) {
        await logOrderActivity({
          orderId: order.id,
          activityType: 'payment_status_changed',
          description: `Payment status changed from ${order.payment_status || 'none'} to ${statusForm.payment_status}`,
          details: { from: order.payment_status, to: statusForm.payment_status },
          createdBy: adminUser?.id,
          createdByName: adminUser?.email || 'Admin',
        });
      }

      // Log notes changes
      if (statusForm.internal_notes !== (order.internal_notes || '') || statusForm.customer_notes !== (order.customer_notes || '')) {
        await logOrderActivity({
          orderId: order.id,
          activityType: 'notes_updated',
          description: 'Order notes updated',
          createdBy: adminUser?.id,
          createdByName: adminUser?.email || 'Admin',
        });
      }

      setToast({ message: 'Status & payment updated', type: 'success' });
      setEditingStatus(false);
      refetch();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update', type: 'error' });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!order) return;
    setSavingShipping(true);
    try {
      const { error: err } = await supabase.from('orders').update({
        shipping_first_name: shippingForm.shipping_first_name,
        shipping_last_name: shippingForm.shipping_last_name,
        shipping_address_line1: shippingForm.shipping_address_line1,
        shipping_address_line2: shippingForm.shipping_address_line2,
        shipping_city: shippingForm.shipping_city,
        shipping_state: shippingForm.shipping_state,
        shipping_zip: shippingForm.shipping_zip,
        shipping_phone: shippingForm.shipping_phone,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (err) throw err;

      await logOrderActivity({
        orderId: order.id,
        activityType: 'shipping_address_updated',
        description: 'Shipping address updated',
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      setToast({ message: 'Shipping address updated', type: 'success' });
      setEditingShipping(false);
      refetch();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update shipping address', type: 'error' });
    } finally {
      setSavingShipping(false);
    }
  };

  const handleSaveBilling = async () => {
    if (!order) return;
    setSavingBilling(true);
    try {
      const { error: err } = await supabase.from('orders').update({
        billing_first_name: billingForm.billing_first_name,
        billing_last_name: billingForm.billing_last_name,
        billing_address_line1: billingForm.billing_address_line1,
        billing_address_line2: billingForm.billing_address_line2,
        billing_city: billingForm.billing_city,
        billing_state: billingForm.billing_state,
        billing_zip: billingForm.billing_zip,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (err) throw err;

      await logOrderActivity({
        orderId: order.id,
        activityType: 'billing_address_updated',
        description: 'Billing address updated',
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      setToast({ message: 'Billing address updated', type: 'success' });
      setEditingBilling(false);
      refetch();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update billing address', type: 'error' });
    } finally {
      setSavingBilling(false);
    }
  };

  const handleSaveTracking = async () => {
    if (!order) return;
    setSavingTracking(true);
    try {
      const newShippingCost = parseFloat(trackingForm.shipping_cost.toString()) || 0;
      const newTotal = (order.subtotal || 0) + newShippingCost + (order.tax || 0) - (order.discount_amount || 0);
      const { error: err } = await supabase.from('orders').update({
        shipping_method_name: trackingForm.shipping_method_name,
        shipping_cost: newShippingCost,
        tracking_number: trackingForm.tracking_number,
        tracking_url: trackingForm.tracking_url,
        estimated_delivery_date: trackingForm.estimated_delivery_date || null,
        total: newTotal,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (err) throw err;

      await logOrderActivity({
        orderId: order.id,
        activityType: 'tracking_updated',
        description: trackingForm.tracking_number
          ? `Tracking updated: ${trackingForm.tracking_number}`
          : 'Shipping & tracking info updated',
        details: {
          tracking_number: trackingForm.tracking_number || null,
          shipping_method: trackingForm.shipping_method_name || null,
          shipping_cost: newShippingCost,
        },
        createdBy: adminUser?.id,
        createdByName: adminUser?.email || 'Admin',
      });

      setToast({ message: 'Shipping & tracking updated', type: 'success' });
      setEditingTracking(false);
      refetch();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update tracking', type: 'error' });
    } finally {
      setSavingTracking(false);
    }
  };

  // Payment status badge helper
  const getPaymentStatusBadge = (paymentStatus: string | null | undefined) => {
    const status = paymentStatus || 'unknown';
    const config: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'bg-amber-500' },
      paid: { label: 'Paid', color: 'bg-emerald-500' },
      partial: { label: 'Partial', color: 'bg-blue-500' },
      failed: { label: 'Failed', color: 'bg-red-500' },
      refunded: { label: 'Refunded', color: 'bg-purple-500' },
    };
    const c = config[status] || { label: status, color: 'bg-slate-500' };
    return (
      <span className={`${c.color} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
        {c.label}
      </span>
    );
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
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
              </button>
            )}
            <button
              onClick={() => onBack()}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Orders
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
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
  const paidStates = new Set(['paid', 'processing', 'on_hold', 'completed', 'refunded']);
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
      {/* Print stylesheet: hide chrome, show only order content */}
      <style>{`
        @media print {
          /* Hide sidebar, header, and nav */
          nav, header, aside,
          [class*="AdminSidebar"], [class*="AdminHeader"],
          .ml-64 > header:first-child {
            display: none !important;
          }
          /* Remove sidebar margin */
          .ml-64 {
            margin-left: 0 !important;
          }
          /* Clean up spacing */
          body { background: white !important; }
          .shadow-sm { box-shadow: none !important; }
          .border { border-color: #e2e8f0 !important; }
        }
      `}</style>
      <div className="space-y-6 print:space-y-4">
        {/* Back Buttons + Order Navigation */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            {onBackToCustomer && (
              <button
                onClick={onBackToCustomer}
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
              </button>
            )}
            <button
              onClick={() => onBack()}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Orders
            </button>
          </div>
          {onNavigateOrder && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => prevOrderId && onNavigateOrder(prevOrderId)}
                disabled={!prevOrderId}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous order (older)"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <button
                onClick={() => nextOrderId && onNavigateOrder(nextOrderId)}
                disabled={!nextOrderId}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next order (newer)"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <ErrorBoundary
          fallback={
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-red-800 font-semibold">Unable to display order details</h3>
                  <p className="text-red-600 text-sm mt-1">
                    This order may have corrupted or missing data. Please check the database for issues with order #{order.order_number}.
                  </p>
                  <p className="text-red-500 text-xs mt-2">
                    Common issues: Missing pickup location data, invalid JSON in address fields, or deleted related records.
                  </p>
                </div>
              </div>
            </div>
          }
        >
        {/* Order Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800 font-mono font-admin-display">
                  {order.order_number}
                </h1>
                {getStatusBadge(order.status)}
              </div>
              <p className="text-slate-500 mt-1">
                Placed on {formatDate(order.created_at, true)}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handlePrintInvoice}
                title="Print a clean invoice for this order"
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Invoice
              </button>
              <button
                onClick={handlePrintPackingList}
                title="Print a packing list for fulfillment"
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Packing List
              </button>
              <button
                onClick={handleExport}
                title="Download order data as JSON for backup or integration purposes"
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Section 1: Order Status & Payment */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Order Status & Payment</h2>
            {!editingStatus && (
              <button onClick={startEditStatus} className="text-slate-400 hover:text-emerald-600 transition-colors print:hidden" title="Edit status & payment">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {editingStatus && (
              <div className="flex items-center gap-2 print:hidden">
                <button onClick={handleSaveStatus} disabled={savingStatus} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {savingStatus && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                  {savingStatus ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingStatus(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              </div>
            )}
          </div>
          <div className="p-6">
            {!editingStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Order Status</p>
                  {getStatusBadge(order.status)}
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Payment Status</p>
                  {getPaymentStatusBadge(order.payment_status)}
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Customer Notes</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{order.customer_notes || <span className="text-slate-300 italic">None</span>}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-600">Order Status</label>
                  <select value={statusForm.status} onChange={(e) => setStatusForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {ORDER_STATUSES.filter(s => order.is_pickup ? s !== 'shipped' : s !== 'picked_up').map((status) => (
                      <option key={status} value={status}>{ORDER_STATUS_CONFIG[status].label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-600">Payment Status</label>
                  <select value={statusForm.payment_status} onChange={(e) => setStatusForm(f => ({ ...f, payment_status: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-600">Customer Notes</label>
                  <textarea value={statusForm.customer_notes} onChange={(e) => setStatusForm(f => ({ ...f, customer_notes: e.target.value }))} rows={3} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none" placeholder="Customer notes..." />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Order Info (only for PO orders) */}
        {(order as any).payment_method === 'purchase_order' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Purchase Order</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">PO Number</p>
                  <p className="text-slate-900 font-bold">{(order as any).po_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">PO Status</p>
                  {(() => {
                    const poStatus = (order as any).po_status || 'pending_verification';
                    const statusColors: Record<string, string> = {
                      pending_verification: 'bg-amber-100 text-amber-700 border-amber-200',
                      verified: 'bg-blue-100 text-blue-700 border-blue-200',
                      invoiced: 'bg-purple-100 text-purple-700 border-purple-200',
                      paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      cancelled: 'bg-red-100 text-red-700 border-red-200',
                    };
                    const statusLabels: Record<string, string> = {
                      pending_verification: 'Pending Verification',
                      verified: 'Verified',
                      invoiced: 'Invoiced',
                      paid: 'Paid',
                      cancelled: 'Cancelled',
                    };
                    return (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColors[poStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {statusLabels[poStatus] || poStatus}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Verified</p>
                  <p className="text-slate-600 text-sm">
                    {(order as any).po_verified_at
                      ? new Date((order as any).po_verified_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Paid</p>
                  <p className="text-slate-600 text-sm">
                    {(order as any).po_paid_at
                      ? new Date((order as any).po_paid_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer and Shipping Info - Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Customer</h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-slate-800 font-medium">
                  {order.customer_name || <span className="text-slate-400 italic">Guest</span>}
                </p>
              </div>
              {order.customer_email ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${order.customer_email}`} className="hover:text-emerald-600">
                    {order.customer_email}
                  </a>
                </div>
              ) : (
                <p className="text-slate-400 italic text-sm">No email on file</p>
              )}
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${order.customer_phone}`} className="hover:text-emerald-600">
                    {order.customer_phone}
                  </a>
                </div>
              )}
              {order.customer_id && (
                <span className="inline-flex items-center gap-1 text-slate-400 text-sm mt-2 print:hidden">
                  Customer ID: {order.customer_id.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>

          {/* Ship To Card - Pickup or Shipping */}
          {order.is_pickup && order.pickup_reservation && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Pickup Location</h2>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.pickup_reservation.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' :
                    order.pickup_reservation.status === 'missed' ? 'bg-red-100 text-red-700' :
                    order.pickup_reservation.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {order.pickup_reservation.status === 'picked_up' ? 'Picked Up' :
                     order.pickup_reservation.status === 'missed' ? 'Missed' :
                     order.pickup_reservation.status === 'cancelled' ? 'Cancelled' :
                     'Scheduled'}
                  </span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {order.pickup_reservation.location ? (
                  <>
                    <div>
                      <p className="font-medium text-slate-800">{order.pickup_reservation.location.name}</p>
                      <address className="text-slate-600 not-italic leading-relaxed mt-1">
                        <p>{order.pickup_reservation.location.address_line1}</p>
                        {order.pickup_reservation.location.address_line2 && (
                          <p>{order.pickup_reservation.location.address_line2}</p>
                        )}
                        <p>
                          {order.pickup_reservation.location.city}, {order.pickup_reservation.location.state} {order.pickup_reservation.location.postal_code}
                        </p>
                      </address>
                      {order.pickup_reservation.location.phone && (
                        <p className="text-slate-500 text-sm mt-2">{order.pickup_reservation.location.phone}</p>
                      )}
                    </div>

                    {order.pickup_reservation.location.instructions && (
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-slate-400 text-sm">Pickup Instructions</p>
                        <p className="text-slate-600 text-sm mt-1">{order.pickup_reservation.location.instructions}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-700 font-medium">Pickup Location Unavailable</p>
                    <p className="text-amber-600 text-sm mt-1">
                      The pickup location data is missing or has been deleted. Please contact the customer to arrange an alternative.
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-4">
                  <p className="text-slate-400 text-sm">Pickup Date & Time</p>
                  <p className="text-slate-800 font-medium">
                    {order.pickup_reservation.pickup_date ? new Date(order.pickup_reservation.pickup_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Date not specified'}
                  </p>
                  <p className="text-slate-600">
                    {order.pickup_reservation.pickup_time_start && order.pickup_reservation.pickup_time_end
                      ? `${formatPickupTime(order.pickup_reservation.pickup_time_start)} - ${formatPickupTime(order.pickup_reservation.pickup_time_end)}`
                      : 'Time not specified'}
                  </p>
                </div>

                {/* Convert to Ship Order */}
                <div className="border-t border-slate-200 pt-4 print:hidden">
                  <button
                    onClick={() => setShowConvertToShipModal(true)}
                    className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Convert to Ship Order
                  </button>
                </div>

                {/* Override: allow creating a shipping label on a pickup order */}
                {!overridePickup && !shipment && (
                  <div className="pt-2 print:hidden">
                    <button
                      onClick={() => setOverridePickup(true)}
                      className="text-sm text-amber-600 underline hover:text-amber-800"
                    >
                      Create shipping label anyway (override)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Section 2: Shipping Address (editable) — always visible so admins can add/edit shipping on any order */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Shipping Address</h2>
                {!editingShipping && (
                  <button onClick={startEditShipping} className="text-slate-400 hover:text-emerald-600 transition-colors print:hidden" title="Edit shipping address">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {editingShipping && (
                  <div className="flex items-center gap-2 print:hidden">
                    <button onClick={handleSaveShipping} disabled={savingShipping} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {savingShipping && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                      {savingShipping ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingShipping(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                  </div>
                )}
              </div>
              <div className="p-6">
                {!editingShipping ? (
                  <div className="space-y-4">
                    {order.shipping_address_line1 ? (
                      <address className="text-slate-600 not-italic leading-relaxed">
                        <p className="font-medium text-slate-800">{[order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(' ') || 'Name not provided'}</p>
                        <p>{order.shipping_address_line1}</p>
                        {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
                        <p>
                          {order.shipping_city || 'City'}, {order.shipping_state || 'State'} {order.shipping_zip || 'ZIP'}
                        </p>
                      </address>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-slate-400 italic">No shipping address</p>
                        {order.is_pickup && (
                          <button onClick={startEditShipping} className="mt-2 text-sm text-emerald-600 underline hover:text-emerald-800 print:hidden">
                            Add shipping address to convert to shipped order
                          </button>
                        )}
                      </div>
                    )}
                    {(order.shipping_phone || order.customer_phone) && (
                      <p className="text-slate-500 text-sm">{order.shipping_phone || order.customer_phone}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">First Name</label>
                        <input type="text" value={shippingForm.shipping_first_name} onChange={(e) => setShippingForm(f => ({ ...f, shipping_first_name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">Last Name</label>
                        <input type="text" value={shippingForm.shipping_last_name} onChange={(e) => setShippingForm(f => ({ ...f, shipping_last_name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">Address Line 1</label>
                      <input type="text" value={shippingForm.shipping_address_line1} onChange={(e) => setShippingForm(f => ({ ...f, shipping_address_line1: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">Address Line 2</label>
                      <input type="text" value={shippingForm.shipping_address_line2} onChange={(e) => setShippingForm(f => ({ ...f, shipping_address_line2: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Apt, Suite, etc." />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">City</label>
                        <input type="text" value={shippingForm.shipping_city} onChange={(e) => setShippingForm(f => ({ ...f, shipping_city: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">State</label>
                        <input type="text" value={shippingForm.shipping_state} onChange={(e) => setShippingForm(f => ({ ...f, shipping_state: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">ZIP</label>
                        <input type="text" value={shippingForm.shipping_zip} onChange={(e) => setShippingForm(f => ({ ...f, shipping_zip: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">Phone</label>
                      <input type="text" value={shippingForm.shipping_phone} onChange={(e) => setShippingForm(f => ({ ...f, shipping_phone: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Section 3: Billing Address & Section 4: Shipping Method & Tracking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 3: Billing Address */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Billing Address</h2>
              {!editingBilling && (
                <button onClick={startEditBilling} className="text-slate-400 hover:text-emerald-600 transition-colors print:hidden" title="Edit billing address">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {editingBilling && (
                <div className="flex items-center gap-2 print:hidden">
                  <button onClick={handleSaveBilling} disabled={savingBilling} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {savingBilling && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                    {savingBilling ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingBilling(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                </div>
              )}
            </div>
            <div className="p-6">
              {!editingBilling ? (
                <div>
                  {order.billing_address_line1 ? (
                    <address className="text-slate-600 not-italic leading-relaxed">
                      <p className="font-medium text-slate-800">{`${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim() || 'Name not provided'}</p>
                      <p>{order.billing_address_line1 || 'Street not provided'}</p>
                      {order.billing_address_line2 && <p>{order.billing_address_line2}</p>}
                      <p>
                        {order.billing_city || 'City'}, {order.billing_state || 'State'} {order.billing_zip || 'ZIP'}
                      </p>
                    </address>
                  ) : (
                    <p className="text-slate-400 italic">No billing address on file</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">First Name</label>
                      <input type="text" value={billingForm.billing_first_name} onChange={(e) => setBillingForm(f => ({ ...f, billing_first_name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">Last Name</label>
                      <input type="text" value={billingForm.billing_last_name} onChange={(e) => setBillingForm(f => ({ ...f, billing_last_name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Address Line 1</label>
                    <input type="text" value={billingForm.billing_address_line1} onChange={(e) => setBillingForm(f => ({ ...f, billing_address_line1: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Address Line 2</label>
                    <input type="text" value={billingForm.billing_address_line2} onChange={(e) => setBillingForm(f => ({ ...f, billing_address_line2: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Apt, Suite, etc." />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">City</label>
                      <input type="text" value={billingForm.billing_city} onChange={(e) => setBillingForm(f => ({ ...f, billing_city: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">State</label>
                      <input type="text" value={billingForm.billing_state} onChange={(e) => setBillingForm(f => ({ ...f, billing_state: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">ZIP</label>
                      <input type="text" value={billingForm.billing_zip} onChange={(e) => setBillingForm(f => ({ ...f, billing_zip: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Pickup Info (for pickup orders) or Shipping Method & Tracking (for shipped orders) */}
          {order.is_pickup ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Pickup Info</h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-400 text-sm">Delivery Method</p>
                    <p className="text-slate-700 font-medium">Local Pickup</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Pickup Location</p>
                    <p className="text-slate-700 font-medium">
                      {order.pickup_reservation?.location?.name || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Pickup Date</p>
                    <p className="text-slate-700">
                      {order.pickup_reservation?.pickup_date
                        ? new Date(order.pickup_reservation.pickup_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : <span className="text-slate-300 italic">Not scheduled</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Pickup Time</p>
                    <p className="text-slate-700">
                      {order.pickup_reservation?.pickup_time_start && order.pickup_reservation?.pickup_time_end
                        ? `${formatPickupTime(order.pickup_reservation.pickup_time_start)} - ${formatPickupTime(order.pickup_reservation.pickup_time_end)}`
                        : <span className="text-slate-300 italic">Not specified</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Status</p>
                    <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${
                      order.pickup_reservation?.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' :
                      order.pickup_reservation?.status === 'missed' ? 'bg-red-100 text-red-700' :
                      order.pickup_reservation?.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {order.pickup_reservation?.status === 'picked_up' ? 'Picked Up' :
                       order.pickup_reservation?.status === 'missed' ? 'Missed' :
                       order.pickup_reservation?.status === 'cancelled' ? 'Cancelled' :
                       'Scheduled'}
                    </span>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Cost</p>
                    <p className="text-slate-700">{formatCurrency(order.shipping_cost)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Shipping Method{shipment && !shipment.voided ? '' : ' & Tracking'}</h2>
              {!editingTracking && (
                <button onClick={startEditTracking} className="text-slate-400 hover:text-emerald-600 transition-colors print:hidden" title="Edit shipping & tracking">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {editingTracking && (
                <div className="flex items-center gap-2 print:hidden">
                  <button onClick={handleSaveTracking} disabled={savingTracking} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {savingTracking && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                    {savingTracking ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingTracking(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                </div>
              )}
            </div>
            <div className="p-6">
              {!editingTracking ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-400 text-sm">Shipping Method</p>
                    <p className="text-slate-700 font-medium">{order.shipping_method_name || order.shipping_method || 'Standard Shipping'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Shipping Cost</p>
                    <p className="text-slate-700">{formatCurrency(order.shipping_cost)}</p>
                  </div>
                  {/* Only show tracking fields when no active shipment — Section 5 handles tracking in that case */}
                  {!(shipment && !shipment.voided) && (
                    <>
                      <div>
                        <p className="text-slate-400 text-sm">Tracking Number</p>
                        <p className="text-slate-700">{order.tracking_number || <span className="text-slate-300 italic">None</span>}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Tracking URL</p>
                        {order.tracking_url ? (
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm break-all">{order.tracking_url}</a>
                        ) : (
                          <p className="text-slate-300 italic">None</p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Estimated Delivery</p>
                        <p className="text-slate-700">{order.estimated_delivery_date ? formatDate(order.estimated_delivery_date) : order.estimated_delivery ? formatDate(order.estimated_delivery) : <span className="text-slate-300 italic">Not set</span>}</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Shipping Method</label>
                    <input type="text" value={trackingForm.shipping_method_name} onChange={(e) => setTrackingForm(f => ({ ...f, shipping_method_name: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-500">Shipping Cost ($)</label>
                    <input type="number" step="0.01" min="0" value={trackingForm.shipping_cost} onChange={(e) => setTrackingForm(f => ({ ...f, shipping_cost: parseFloat(e.target.value) || 0 }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  {/* Only show tracking edit fields when no active shipment */}
                  {!(shipment && !shipment.voided) && (
                    <>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">Tracking Number</label>
                        <input type="text" value={trackingForm.tracking_number} onChange={(e) => setTrackingForm(f => ({ ...f, tracking_number: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">Tracking URL</label>
                        <input type="text" value={trackingForm.tracking_url} onChange={(e) => setTrackingForm(f => ({ ...f, tracking_url: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="https://..." />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-500">Estimated Delivery Date</label>
                        <input type="date" value={trackingForm.estimated_delivery_date} onChange={(e) => setTrackingForm(f => ({ ...f, estimated_delivery_date: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Section 5: Shipping Label — only for shipping orders (or pickup with override/existing label) */}
        {(!order.is_pickup || overridePickup || shipment) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Shipping Label</h2>
              {shipmentLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            <div className="p-6">
              {labelError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{labelError}</span>
                </div>
              )}

              {canCreateLabel ? (
                /* STATE A: Create Label Form */
                <div className="space-y-4">
                  {/* Package List */}
                  {labelPackages.map((pkg, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Package {i + 1}</span>
                        {labelPackages.length > 1 && (
                          <button
                            onClick={() => setLabelPackages(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove package"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <input
                            type="number" step="0.1" min="0.1"
                            value={pkg.weight}
                            onChange={(e) => setLabelPackages(prev => prev.map((p, idx) => idx === i ? { ...p, weight: parseFloat(e.target.value) || 0 } : p))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <span className="text-xs text-slate-400 mt-0.5 block text-center">lbs</span>
                        </div>
                        <div>
                          <input
                            type="number" step="0.1" min="1"
                            value={pkg.length}
                            onChange={(e) => setLabelPackages(prev => prev.map((p, idx) => idx === i ? { ...p, length: parseFloat(e.target.value) || 0 } : p))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="L"
                          />
                          <span className="text-xs text-slate-400 mt-0.5 block text-center">L</span>
                        </div>
                        <div>
                          <input
                            type="number" step="0.1" min="1"
                            value={pkg.width}
                            onChange={(e) => setLabelPackages(prev => prev.map((p, idx) => idx === i ? { ...p, width: parseFloat(e.target.value) || 0 } : p))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="W"
                          />
                          <span className="text-xs text-slate-400 mt-0.5 block text-center">W</span>
                        </div>
                        <div>
                          <input
                            type="number" step="0.1" min="1"
                            value={pkg.height}
                            onChange={(e) => setLabelPackages(prev => prev.map((p, idx) => idx === i ? { ...p, height: parseFloat(e.target.value) || 0 } : p))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="H"
                          />
                          <span className="text-xs text-slate-400 mt-0.5 block text-center">H</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Package Button */}
                  <button
                    onClick={() => setLabelPackages(prev => [...prev, prev[0] || { weight: 1, length: 12, width: 5, height: 5 }])}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Package
                  </button>

                  {/* Recalculate Rates Button */}
                  <button
                    onClick={async () => {
                      if (!order) return;
                      setRatesLoading(true);
                      setLabelError(null);
                      setFetchedRates([]);
                      setSelectedRate(null);
                      try {
                        const shipTo = {
                          name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
                          address_line1: order.shipping_address_line1 || '',
                          address_line2: order.shipping_address_line2 || '',
                          city_locality: order.shipping_city || '',
                          state_province: order.shipping_state || '',
                          postal_code: order.shipping_zip || '',
                          country_code: 'US',
                        };
                        const packages = labelPackages.map(pkg => ({
                          weight: { value: pkg.weight, unit: 'pound' as const },
                          dimensions: { length: pkg.length, width: pkg.width, height: pkg.height, unit: 'inch' as const },
                        }));
                        const { data, error: fnError } = await supabase.functions.invoke('shipengine-get-rates', {
                          body: { ship_to: shipTo, packages, is_admin: true },
                        });
                        if (fnError) throw new Error(fnError.message || 'Failed to fetch rates');
                        if (!data.success) throw new Error(data.error?.message || 'Failed to fetch rates');
                        setFetchedRates(data.rates || []);
                        if ((data.rates || []).length === 0) {
                          setLabelError('No rates returned. Check package dimensions and shipping address.');
                        }
                      } catch (err: any) {
                        setLabelError(err.message || 'Failed to fetch rates');
                      } finally {
                        setRatesLoading(false);
                      }
                    }}
                    disabled={ratesLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 border border-slate-200 disabled:opacity-50 transition-colors"
                  >
                    {ratesLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fetching Rates...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Recalculate Rates
                      </>
                    )}
                  </button>

                  {/* Rates List */}
                  {fetchedRates.length > 0 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">Select Rate</label>
                      <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2">
                        {fetchedRates.map((rate) => (
                          <button
                            key={rate.rate_id}
                            onClick={async () => {
                              setSelectedRate(rate);
                              setLabelServiceCode(rate.service_code);
                              if (!order) return;
                              try {
                                const { error: updateErr } = await supabase.from('orders').update({
                                  shipping_rate_id: rate.rate_id,
                                  shipping_method_name: `${rate.carrier_friendly_name} ${rate.service_type}`,
                                  shipping_carrier_id: rate.carrier_id,
                                  shipping_service_code: rate.service_code,
                                  updated_at: new Date().toISOString(),
                                }).eq('id', order.id);
                                if (updateErr) console.error('Failed to save rate to order:', updateErr);
                                else refetch();
                              } catch (err) {
                                console.error('Failed to save rate to order:', err);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedRate?.rate_id === rate.rate_id
                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{rate.carrier_friendly_name}</span>
                              <span className="font-semibold">${rate.shipping_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-slate-500">{rate.service_type}</span>
                              <div className="flex items-center gap-2">
                                {rate.customer_amount != null && rate.customer_amount !== rate.shipping_amount && (
                                  <span className="text-xs text-amber-600">cust. paid ${rate.customer_amount.toFixed(2)}</span>
                                )}
                                {rate.delivery_days != null && (
                                  <span className="text-xs text-slate-500">{rate.delivery_days} day{rate.delivery_days !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback UPS Service dropdown (when no rates fetched) */}
                  {fetchedRates.length === 0 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-500">UPS Service</label>
                      <select
                        value={labelServiceCode}
                        onChange={(e) => setLabelServiceCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="ups_ground">UPS Ground</option>
                        <option value="ups_2nd_day_air">UPS 2nd Day Air</option>
                        <option value="ups_3_day_select">UPS 3 Day Select</option>
                      </select>
                    </div>
                  )}

                  {/* Create Shipping Label Button */}
                  <button
                    onClick={async () => {
                      setLabelCreating(true);
                      setLabelError(null);
                      const packagesPayload = labelPackages.map(pkg => ({
                        weight: { value: pkg.weight, unit: 'pound' as const },
                        dimensions: { length: pkg.length, width: pkg.width, height: pkg.height, unit: 'inch' as const },
                      }));
                      const result = await createLabel({
                        service_code: selectedRate?.service_code || labelServiceCode,
                        rate_id: selectedRate?.rate_id,
                        package_weight_lbs: labelPackages[0].weight,
                        package_length: labelPackages[0].length,
                        package_width: labelPackages[0].width,
                        package_height: labelPackages[0].height,
                        packages: packagesPayload,
                      });
                      setLabelCreating(false);
                      if (!result.success) {
                        if (result.error?.code === 'MISSING_SHIPPING_ADDRESS') {
                          setLabelError('This is a pickup order with no shipping address. Edit the shipping address section above before creating a label.');
                        } else {
                          setLabelError(result.error?.message || 'Failed to create label');
                        }
                      } else {
                        setLabelError(null);
                        refetch();
                        refetchShipment();
                      }
                    }}
                    disabled={labelCreating || shipmentLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {labelCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Label...
                      </>
                    ) : (
                      'Create Shipping Label'
                    )}
                  </button>
                </div>
              ) : shipment && !shipment.voided ? (
                /* STATE B: Label Exists */
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-slate-400 text-sm">Tracking Number</p>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const trackingUrl = order.tracking_url || (shipment.tracking_number
                            ? (shipment.carrier_code === 'usps'
                              ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${shipment.tracking_number}`
                              : `https://www.ups.com/track?tracknum=${shipment.tracking_number}`)
                            : null);
                          return shipment.tracking_number && trackingUrl ? (
                            <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 font-medium font-mono">{shipment.tracking_number}</a>
                          ) : (
                            <p className="text-slate-700 font-medium font-mono">{shipment.tracking_number || 'N/A'}</p>
                          );
                        })()}
                        {shipment.tracking_number && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(shipment.tracking_number!);
                              setCopiedTracking(true);
                              setTimeout(() => setCopiedTracking(false), 2000);
                            }}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                            title="Copy tracking number"
                          >
                            {copiedTracking ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Carrier & Service</p>
                      <p className="text-slate-700">{(shipment.carrier_code || 'UPS').toUpperCase()} — {shipment.service_code?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Label Cost</p>
                      <p className="text-slate-700">{shipment.shipment_cost != null ? `$${Number(shipment.shipment_cost).toFixed(2)}` : 'N/A'}</p>
                    </div>
                    {shipment.tracking_status && (
                      <div>
                        <p className="text-slate-400 text-sm">Tracking Status</p>
                        <p className="text-slate-700">{shipment.tracking_status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}{shipment.tracking_status_description ? ` — ${shipment.tracking_status_description}` : ''}</p>
                      </div>
                    )}
                    {shipment.estimated_delivery_date && (
                      <div>
                        <p className="text-slate-400 text-sm">Estimated Delivery</p>
                        <p className="text-slate-700">{formatDate(shipment.estimated_delivery_date)}</p>
                      </div>
                    )}
                    {shipment.last_tracking_update && (
                      <div>
                        <p className="text-slate-400 text-sm">Last Tracking Update</p>
                        <p className="text-slate-700">{formatDate(shipment.last_tracking_update, true)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {shipment.label_url && (
                      <a
                        href={shipment.label_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Label (PDF)
                      </a>
                    )}
                    {canVoidLabel && (
                      <button
                        onClick={() => setShowVoidConfirm(true)}
                        disabled={labelVoiding}
                        className="px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors"
                      >
                        {labelVoiding ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Void Label'
                        )}
                      </button>
                    )}
                  </div>

                  {/* Void Confirmation Dialog */}
                  {showVoidConfirm && (
                    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to void this label?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setLabelVoiding(true);
                            setLabelError(null);
                            const result = await voidLabel(shipment.label_id!);
                            setLabelVoiding(false);
                            setShowVoidConfirm(false);
                            if (!result.success) {
                              setLabelError(result.error?.message || 'Failed to void label');
                            } else {
                              setLabelError(null);
                              refetch();
                              refetchShipment();
                            }
                          }}
                          disabled={labelVoiding}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {labelVoiding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Yes, Void Label
                        </button>
                        <button
                          onClick={() => setShowVoidConfirm(false)}
                          className="px-3 py-1.5 bg-white text-slate-600 text-sm rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Internal Notes, Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* Growing System Card */}
            {order.growing_system && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Growing System</h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-slate-700">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="font-medium">{order.growing_system}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Notes Card */}
            {order.customer_notes && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Customer Notes</h2>
                </div>
                <div className="p-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-slate-700 text-sm whitespace-pre-wrap">
                    {order.customer_notes}
                  </div>
                </div>
              </div>
            )}

            {/* Internal Notes Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 print:hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Internal Notes</h2>
              </div>
              <div className="p-6 space-y-4">
                {order.internal_notes && (
                  <div className="bg-slate-50 rounded-lg p-4 text-slate-600 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {order.internal_notes}
                  </div>
                )}
                <div className="space-y-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 print:hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Actions</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Mark as Picked Up (for pickup orders) */}
                {order.is_pickup && order.pickup_reservation?.status === 'scheduled' && order.status !== 'cancelled' && (
                  <div>
                    <button
                      onClick={handleMarkPickedUp}
                      disabled={markingPickedUp}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  {/* Cancel Order */}
                  {order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'refunded' && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {/* Refund Buttons */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 text-center">
                      Remaining refundable: {formatCurrency(remainingRefundable)}
                    </p>

                    {/* Stripe Refund Button */}
                    {canRefund ? (
                      <button
                        onClick={handleOpenRefundModal}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Stripe Refund
                      </button>
                    ) : order.stripe_payment_intent_id && isPaidOrder && remainingRefundable <= 0 ? null : (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                        title={!order.stripe_payment_intent_id ? 'No Stripe payment on file' : 'Order must be in a paid status'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Stripe Refund
                      </button>
                    )}

                    {/* Manual Refund Button - always available if there's balance remaining */}
                    {remainingRefundable > 0 && (
                      <button
                        onClick={handleOpenManualRefundModal}
                        className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Manual Refund
                      </button>
                    )}

                    {/* Help text */}
                    {!order.stripe_payment_intent_id && remainingRefundable > 0 && (
                      <p className="text-xs text-slate-400 text-center">
                        No Stripe payment on file. Use Manual Refund to record cash, check, or other refunds.
                      </p>
                    )}
                    {order.stripe_payment_intent_id && !isPaidOrder && (
                      <p className="text-xs text-slate-400 text-center">
                        Stripe refunds unlock once the order is marked as paid.
                      </p>
                    )}
                    {remainingRefundable <= 0 && (
                      <p className="text-xs text-slate-400 text-center">
                        This order has been fully refunded.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Order Items, Order Timeline, Refund History */}
          <div className="lg:col-span-8 space-y-6">
            {/* Order Items Card */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/60">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">
                  Order Items
                  {order.items && order.items.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({order.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)} {order.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0) === 1 ? 'item' : 'items'})
                    </span>
                  )}
                </h2>
                {!editingItems && (
                  <button
                    onClick={handleStartEditItems}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Edit items"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              {!editingItems ? (
                <>
                  <div className="divide-y divide-slate-100">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div key={item.id || Math.random()} className="flex items-center gap-4 p-4">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name || 'Product'}
                              className="w-16 h-16 object-cover rounded-lg bg-slate-100"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-slate-800 font-medium truncate">
                              {item.product_name || 'Unknown Product'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                              {formatCurrency(item.unit_price)} x {item.quantity ?? 0}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-800 font-medium">
                              {formatCurrency(item.line_total)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-400">
                        No items found for this order
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-slate-200 space-y-2 bg-slate-50">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({order.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) || 0} {(order.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) || 0) === 1 ? 'item' : 'items'})</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {(order.discount_amount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>{order.promotion_code ? `Promo Code (${order.promotion_code})` : (order.discount_description || 'Discount')}</span>
                        <span>-{formatCurrency(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span>{formatCurrency(order.shipping_cost)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{order.tax_note ? `Tax (${order.tax_note})` : 'Tax'}</span>
                      <span>{formatCurrency(order.tax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold text-lg pt-2 border-t border-slate-200">
                      <span>Total</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                    {refundedTotal > 0 && (
                      <>
                        <div className="flex justify-between text-rose-600 font-medium text-sm">
                          <span>Refunded</span>
                          <span>-{formatCurrency(refundedTotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Remaining Refundable</span>
                          <span>{formatCurrency(remainingRefundable)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Editable items list */}
                  <div className="divide-y divide-slate-100">
                    {editableItems.map((item, index) => {
                      const lineTotal = item.quantity * item.product_price;
                      const stock = stockMap[item.product_id];
                      const exceedsStock = stock !== undefined && item.quantity > stock;

                      return (
                        <div key={item.product_id + '-' + index} className={`p-4 ${exceedsStock ? 'bg-amber-50/50' : ''}`}>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-slate-800 font-medium truncate">{item.product_name}</h3>
                              <p className="text-slate-500 text-sm">{formatCurrency(item.product_price)} each</p>
                              {exceedsStock && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs">
                                  <AlertTriangle size={10} />
                                  Exceeds available stock ({stock} available)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg">
                              <button
                                onClick={() => handleEditItemQuantityChange(index, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="p-2 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                              >
                                <span className="text-slate-600 text-sm font-bold">&minus;</span>
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleEditItemQuantityChange(index, parseInt(e.target.value) || 1)}
                                min="1"
                                className="w-14 text-center bg-transparent border-none focus:outline-none font-medium text-sm"
                              />
                              <button
                                onClick={() => handleEditItemQuantityChange(index, item.quantity + 1)}
                                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                <Plus size={14} className="text-slate-600" />
                              </button>
                            </div>
                            <div className="w-24 text-right font-medium text-slate-800">
                              {formatCurrency(lineTotal)}
                            </div>
                            <button
                              onClick={() => handleRemoveEditItem(index)}
                              disabled={editableItems.length <= 1}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={editableItems.length <= 1 ? 'Order must have at least one item' : 'Remove item'}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Product Search */}
                  <div className="px-4 py-3 border-t border-slate-100">
                    <div className="relative" ref={productSearchRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          onFocus={() => { if (productSearchResults.length > 0) setShowProductDropdown(true); }}
                          placeholder="Search products to add..."
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                        />
                        {productSearchLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 size={16} className="text-slate-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      {showProductDropdown && productSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {productSearchResults.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => handleAddProductToEdit(product)}
                              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-slate-900 text-sm">{product.name}</span>
                                  <span className="text-emerald-600 text-sm ml-2">{formatCurrency(product.price)}</span>
                                </div>
                                <span className="text-xs text-slate-500">Stock: {product.quantity_available}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {showProductDropdown && productSearchResults.length === 0 && productSearchQuery.length >= 2 && !productSearchLoading && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-center text-slate-500 text-sm">
                          No products found
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Updated totals */}
                  <div className="px-6 py-4 border-t border-slate-200 space-y-2 bg-slate-50">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(editSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span>{formatCurrency(order.shipping_cost)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{order.tax_note ? `Tax (${order.tax_note})` : 'Tax'}</span>
                      <span>{formatCurrency(order.tax)}</span>
                    </div>
                    {(order.discount_amount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>{order.promotion_code ? `Promo Code (${order.promotion_code})` : (order.discount_description || 'Discount')}</span>
                        <span>-{formatCurrency(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-800 font-bold text-lg pt-2 border-t border-slate-200">
                      <span>Total</span>
                      <span>{formatCurrency(editTotal)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                      onClick={handleCancelEditItems}
                      disabled={itemSaving}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveItems}
                      disabled={itemSaving || editableItems.length === 0}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {itemSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Save Changes
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Order Timeline */}
            {(() => {
              // Build unified timeline from all event sources
              type TimelineEvent = {
                id: string;
                type: 'status_change' | 'activity';
                created_at: string;
                description: React.ReactNode;
                actor: string;
                note?: string | null;
                color: string;
              };

              const activityColors: Record<string, string> = {
                order_created: 'bg-blue-500',
                items_updated: 'bg-amber-500',
                shipping_address_updated: 'bg-indigo-500',
                billing_address_updated: 'bg-indigo-500',
                tracking_updated: 'bg-cyan-500',
                note_added: 'bg-slate-400',
                payment_status_changed: 'bg-violet-500',
                converted_to_ship: 'bg-teal-500',
                refund_issued: 'bg-red-500',
                order_cancelled: 'bg-red-600',
                marked_picked_up: 'bg-emerald-500',
                notes_updated: 'bg-slate-400',
              };

              const events: TimelineEvent[] = [];

              // Add "order created" if not already in activity log
              const hasCreatedActivity = (order.activity_log || []).some(a => a.activity_type === 'order_created');
              if (!hasCreatedActivity && order.created_at) {
                events.push({
                  id: 'order-created',
                  type: 'activity',
                  created_at: order.created_at,
                  description: <span className="text-sm font-medium text-slate-800">Order placed</span>,
                  actor: 'System',
                  color: 'bg-blue-500',
                });
              }

              // Add status history entries
              (order.status_history || []).forEach((h) => {
                events.push({
                  id: `status-${h.id}`,
                  type: 'status_change',
                  created_at: h.created_at,
                  description: h.from_status ? (
                    <span className="text-sm font-medium text-slate-800">
                      Status changed from <span className="text-slate-500">{getOrderStatusLabel(h.from_status)}</span> to <span className="text-emerald-600">{getOrderStatusLabel(h.status)}</span>
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-800">
                      Status set to <span className="text-emerald-600">{getOrderStatusLabel(h.status)}</span>
                    </span>
                  ),
                  actor: h.changed_by_name || 'System',
                  note: h.note,
                  color: 'bg-emerald-500',
                });
              });

              // Add activity log entries (skip order_created if already handled above)
              (order.activity_log || []).forEach((a) => {
                events.push({
                  id: `activity-${a.id}`,
                  type: 'activity',
                  created_at: a.created_at,
                  description: <span className="text-sm font-medium text-slate-800">{a.description}</span>,
                  actor: a.created_by_name || 'System',
                  color: activityColors[a.activity_type] || 'bg-slate-400',
                });
              });

              // Sort chronologically (newest last)
              events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

              return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Order Timeline</h2>
                  </div>
                  <div className="p-6">
                    {events.length > 0 ? (
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />

                        <div className="space-y-6">
                          {events.map((event, index) => (
                            <div key={event.id} className="relative pl-10">
                              {/* Timeline dot */}
                              <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                index === events.length - 1
                                  ? event.color
                                  : 'bg-slate-300'
                              }`}>
                                <div className="w-2 h-2 rounded-full bg-white" />
                              </div>

                              <div>
                                {event.description}
                                <span className="text-slate-500 text-xs block mt-1">
                                  {formatDate(event.created_at, true)}
                                </span>
                                {event.note && (
                                  <p className="text-slate-600 text-sm mt-1">
                                    {event.note}
                                  </p>
                                )}
                                <p className="text-slate-400 text-xs mt-1">
                                  by {event.actor}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-center py-4">No timeline events available</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Refund History */}
            {refundHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Refund History</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {refundHistory.map((refund) => {
                    const methodLabels: Record<string, string> = {
                      cash: 'Cash',
                      check: 'Check',
                      store_credit: 'Store Credit',
                      other: 'Other',
                    };
                    const isManual = refund.refund_type === 'manual';

                    return (
                      <div key={refund.id} className="p-6 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-slate-800 font-semibold">
                              {formatCurrency(refund.amount)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(refund.created_at, true)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Refund Type Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isManual
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {isManual ? 'Manual' : 'Stripe'}
                            </span>
                            {/* Method Badge (for manual refunds) */}
                            {isManual && refund.refund_method && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {methodLabels[refund.refund_method] || refund.refund_method}
                              </span>
                            )}
                            {/* Status Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRefundStatusClasses(refund.status || '')}`}>
                              {(refund.status || 'unknown').replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {refund.reason && (
                          <p className="text-sm text-slate-600">
                            {refund.reason}
                          </p>
                        )}
                        {refund.created_by_name && (
                          <p className="text-xs text-slate-400">
                            Issued by {refund.created_by_name}
                          </p>
                        )}
                        {refund.items && refund.items.length > 0 && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Items</p>
                            <div className="space-y-1 text-sm text-slate-700">
                              {refund.items.map((item, idx) => (
                                <div key={`${refund.id}-${idx}`} className="flex items-center justify-between gap-3">
                                  <span className="truncate">{item.description || 'Line Item'}</span>
                                  <span className="text-slate-500">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Refund Modal */}
        <AnimatePresence>
          {showRefundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={handleCloseRefundModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-3xl w-full space-y-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-800">Issue Refund</h3>
                  <button
                    onClick={handleCloseRefundModal}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">Order Total</p>
                    <p className="text-slate-800 font-semibold">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">Refunded</p>
                    <p className="text-slate-800 font-semibold">{formatCurrency(refundedTotal)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">Remaining</p>
                    <p className="text-slate-800 font-semibold">{formatCurrency(remainingRefundable)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleRefundModeChange('items')}
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      refundMode === 'items'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    Select Items
                  </button>
                  <button
                    onClick={() => handleRefundModeChange('full')}
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      refundMode === 'full'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500'
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
                        <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex gap-3">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleRefundItem(item.id, e.target.checked, item.quantity)}
                              className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-slate-800 font-medium">{item.product_name}</p>
                                <p className="text-xs text-slate-400">
                                  {formatCurrency(perUnit)} × {item.quantity}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-400">Selected</p>
                                <p className="text-sm text-slate-800">
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
                                  className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">No items to refund.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Manual Adjustment (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
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
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Use this to include shipping or tax adjustments. Cannot exceed remaining balance.
                    </p>
                    {manualAmountInvalid && (
                      <p className="text-xs text-red-600">Enter a valid amount.</p>
                    )}
                    {exceedsRemaining && (
                      <p className="text-xs text-red-600">
                        This exceeds the refundable balance.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Reason (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Damaged on arrival, out of stock, etc."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                  <div className="flex justify-between">
                    <span>Items Selected</span>
                    <span>{selectedItemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selected Items Total</span>
                    <span>{formatCurrency(calculatedItemAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Refund Amount</span>
                    <span>{formatCurrency(clampedRefundAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>Remaining After Refund</span>
                    <span>{formatCurrency(remainingAfterPlannedRefund)}</span>
                  </div>
                </div>

                {refundError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {refundError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={handleCloseRefundModal}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRefund}
                    disabled={!canSubmitRefund}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCancelModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Cancel Order</h3>
                <p className="text-slate-600 mb-4">
                  Are you sure you want to cancel order <span className="font-mono text-slate-800">{order.order_number}</span>?
                  This action cannot be undone.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    disabled={cancellingOrder}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancellingOrder ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Convert to Ship Order Modal */}
        <AnimatePresence>
          {showConvertToShipModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={() => setShowConvertToShipModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Convert to Ship Order</h3>
                <p className="text-slate-600 mb-4">
                  This will cancel the pickup reservation and convert order{' '}
                  <span className="font-mono text-slate-800">{order?.order_number}</span>{' '}
                  to a shipping order. This cannot be undone.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-amber-700 text-sm">
                    You will need to add a shipping address and create a shipping label after conversion.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConvertToShipModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Keep as Pickup
                  </button>
                  <button
                    onClick={handleConvertToShip}
                    disabled={convertingToShip}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {convertingToShip ? 'Converting...' : 'Convert to Ship'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Refund Modal */}
        <AnimatePresence>
          {showManualRefundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={handleCloseManualRefundModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-800">Manual Refund</h3>
                  <button
                    onClick={handleCloseManualRefundModal}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-amber-800 text-sm">
                      Manual refunds record the refund in the system but do <strong>not</strong> process any payment.
                      Use this for cash refunds, checks, or refunds handled outside of Stripe.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">Order Total</p>
                    <p className="text-slate-800 font-semibold">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">Remaining</p>
                    <p className="text-slate-800 font-semibold">{formatCurrency(remainingRefundable)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Refund Amount */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Refund Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        max={remainingRefundable}
                        step="0.01"
                        value={manualRefundAmountInput}
                        onChange={(e) => {
                          setManualRefundAmountInput(e.target.value);
                          setManualRefundError(null);
                        }}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualRefundAmountInput(remainingRefundable.toFixed(2))}
                      className="text-xs text-amber-600 hover:text-amber-700"
                    >
                      Use full remaining amount ({formatCurrency(remainingRefundable)})
                    </button>
                  </div>

                  {/* Refund Method */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Refund Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={manualRefundMethod}
                      onChange={(e) => setManualRefundMethod(e.target.value as ManualRefundMethod)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="store_credit">Store Credit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">
                      Notes / Reason
                    </label>
                    <textarea
                      rows={3}
                      value={manualRefundNotes}
                      onChange={(e) => setManualRefundNotes(e.target.value)}
                      placeholder="Customer returned item, refund issued in cash, etc."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                    />
                  </div>
                </div>

                {manualRefundError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {manualRefundError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={handleCloseManualRefundModal}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitManualRefund}
                    disabled={processingManualRefund || !manualRefundAmountInput}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingManualRefund ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Recording...
                      </>
                    ) : (
                      'Record Refund'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </ErrorBoundary>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-slide-down ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? (
            <Check size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default OrderDetailPage;
