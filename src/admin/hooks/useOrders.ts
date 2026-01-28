import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ORDER_STATUS_CONFIG,
  ORDER_STATUSES,
  type OrderStatus,
} from '../../constants/orderStatus';

export { ORDER_STATUSES, ORDER_STATUS_CONFIG } from '../../constants/orderStatus';
export type { OrderStatus } from '../../constants/orderStatus';

export interface ViewOrderOptions {
  fromCustomerId?: string;
  fromCustomerName?: string;
}

export type ViewOrderHandler = (orderId: string, options?: ViewOrderOptions) => void;

// Types
export interface OrderFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  perPage?: number;
  deliveryMethod?: 'all' | 'shipping' | 'pickup';
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderRefundItem {
  order_item_id: string;
  quantity: number;
  amount: number;
  description?: string;
}

export interface OrderRefund {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  stripe_refund_id: string | null;
  items: OrderRefundItem[] | null;
  created_at: string;
  created_by: string | null;
  created_by_name?: string | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  from_status: OrderStatus | null;
  note: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export interface PickupLocation {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  instructions?: string;
}

export interface PickupReservation {
  id: string;
  location: PickupLocation | null;
  pickup_date: string;
  pickup_time_start: string;
  pickup_time_end: string;
  status: 'scheduled' | 'picked_up' | 'missed' | 'cancelled';
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  status: OrderStatus;
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  refunded_total?: number;
  shipping_address: {
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  shipping_method: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  status_history?: OrderStatusHistory[];
  refunds?: OrderRefund[];
  // Pickup fields
  is_pickup: boolean;
  pickup_location_id: string | null;
  pickup_date: string | null;
  pickup_time_start: string | null;
  pickup_time_end: string | null;
  pickup_reservation?: PickupReservation;
}

export interface OrdersResponse {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Hook: Fetch orders with filters and pagination
export function useOrders(filters: OrderFilters = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;
  const offset = (page - 1) * perPage;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build count query
      let countQuery = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Build data query with customer info and pickup data
      let dataQuery = supabase
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
              name,
              images:product_images(id, url, is_primary, sort_order)
            )
          ),
          order_refunds (
            id,
            amount,
            reason,
            items,
            status,
            stripe_refund_id,
            created_at,
            created_by,
            customers:created_by (
              email
            )
          ),
          pickup_reservations (
            id,
            pickup_date,
            pickup_time_start,
            pickup_time_end,
            status,
            notes,
            pickup_locations (
              id,
              name,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              phone,
              instructions
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        countQuery = countQuery.eq('status', filters.status);
        dataQuery = dataQuery.eq('status', filters.status);
      }

      // Apply delivery method filter
      if (filters.deliveryMethod && filters.deliveryMethod !== 'all') {
        const isPickup = filters.deliveryMethod === 'pickup';
        countQuery = countQuery.eq('is_pickup', isPickup);
        dataQuery = dataQuery.eq('is_pickup', isPickup);
      }

      // Apply date range filters
      if (filters.dateFrom) {
        countQuery = countQuery.gte('created_at', filters.dateFrom);
        dataQuery = dataQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        // Add a day to include the entire end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        countQuery = countQuery.lt('created_at', endDate.toISOString());
        dataQuery = dataQuery.lt('created_at', endDate.toISOString());
      }

      // Apply search filter (order number or customer email)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        countQuery = countQuery.or(`order_number.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%`);
        dataQuery = dataQuery.or(`order_number.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%`);
      }

