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
  showTrashed?: boolean;  // Show only soft-deleted orders
  growingSystem?: string;  // Filter by growing system name
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_type?: string;
  seedlings_per_unit?: number;
}

/** Effective seedling count for an order item (accounts for bundles). */
export const getItemSeedlingCount = (item: OrderItem): number =>
  item.product_type === 'bundle' && item.seedlings_per_unit
    ? item.quantity * item.seedlings_per_unit
    : item.quantity;

/** Total seedling count across all items in an order. */
export const getOrderSeedlingTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + getItemSeedlingCount(item), 0);

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

export type OrderActivityType =
  | 'order_created'
  | 'items_updated'
  | 'shipping_address_updated'
  | 'billing_address_updated'
  | 'tracking_updated'
  | 'note_added'
  | 'payment_status_changed'
  | 'converted_to_ship'
  | 'refund_issued'
  | 'order_cancelled'
  | 'marked_picked_up'
  | 'notes_updated';

export interface OrderActivityLog {
  id: string;
  order_id: string;
  activity_type: OrderActivityType;
  description: string;
  details: Record<string, any>;
  created_by: string | null;
  created_by_name: string | null;
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
  activity_log?: OrderActivityLog[];
  refunds?: OrderRefund[];
  // Raw address fields for inline editing
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_zip?: string | null;
  shipping_phone?: string | null;
  billing_first_name?: string | null;
  billing_last_name?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  // Additional shipping/tracking fields
  shipping_method_name?: string | null;
  tracking_url?: string | null;
  estimated_delivery_date?: string | null;
  discount_amount?: number | null;
  shipping_service_code?: string | null;
  // Pickup fields
  is_pickup: boolean;
  pickup_location_id: string | null;
  pickup_date: string | null;
  pickup_time_start: string | null;
  pickup_time_end: string | null;
  pickup_reservation?: PickupReservation;
  pickup_location?: PickupLocation | null;
  // Shipment fields (for list view)
  shipment_status?: string | null;
  shipment_tracking_status?: string | null;
  shipment_tracking_number?: string | null;
  shipment_voided?: boolean;
  // Gift card fields
  gift_card_code?: string | null;
  gift_card_amount?: number | null;
  giftup_transaction_id?: string | null;
  // Purchase order fields
  payment_method?: string | null;
  po_number?: string | null;
  po_status?: string | null;
  po_verified_at?: string | null;
  po_invoiced_at?: string | null;
  po_paid_at?: string | null;
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

      // --- Separate COUNT queries for accurate total (no row data) ---
      let countNewQuery = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      let countLegacyQuery = supabase
        .from('legacy_orders')
        .select('*', { count: 'exact', head: true });

      // Build data query for regular orders
      let dataQuery = supabase
        .from('orders')
        .select(`
          *,
          customers!customer_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          order_items_with_product (
            id,
            product_id,
            product_name,
            product_price,
            quantity,
            line_total,
            product_type,
            bundle_item_count,
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
          pickup_locations (
            id,
            name,
            address_line1,
            city,
            state,
            postal_code
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

      // Build legacy orders query (include items for count display)
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
          ),
          legacy_order_items (
            id,
            product_name,
            quantity,
            line_total
          )
        `)
        .order('order_date', { ascending: false });

      // Apply soft-delete filter (trash view vs normal view)
      if (filters.showTrashed) {
        dataQuery = dataQuery.not('deleted_at', 'is', null);
        countNewQuery = countNewQuery.not('deleted_at', 'is', null);
        // Legacy orders don't have soft-delete — exclude from trash view
        legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        countLegacyQuery = countLegacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        dataQuery = dataQuery.is('deleted_at', null);
        countNewQuery = countNewQuery.is('deleted_at', null);
      }

      // Apply status filter (supports both single status and multiple statuses)
      const statusArr = Array.isArray(filters.statuses) ? filters.statuses : [];
      if (statusArr.length > 0) {
        dataQuery = dataQuery.in('status', statusArr);
        legacyQuery = legacyQuery.in('status', statusArr);
        countNewQuery = countNewQuery.in('status', statusArr);
        countLegacyQuery = countLegacyQuery.in('status', statusArr);
      } else if (filters.status && filters.status !== 'all') {
        dataQuery = dataQuery.eq('status', filters.status);
        legacyQuery = legacyQuery.eq('status', filters.status);
        countNewQuery = countNewQuery.eq('status', filters.status);
        countLegacyQuery = countLegacyQuery.eq('status', filters.status);
      }

