import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Types
export interface OrderFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  perPage?: number;
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

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
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
}

export interface OrdersResponse {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Order statuses
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'allocated',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-500' },
  paid: { label: 'Paid', color: 'bg-blue-500' },
  allocated: { label: 'Allocated', color: 'bg-purple-500' },
  picking: { label: 'Picking', color: 'bg-amber-500' },
  packed: { label: 'Packed', color: 'bg-orange-500' },
  shipped: { label: 'Shipped', color: 'bg-cyan-500' },
  delivered: { label: 'Delivered', color: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
};

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

      // Build data query with customer info
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
            quantity,
            unit_price,
            line_total,
            products (
              name,
              images:product_images(id, image_url, is_primary, sort_order)
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
        countQuery = countQuery.or(`order_number.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`);
        dataQuery = dataQuery.or(`order_number.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`);
      }

      // Execute both queries
      const [countResult, dataResult] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      // Transform data to include customer info
      const formattedOrders: Order[] = (dataResult.data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers
          ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || null
          : order.shipping_address?.name || null,
        customer_email: order.customer_email || order.customers?.email,
        customer_phone: order.customers?.phone || null,
        status: order.status,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        shipping_address: order.shipping_address,
        shipping_method: order.shipping_method,
        tracking_number: order.tracking_number,
        estimated_delivery: order.estimated_delivery,
        internal_notes: order.internal_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown Product',
          product_image: (item.products?.images?.find((img: any) => img.is_primary) || item.products?.images?.[0])?.image_url || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
      }));

      setOrders(formattedOrders);
      setTotalCount(countResult.count || 0);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.search, page, perPage, offset]);

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
      // Fetch order with items and customer
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
            quantity,
            unit_price,
            line_total,
            products (
              name,
              images:product_images(id, image_url, is_primary, sort_order)
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch status history
      const { data: historyData, error: historyError } = await supabase
        .from('order_status_history')
        .select(`
          *,
          admin_users:changed_by (
            email
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (historyError && historyError.code !== 'PGRST116') {
        console.warn('Could not fetch status history:', historyError);
      }

      // Transform to Order type
      const formattedOrder: Order = {
        id: orderData.id,
        order_number: orderData.order_number,
        customer_id: orderData.customer_id,
        customer_name: orderData.customers
          ? `${orderData.customers.first_name || ''} ${orderData.customers.last_name || ''}`.trim() || null
          : orderData.shipping_address?.name || null,
        customer_email: orderData.customer_email || orderData.customers?.email,
        customer_phone: orderData.customers?.phone || null,
        status: orderData.status,
        subtotal: orderData.subtotal,
        shipping_cost: orderData.shipping_cost,
        tax: orderData.tax,
        total: orderData.total,
        shipping_address: orderData.shipping_address,
        shipping_method: orderData.shipping_method,
        tracking_number: orderData.tracking_number,
        estimated_delivery: orderData.estimated_delivery,
        internal_notes: orderData.internal_notes,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        items: (orderData.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown Product',
          product_image: (item.products?.images?.find((img: any) => img.is_primary) || item.products?.images?.[0])?.image_url || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
        status_history: (historyData || []).map((h: any) => ({
          id: h.id,
          order_id: h.order_id,
          status: h.status,
          note: h.note,
          changed_by: h.changed_by,
          changed_by_name: h.admin_users?.email || 'System',
          created_at: h.created_at,
        })),
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
      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Add to status history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus,
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
