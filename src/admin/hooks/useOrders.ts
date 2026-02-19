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
  isLegacy?: boolean;
}

export type ViewOrderHandler = (orderId: string, options?: ViewOrderOptions) => void;

// Types
export type ShippingStatus = 'pickup' | 'no_label' | 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'voided';

export interface OrderFilters {
  status?: string;
  statuses?: string[];  // Support multiple statuses for multi-select filtering
  shippingStatus?: ShippingStatus | 'all';
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
  refund_type: 'stripe' | 'manual';
  refund_method: 'cash' | 'check' | 'store_credit' | 'other' | null;
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
  customer_notes?: string | null;
  growing_system?: string | null;
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
  // Shipment fields (for list view)
  shipment_status?: string | null;
  shipment_tracking_status?: string | null;
  shipment_tracking_number?: string | null;
  shipment_voided?: boolean;
  // Legacy order fields
  isLegacy?: boolean;
  woo_order_id?: number;
}

// Legacy order interface for WooCommerce imported orders
export interface LegacyOrder {
  id: string;
  woo_order_id: number;
  customer_id: string | null;
  order_date: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  payment_method?: string;
  billing_email?: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  // Joined customer data (from customers table via customer_id)
  customers?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface LegacyOrderItemImage {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface LegacyOrderItem {
  id: string;
  legacy_order_id: string;
  woo_order_id: number;
  woo_product_id: number | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  line_total: number;
  product?: {
    id: string;
    name: string;
    slug: string;
    images: LegacyOrderItemImage[];
  } | null;
}

export interface OrdersResponse {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Derive a normalized shipping status from order + shipment data
export function getShippingStatus(order: Order): ShippingStatus {
  if (order.is_pickup) return 'pickup';
  if (!order.shipment_status) return 'no_label';
  if (order.shipment_voided) return 'voided';

  const ts = order.shipment_tracking_status?.toUpperCase();
  if (ts === 'DELIVERED' || ts === 'DE') return 'delivered';
  if (ts === 'OUT_FOR_DELIVERY' || ts === 'OT') return 'out_for_delivery';
  if (ts === 'IN_TRANSIT' || ts === 'IT') return 'in_transit';

  return 'label_created';
}

// Hook: Fetch orders with filters and pagination (includes legacy orders)
export function useOrders(filters: OrderFilters = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = filters.perPage || 20;
  const page = filters.page || 1;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determine shipping status filter for query optimization
      const shippingFilter = (filters.shippingStatus && filters.shippingStatus !== 'all')
        ? filters.shippingStatus : null;
      const useInnerShipmentJoin = shippingFilter &&
        ['label_created', 'in_transit', 'out_for_delivery', 'delivered', 'voided'].includes(shippingFilter);
      const shipmentsJoin = useInnerShipmentJoin
        ? 'shipments!inner(id, status, tracking_status, tracking_number, voided, created_at)'
        : 'shipments(id, status, tracking_status, tracking_number, voided, created_at)';

      // Build data query for regular orders
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
            refund_type,
            refund_method,
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
          ),
          ${shipmentsJoin}
        `)
        .order('created_at', { ascending: false });

      // Apply shipping status filter at query level
      if (shippingFilter) {
        switch (shippingFilter) {
          case 'pickup':
            dataQuery = dataQuery.eq('is_pickup', true);
            break;
          case 'no_label':
            dataQuery = dataQuery.eq('is_pickup', false);
            break;
          case 'label_created':
            dataQuery = dataQuery
              .eq('shipments.status', 'label_created')
              .eq('shipments.voided', false);
            break;
          case 'in_transit':
            dataQuery = dataQuery.in('shipments.tracking_status', ['IN_TRANSIT', 'IT']);
            break;
          case 'out_for_delivery':
            dataQuery = dataQuery.in('shipments.tracking_status', ['OUT_FOR_DELIVERY', 'OT']);
            break;
          case 'delivered':
            dataQuery = dataQuery.in('shipments.tracking_status', ['DELIVERED', 'DE']);
            break;
          case 'voided':
            dataQuery = dataQuery.eq('shipments.voided', true);
            break;
        }
      }

      // Build legacy orders query
      let legacyQuery = supabase
        .from('legacy_orders')
        .select(`
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order('order_date', { ascending: false });

      // Apply status filter (supports both single status and multiple statuses)
      if (filters.statuses && filters.statuses.length > 0) {
        dataQuery = dataQuery.in('status', filters.statuses);
        legacyQuery = legacyQuery.in('status', filters.statuses);
      } else if (filters.status && filters.status !== 'all') {
        dataQuery = dataQuery.eq('status', filters.status);
        legacyQuery = legacyQuery.eq('status', filters.status);
      }

      // Apply delivery method filter (legacy orders are all shipping, no pickup)
      if (filters.deliveryMethod && filters.deliveryMethod !== 'all') {
        const isPickup = filters.deliveryMethod === 'pickup';
        dataQuery = dataQuery.eq('is_pickup', isPickup);
        // Legacy orders don't have pickup option - exclude them if filtering for pickup only
        if (isPickup) {
          legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Effectively exclude all
        }
      }

      // Legacy orders never have shipments — exclude for filters that require shipment data
      if (shippingFilter && shippingFilter !== 'no_label') {
        legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Apply date range filters
      if (filters.dateFrom) {
        dataQuery = dataQuery.gte('created_at', filters.dateFrom);
        legacyQuery = legacyQuery.gte('order_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        dataQuery = dataQuery.lt('created_at', endDate.toISOString());
        legacyQuery = legacyQuery.lt('order_date', endDate.toISOString());
      }

      // Apply search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        dataQuery = dataQuery.or(`order_number.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%`);
        // For legacy orders, search by woo_order_id or billing_email
        // Check if search term looks like a WC order number
        const wcMatch = searchTerm.match(/^wc-?(\d+)$/i);
        if (wcMatch) {
          legacyQuery = legacyQuery.eq('woo_order_id', parseInt(wcMatch[1]));
        } else if (/^\d+$/.test(searchTerm)) {
          legacyQuery = legacyQuery.eq('woo_order_id', parseInt(searchTerm));
        } else {
          legacyQuery = legacyQuery.ilike('billing_email', `%${searchTerm}%`);
        }
      }

      // Execute both queries in parallel
      // Wrap legacy query in a function to handle errors gracefully
      const fetchLegacyOrders = async () => {
        try {
          return await legacyQuery;
        } catch {
          // Return empty result if legacy_orders table doesn't exist
          return { data: [], error: null };
        }
      };

      const [dataResult, legacyResult] = await Promise.all([
        dataQuery,
        fetchLegacyOrders(),
      ]);

      if (dataResult.error) throw dataResult.error;

      // Transform regular orders
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
          refund_type: refund.refund_type || 'stripe',
          refund_method: refund.refund_method || null,
          items: refund.items || null,
          created_at: refund.created_at,
          created_by: refund.created_by,
          created_by_name: refund.customers?.email || null,
        })),
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
        // Pick the active (non-voided) shipment, falling back to the latest one
        ...(() => {
          const shipments = order.shipments || [];
          const activeShipment = shipments.find((s: any) => !s.voided) || shipments[0];
          if (!activeShipment) return {};
          return {
            shipment_status: activeShipment.status,
            shipment_tracking_status: activeShipment.tracking_status,
            shipment_tracking_number: activeShipment.tracking_number,
            shipment_voided: activeShipment.voided,
          };
        })(),
        isLegacy: false,
      }));

      // Transform legacy orders to Order format
      const legacyOrders: Order[] = ((legacyResult as any)?.data || []).map((order: any) => ({
        id: order.id,
        order_number: `WC-${order.woo_order_id}`,
        woo_order_id: order.woo_order_id,
        customer_id: order.customer_id,
        customer_name: order.customers
          ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || null
          : `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim() || null,
        customer_email: order.billing_email || order.customers?.email || '',
        customer_phone: order.customers?.phone || null,
        status: order.status as OrderStatus,
        payment_status: order.status === 'completed' ? 'paid' : order.status,
        stripe_payment_intent_id: null,
        subtotal: order.subtotal || 0,
        shipping_cost: order.shipping || 0,
        tax: order.tax || 0,
        total: order.total || 0,
        refunded_total: 0,
        shipping_address: order.shipping_address ? {
          name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
          street: order.shipping_address,
          street2: null,
          city: order.shipping_city || '',
          state: order.shipping_state || '',
          zip: order.shipping_zip || '',
        } : null,
        shipping_method: null,
        tracking_number: null,
        estimated_delivery: null,
        internal_notes: null,
        created_at: order.order_date,
        updated_at: order.order_date,
        items: [], // Items loaded separately via useLegacyOrderItems
        is_pickup: false,
        pickup_location_id: null,
        pickup_date: null,
        pickup_time_start: null,
        pickup_time_end: null,
        isLegacy: true,
      }));

      // Combine and sort by date (newest first)
      let allOrders = [...formattedOrders, ...legacyOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Client-side safety net for shipping status (handles no_label "no shipment" check
      // and edge cases with multi-shipment orders from !inner join)
      if (shippingFilter) {
        allOrders = allOrders.filter(order => getShippingStatus(order) === shippingFilter);
      }

      // Apply pagination to combined results
      const paginatedOrders = allOrders.slice((page - 1) * perPage, page * perPage);

      setOrders(paginatedOrders);
      setTotalCount(allOrders.length);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.statuses, filters.shippingStatus, filters.deliveryMethod, filters.dateFrom, filters.dateTo, filters.search, page, perPage]);

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
            refund_type,
            refund_method,
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
          refund_type: refund.refund_type || 'stripe',
          refund_method: refund.refund_method || null,
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

export type ManualRefundMethod = 'cash' | 'check' | 'store_credit' | 'other';

interface ManualRefundParams {
  orderId: string;
  amount: number;
  method: ManualRefundMethod;
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

// Hook: Process manual refund (without Stripe)
export function useManualRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processManualRefund = useCallback(async ({
    orderId,
    amount,
    method,
    reason,
    items,
    adminUserId,
  }: ManualRefundParams) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch current order to validate refund amount
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, total, status, refunded_total')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      const totalCents = Math.round(Number(order.total || 0) * 100);
      const alreadyRefundedCents = Math.round(Number(order.refunded_total || 0) * 100);
      const amountCents = Math.round(amount * 100);
      const remainingCents = totalCents - alreadyRefundedCents;

      if (remainingCents <= 0) {
        throw new Error('Order is already fully refunded');
      }

      if (amountCents > remainingCents) {
        throw new Error('Refund amount exceeds remaining balance');
      }

      const newRefundedTotalCents = alreadyRefundedCents + amountCents;
      const fullyRefunded = newRefundedTotalCents >= totalCents;
      const newOrderStatus = fullyRefunded ? 'refunded' : order.status;
      const paymentStatus = fullyRefunded ? 'refunded' : 'partial';

      // Insert refund record
      const { error: refundInsertError } = await supabase
        .from('order_refunds')
        .insert({
          order_id: orderId,
          amount: amount,
          reason: reason || null,
          items: items && items.length > 0 ? items : null,
          refund_type: 'manual',
          refund_method: method,
          status: 'succeeded',
          created_by: adminUserId || null,
          stripe_refund_id: null,
        });

      if (refundInsertError) {
        throw new Error('Failed to record refund: ' + refundInsertError.message);
      }

      // Update order totals and status
      const orderUpdatePayload: Record<string, any> = {
        payment_status: paymentStatus,
        refunded_total: newRefundedTotalCents / 100,
        updated_at: new Date().toISOString(),
      };

      if (fullyRefunded) {
        orderUpdatePayload.status = 'refunded';
      }

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', orderId);

      if (orderUpdateError) {
        console.error('Failed to update order with refund totals', orderUpdateError);
      }

      // Format for history note
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

      const methodLabels: Record<ManualRefundMethod, string> = {
        cash: 'Cash',
        check: 'Check',
        store_credit: 'Store Credit',
        other: 'Other',
      };

      const noteParts = [`Manual refund: ${formattedAmount} via ${methodLabels[method]}`];
      if (reason) {
        noteParts.push(`Reason: ${reason}`);
      }

      // Add to order status history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          status: fullyRefunded ? 'refunded' : order.status,
          from_status: order.status,
          note: noteParts.join(' - '),
          changed_by: adminUserId || null,
        });

      if (historyError) {
        console.error('Failed to append order history for manual refund', historyError);
      }

      return {
        success: true,
        data: {
          order_status: newOrderStatus,
          payment_status: paymentStatus,
          refunded_total: newRefundedTotalCents / 100,
        },
      };
    } catch (err: any) {
      console.error('Error processing manual refund:', err);
      setError(err.message || 'Failed to process manual refund');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    processManualRefund,
    loading,
    error,
  };
}

// Hook: Fetch legacy order details with items
export function useLegacyOrder(orderId: string | null) {
  const [order, setOrder] = useState<LegacyOrder | null>(null);
  const [items, setItems] = useState<LegacyOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLegacyOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch legacy order with customer info
      const { data: orderData, error: orderError } = await supabase
        .from('legacy_orders')
        .select(`
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      setOrder(orderData);

      // Fetch legacy order items with product images
      const { data: itemsData, error: itemsError } = await supabase
        .from('legacy_order_items')
        .select(`
          *,
          product:products(
            id,
            name,
            slug,
            images:product_images(id, url, is_primary, sort_order)
          )
        `)
        .eq('legacy_order_id', orderId)
        .order('product_name');

      if (itemsError) {
        // Log the actual error for debugging
        console.error('Error fetching legacy order items:', itemsError);
      }

      setItems(itemsData || []);
    } catch (err: any) {
      console.error('Error fetching legacy order:', err);
      setError(err.message || 'Failed to fetch legacy order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchLegacyOrder();
  }, [fetchLegacyOrder]);

  return {
    order,
    items,
    loading,
    error,
    refetch: fetchLegacyOrder,
  };
}