      // Apply delivery method filter (legacy orders are all shipping, no pickup)
      if (filters.deliveryMethod && filters.deliveryMethod !== 'all') {
        const isPickup = filters.deliveryMethod === 'pickup';
        dataQuery = dataQuery.eq('is_pickup', isPickup);
        countNewQuery = countNewQuery.eq('is_pickup', isPickup);
        // Legacy orders don't have pickup option - exclude them if filtering for pickup only
        if (isPickup) {
          legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          countLegacyQuery = countLegacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Legacy orders never have shipments — exclude for filters that require shipment data
      if (shippingFilter && shippingFilter !== 'no_label') {
        legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        countLegacyQuery = countLegacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Apply date range filters
      if (filters.dateFrom) {
        dataQuery = dataQuery.gte('created_at', filters.dateFrom);
        legacyQuery = legacyQuery.gte('order_date', filters.dateFrom);
        countNewQuery = countNewQuery.gte('created_at', filters.dateFrom);
        countLegacyQuery = countLegacyQuery.gte('order_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        dataQuery = dataQuery.lt('created_at', endDate.toISOString());
        legacyQuery = legacyQuery.lt('order_date', endDate.toISOString());
        countNewQuery = countNewQuery.lt('created_at', endDate.toISOString());
        countLegacyQuery = countLegacyQuery.lt('order_date', endDate.toISOString());
      }

      // Apply search filter (order number, email, and customer name)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const newOrderSearch = `order_number.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%,shipping_first_name.ilike.%${searchTerm}%,shipping_last_name.ilike.%${searchTerm}%,billing_first_name.ilike.%${searchTerm}%,billing_last_name.ilike.%${searchTerm}%`;
        dataQuery = dataQuery.or(newOrderSearch);
        countNewQuery = countNewQuery.or(newOrderSearch);
        // For legacy orders, search by woo_order_id, billing_email, or name
        const wcMatch = searchTerm.match(/^wc-?(\d+)$/i);
        if (wcMatch) {
          legacyQuery = legacyQuery.eq('woo_order_id', parseInt(wcMatch[1]));
          countLegacyQuery = countLegacyQuery.eq('woo_order_id', parseInt(wcMatch[1]));
        } else if (/^\d+$/.test(searchTerm)) {
          legacyQuery = legacyQuery.eq('woo_order_id', parseInt(searchTerm));
          countLegacyQuery = countLegacyQuery.eq('woo_order_id', parseInt(searchTerm));
        } else {
          const legacySearch = `billing_email.ilike.%${searchTerm}%,billing_first_name.ilike.%${searchTerm}%,billing_last_name.ilike.%${searchTerm}%`;
          legacyQuery = legacyQuery.or(legacySearch);
          countLegacyQuery = countLegacyQuery.or(legacySearch);
        }
      }

      // Apply growing system filter (only applies to new orders, legacy orders don't have this field)
      if (filters.growingSystem) {
        dataQuery = dataQuery.eq('growing_system', filters.growingSystem);
        countNewQuery = countNewQuery.eq('growing_system', filters.growingSystem);
        // Legacy orders don't have growing_system — exclude them
        legacyQuery = legacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        countLegacyQuery = countLegacyQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Execute all queries in parallel (data + count)
      const fetchLegacyOrders = async () => {
        try {
          return await legacyQuery;
        } catch {
          return { data: [], error: null };
        }
      };
      const fetchLegacyCount = async () => {
        try {
          return await countLegacyQuery;
        } catch {
          return { count: 0, error: null };
        }
      };

      const [dataResult, legacyResult, newCountResult, legacyCountResult] = await Promise.all([
        dataQuery,
        fetchLegacyOrders(),
        countNewQuery,
        fetchLegacyCount(),
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
        items: (order.order_items_with_product || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || 'Unknown Product',
          product_image: (() => { const imgs = Array.isArray(item.products?.images) ? item.products.images : []; return (imgs.find((img: any) => img.is_primary) || imgs[0])?.url || null; })(),
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
          product_type: item.product_type || null,
          seedlings_per_unit: item.bundle_item_count || null,
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
        pickup_location: order.pickup_locations || null,
        // Pick the active (non-voided) shipment, falling back to the latest one
        ...(() => {
          const shipments = Array.isArray(order.shipments) ? order.shipments : [];
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
        items: (() => {
          // Deduplicate legacy items (NULL woo_product_id can bypass unique constraint)
          const seen = new Set<string>();
          return (order.legacy_order_items || []).filter((item: any) => {
            const key = `${item.product_name}|${item.quantity}|${item.line_total}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).map((item: any) => ({
            id: item.id,
            product_id: item.product_id || '',
            product_name: item.product_name,
            product_image: null,
            quantity: item.quantity,
            unit_price: item.line_total / (item.quantity || 1),
            line_total: item.line_total,
          }));
        })(),
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
      // Use COUNT query results for accurate total (not capped by data fetch limits).
      // Fall back to client-side length when shipping filter narrows results further.
      const accurateCount = (newCountResult.count || 0) + ((legacyCountResult as any).count || 0);
      setTotalCount(shippingFilter ? allOrders.length : accurateCount);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  // Stabilize dependencies: serialize statuses array to avoid reference-comparison issues,
  // and include showTrashed which was previously missing (stale closure bug).
  }, [filters.status, JSON.stringify(filters.statuses), filters.showTrashed, filters.shippingStatus, filters.deliveryMethod, filters.dateFrom, filters.dateTo, filters.search, page, perPage]);

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
          customers!customer_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          order_items_with_product (
            id,
            product_id,
            product_name,
            product_price,
            quantity,
            line_total,
            product_type,
            bundle_item_count,
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

      // Fetch activity log
      let activityData: any[] | null = null;
      try {
        const { data, error: activityError } = await supabase
          .from('order_activity_log')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });

        if (activityError && activityError.code !== '42P01') {
          console.warn('Could not fetch activity log:', activityError);
        }
        activityData = data;
      } catch (actErr) {
        console.warn('Activity log fetch failed:', actErr);
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
        customer_notes: orderData.customer_notes,
        growing_system: orderData.growing_system,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        items: (orderData.order_items_with_product || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || 'Unknown Product',
          product_image: (() => { const imgs = Array.isArray(item.products?.images) ? item.products.images : []; return (imgs.find((img: any) => img.is_primary) || imgs[0])?.url || null; })(),
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
          product_type: item.product_type || null,
          seedlings_per_unit: item.bundle_item_count || null,
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
        activity_log: (activityData || []).map((a: any) => ({
          id: a.id,
          order_id: a.order_id,
          activity_type: a.activity_type as OrderActivityType,
          description: a.description,
          details: a.details || {},
          created_by: a.created_by,
          created_by_name: a.created_by_name || 'System',
          created_at: a.created_at,
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
        // Raw address fields for inline editing
        shipping_first_name: orderData.shipping_first_name || null,
        shipping_last_name: orderData.shipping_last_name || null,
        shipping_address_line1: orderData.shipping_address_line1 || null,
        shipping_address_line2: orderData.shipping_address_line2 || null,
        shipping_city: orderData.shipping_city || null,
        shipping_state: orderData.shipping_state || null,
        shipping_zip: orderData.shipping_zip || null,
        shipping_phone: orderData.shipping_phone || null,
        billing_first_name: orderData.billing_first_name || null,
        billing_last_name: orderData.billing_last_name || null,
        billing_address_line1: orderData.billing_address_line1 || null,
        billing_address_line2: orderData.billing_address_line2 || null,
        billing_city: orderData.billing_city || null,
        billing_state: orderData.billing_state || null,
        billing_zip: orderData.billing_zip || null,
        shipping_method_name: orderData.shipping_method_name || null,
        tracking_url: orderData.tracking_url || null,
        estimated_delivery_date: orderData.estimated_delivery_date || null,
        discount_amount: orderData.discount_amount || null,
        shipping_service_code: orderData.shipping_service_code || null,
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

// Hook: Fetch adjacent (prev/next) order IDs for navigation
export function useAdjacentOrders(orderId: string | null) {
  const [prevOrderId, setPrevOrderId] = useState<string | null>(null);
  const [nextOrderId, setNextOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setPrevOrderId(null);
      setNextOrderId(null);
      return;
    }

    const fetchAdjacent = async () => {
      try {
        // Get current order's created_at
        const { data: current } = await supabase
          .from('orders')
          .select('created_at')
          .eq('id', orderId)
          .single();

        if (!current) return;

        // Next (newer) order
        const { data: newer } = await supabase
          .from('orders')
          .select('id')
          .gt('created_at', current.created_at)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        // Previous (older) order
        const { data: older } = await supabase
          .from('orders')
          .select('id')
          .lt('created_at', current.created_at)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setNextOrderId(newer?.id || null);
        setPrevOrderId(older?.id || null);
      } catch {
        // Ignore errors — navigation is non-critical
      }
    };

    fetchAdjacent();
  }, [orderId]);

  return { prevOrderId, nextOrderId };
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

      // Deduplicate items by product_name+quantity+line_total
      // (handles WooCommerce import duplicates caused by NULL woo_product_id bypassing unique constraint)
      const seen = new Set<string>();
      const dedupedItems = (itemsData || []).filter((item: any) => {
        const key = `${item.product_name}|${item.quantity}|${item.line_total}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(dedupedItems);
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

/**
 * Log an activity entry to the order_activity_log table.
 * Fire-and-forget — logs warning on failure but doesn't throw.
 */
export async function logOrderActivity(params: {
  orderId: string;
  activityType: OrderActivityType;
  description: string;
  details?: Record<string, any>;
  createdBy?: string | null;
  createdByName?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from('order_activity_log').insert({
      order_id: params.orderId,
      activity_type: params.activityType,
      description: params.description,
      details: params.details || {},
      created_by: params.createdBy || null,
      created_by_name: params.createdByName || null,
    });
    if (error) {
      console.warn('Could not log order activity:', error);
    }
  } catch (err) {
    console.warn('Order activity log failed:', err);
  }
}