      // Execute both queries
      const [countResult, dataResult] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      console.log('Orders query result:', { count: countResult.count, dataCount: dataResult.data?.length, error: dataResult.error, data: dataResult.data });

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      // Transform data to include customer info
      const formattedOrders: Order[] = (dataResult.data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers
          ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || null
          : order.shipping_address?.name || `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim() || null,
        customer_email: order.customer_email || order.guest_email || order.customers?.email,
        customer_phone: order.customers?.phone || order.shipping_phone || null,
        status: order.status as OrderStatus,
        payment_status: order.payment_status,
        stripe_payment_intent_id: order.stripe_payment_intent_id,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        refunded_total: order.refunded_total || 0,
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
          product_image: (item.products?.images?.find((img: any) => img.is_primary) || item.products?.images?.[0])?.url || null,
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
        })),
        refunds: (order.order_refunds || []).map((refund: any) => ({
          id: refund.id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          stripe_refund_id: refund.stripe_refund_id,
          items: refund.items || null,
          created_at: refund.created_at,
          created_by: refund.created_by,
          created_by_name: refund.customers?.email || null,
        })),
        // Pickup fields
        is_pickup: order.is_pickup || false,
        pickup_location_id: order.pickup_location_id,
        pickup_date: order.pickup_date,
        pickup_time_start: order.pickup_time_start,
        pickup_time_end: order.pickup_time_end,
        pickup_reservation: order.pickup_reservations?.[0] ? {
          id: order.pickup_reservations[0].id,
          location: order.pickup_reservations[0].pickup_locations,
          pickup_date: order.pickup_reservations[0].pickup_date,
          pickup_time_start: order.pickup_reservations[0].pickup_time_start,
          pickup_time_end: order.pickup_reservations[0].pickup_time_end,
          status: order.pickup_reservations[0].status,
          notes: order.pickup_reservations[0].notes,
        } : undefined,
        }));

      setOrders(formattedOrders);
      setTotalCount(countResult.count || 0);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.deliveryMethod, filters.dateFrom, filters.dateTo, filters.search, page, perPage, offset]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    totalCount,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    loading,
    error,
    refetch: fetchOrders,
  };
}

// Hook: Fetch single order with items and history
export function useOrder(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch order with items, customer, and pickup reservation
      const { data: orderData, error: orderError } = await supabase
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
              name,
              images:product_images(id, url, is_primary, sort_order)
            )
          ),
          order_refunds (
            id,
            amount,
            reason,
            items,
            status,
            stripe_refund_id,
            created_at,
            created_by,
            customers:created_by (
              email
            )
          ),
          pickup_reservations (
            id,
            pickup_date,
            pickup_time_start,
            pickup_time_end,
            status,
            notes,
            pickup_locations (
              id,
              name,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              phone,
              instructions
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch status history
      let historyData: any[] | null = null;
      try {
        const { data, error: historyError } = await supabase
          .from('order_status_history')
          .select(`
            *,
            customers:changed_by (
              email
            )
          `)
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });

        if (historyError && historyError.code !== 'PGRST116') {
          console.warn('Could not fetch status history:', historyError);
        }
        historyData = data;
      } catch (histErr) {
        console.warn('Status history fetch failed, trying without join:', histErr);
        // Fallback: fetch without the customer join
        const { data } = await supabase
          .from('order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });
        historyData = data;
      }

      // Transform to Order type
      const formattedOrder: Order = {
        id: orderData.id,
        order_number: orderData.order_number,
        customer_id: orderData.customer_id,
        customer_name: orderData.customers
          ? `${orderData.customers.first_name || ''} ${orderData.customers.last_name || ''}`.trim() || null
          : orderData.shipping_address?.name || `${orderData.shipping_first_name || ''} ${orderData.shipping_last_name || ''}`.trim() || null,
        customer_email: orderData.customer_email || orderData.guest_email || orderData.customers?.email,
        customer_phone: orderData.customers?.phone || orderData.shipping_phone || null,
        status: orderData.status as OrderStatus,
        payment_status: orderData.payment_status,
        stripe_payment_intent_id: orderData.stripe_payment_intent_id,
        subtotal: orderData.subtotal,
        shipping_cost: orderData.shipping_cost,
        tax: orderData.tax,
        total: orderData.total,
        refunded_total: orderData.refunded_total || 0,
        shipping_address: orderData.shipping_address || (orderData.shipping_address_line1 ? {
          name: `${orderData.shipping_first_name || ''} ${orderData.shipping_last_name || ''}`.trim(),
          street: orderData.shipping_address_line1,
          street2: orderData.shipping_address_line2 || null,
          city: orderData.shipping_city,
          state: orderData.shipping_state,
          zip: orderData.shipping_zip
        } : null),
        shipping_method: orderData.shipping_method,
        tracking_number: orderData.tracking_number,
        estimated_delivery: orderData.estimated_delivery,
        internal_notes: orderData.internal_notes,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        items: (orderData.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || 'Unknown Product',
          product_image: (item.products?.images?.find((img: any) => img.is_primary) || item.products?.images?.[0])?.url || null,
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
        })),
        status_history: (historyData || []).map((h: any) => ({
          id: h.id,
          order_id: h.order_id,
          status: h.status as OrderStatus,
          from_status: h.from_status as OrderStatus | null,
          note: h.note,
          changed_by: h.changed_by,
          changed_by_name: h.customers?.email || 'System',
          created_at: h.created_at,
        })),
        refunds: (orderData.order_refunds || []).map((refund: any) => ({
          id: refund.id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          stripe_refund_id: refund.stripe_refund_id,
          items: refund.items || null,
          created_at: refund.created_at,
          created_by: refund.created_by,
          created_by_name: refund.customers?.email || null,
        })),
        // Pickup fields
        is_pickup: orderData.is_pickup || false,
        pickup_location_id: orderData.pickup_location_id || null,
        pickup_date: orderData.pickup_date || null,
        pickup_time_start: orderData.pickup_time_start || null,
        pickup_time_end: orderData.pickup_time_end || null,
        pickup_reservation: orderData.pickup_reservations?.[0] ? {
          id: orderData.pickup_reservations[0].id,
          location: orderData.pickup_reservations[0].pickup_locations,
          pickup_date: orderData.pickup_reservations[0].pickup_date,
          pickup_time_start: orderData.pickup_reservations[0].pickup_time_start,
          pickup_time_end: orderData.pickup_reservations[0].pickup_time_end,
          status: orderData.pickup_reservations[0].status,
          notes: orderData.pickup_reservations[0].notes,
        } : undefined,
      };

      setOrder(formattedOrder);
    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    order,
    loading,
    error,
    refetch: fetchOrder,
  };
}

// Hook: Update order status
export function useUpdateOrderStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async (
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
    changedBy?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Get current status before updating
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const fromStatus = currentOrder?.status || null;

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Add to status history with from_status
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus,
          from_status: fromStatus,
          note: note || null,
          changed_by: changedBy || null,
        });

      if (historyError) {
        console.warn('Could not add status history:', historyError);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error updating order status:', err);
      setError(err.message || 'Failed to update order status');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateStatus,
    loading,
    error,
  };
}

// Hook: Add order note
export function useAddOrderNote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addNote = useCallback(async (orderId: string, note: string) => {
    setLoading(true);
    setError(null);

    try {
      // Get current notes
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('internal_notes')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Append new note with timestamp
      const timestamp = new Date().toLocaleString();
      const existingNotes = orderData.internal_notes || '';
      const newNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}]\n${note}`
        : `[${timestamp}]\n${note}`;

      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          internal_notes: newNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err: any) {
      console.error('Error adding order note:', err);
      setError(err.message || 'Failed to add note');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    addNote,
    loading,
    error,
  };
}

// Hook: Cancel order
export function useCancelOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateStatus } = useUpdateOrderStatus();

  const cancelOrder = useCallback(async (
    orderId: string,
    reason?: string,
    changedBy?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const note = reason ? `Order cancelled: ${reason}` : 'Order cancelled';
      const result = await updateStatus(orderId, 'cancelled', note, changedBy);

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      setError(err.message || 'Failed to cancel order');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [updateStatus]);

  return {
    cancelOrder,
    loading,
    error,
  };
}

interface RefundOrderParams {
  orderId: string;
  amount: number;
  reason?: string;
  items?: OrderRefundItem[];
  adminUserId?: string;
}

export function useOrderRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundOrder = useCallback(async ({
    orderId,
    amount,
    reason,
    items,
    adminUserId,
  }: RefundOrderParams) => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        order_id: orderId,
        amount_cents: Math.round(amount * 100),
        reason,
        items: items && items.length > 0 ? items : undefined,
        admin_user_id: adminUserId,
      };

      const { data, error: fnError } = await supabase.functions.invoke('stripe-refund', {
        body: payload,
      });

      if (fnError) throw fnError;

      return { success: true, data };
    } catch (err: any) {
      console.error('Error processing refund:', err);
      setError(err.message || 'Failed to process refund');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    refundOrder,
    loading,
    error,
  };
}
