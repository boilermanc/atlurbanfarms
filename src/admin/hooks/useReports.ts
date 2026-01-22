import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Types
export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface DailySales {
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesReportData {
  summary: SalesSummary;
  dailySales: DailySales[];
}

export interface ProductSales {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  currentStock: number;
  threshold: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
}

export interface ProductsReportData {
  bestSellers: ProductSales[];
  lowStock: LowStockProduct[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface CustomerStats {
  newCustomers: number;
  returningCustomers: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  email: string;
  orders: number;
  totalSpent: number;
}

export interface AttributionSource {
  source: string;
  count: number;
  percentage: number;
}

export interface CustomersReportData {
  customerStats: CustomerStats;
  topCustomers: TopCustomer[];
  attribution: AttributionSource[];
}

export interface OrderStatusBreakdown {
  status: string;
  count: number;
}

export interface CarrierStats {
  carrier: string;
  shipments: number;
  avgTransitDays: number;
}

export interface DeliveryException {
  orderId: string;
  orderNumber: string;
  status: string;
  issue: string;
  date: string;
}

export interface ShippingReportData {
  statusBreakdown: OrderStatusBreakdown[];
  carrierStats: CarrierStats[];
  avgTransitTime: number;
  deliveryExceptions: DeliveryException[];
}

// Helper to format dates for Supabase queries
const formatDateForQuery = (date: string): string => {
  return new Date(date).toISOString();
};

const getEndOfDay = (date: string): string => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

// Hook: Sales Report
export function useSalesReport(startDate: string, endDate: string) {
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const startISO = formatDateForQuery(startDate);
      const endISO = getEndOfDay(endDate);

      // Fetch orders within date range
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, created_at, status')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      const orders = ordersData || [];

      // Calculate summary
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Group by day for daily sales
      const dailySalesMap = new Map<string, { revenue: number; orders: number }>();

      // Initialize all days in range
      const current = new Date(startDate);
      const end = new Date(endDate);
      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        dailySalesMap.set(dateKey, { revenue: 0, orders: 0 });
        current.setDate(current.getDate() + 1);
      }

      // Populate with actual data
      orders.forEach((order) => {
        const dateKey = new Date(order.created_at).toISOString().split('T')[0];
        const existing = dailySalesMap.get(dateKey) || { revenue: 0, orders: 0 };
        dailySalesMap.set(dateKey, {
          revenue: existing.revenue + (order.total || 0),
          orders: existing.orders + 1,
        });
      });

      const dailySales: DailySales[] = Array.from(dailySalesMap.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
        },
        dailySales,
      });
    } catch (err: any) {
      console.error('Error fetching sales report:', err);
      setError(err.message || 'Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, error, refetch: fetchReport };
}

// Hook: Products Report
export function useProductsReport(startDate: string, endDate: string) {
  const [data, setData] = useState<ProductsReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const startISO = formatDateForQuery(startDate);
      const endISO = getEndOfDay(endDate);

      // Fetch order items with product info within date range
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          line_total,
          product_id,
          products (
            id,
            name,
            category
          ),
          orders!inner (
            id,
            created_at,
            status
          )
        `)
        .gte('orders.created_at', startISO)
        .lte('orders.created_at', endISO)
        .neq('orders.status', 'cancelled');

      if (orderItemsError) throw orderItemsError;

      // Calculate best sellers
      const productSalesMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();

      (orderItemsData || []).forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown Product';
        const existing = productSalesMap.get(productId) || { name: productName, unitsSold: 0, revenue: 0 };
        productSalesMap.set(productId, {
          name: productName,
          unitsSold: existing.unitsSold + item.quantity,
          revenue: existing.revenue + (item.line_total || 0),
        });
      });

      const bestSellers: ProductSales[] = Array.from(productSalesMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 10);

      // Fetch low stock products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, low_stock_threshold')
        .eq('active', true);

      if (productsError) throw productsError;

      const lowStock: LowStockProduct[] = (productsData || [])
        .filter((p: any) => {
          const threshold = p.low_stock_threshold || 10;
          return (p.stock_quantity || 0) <= threshold;
        })
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          currentStock: p.stock_quantity || 0,
          threshold: p.low_stock_threshold || 10,
        }))
        .sort((a, b) => a.currentStock - b.currentStock)
        .slice(0, 10);

      // Calculate category breakdown
      const categoryMap = new Map<string, { count: number; revenue: number }>();

      (orderItemsData || []).forEach((item: any) => {
        const category = item.products?.category || 'Uncategorized';
        const existing = categoryMap.get(category) || { count: 0, revenue: 0 };
        categoryMap.set(category, {
          count: existing.count + item.quantity,
          revenue: existing.revenue + (item.line_total || 0),
        });
      });

      const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      setData({
        bestSellers,
        lowStock,
        categoryBreakdown,
      });
    } catch (err: any) {
      console.error('Error fetching products report:', err);
      setError(err.message || 'Failed to fetch products report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, error, refetch: fetchReport };
}

// Hook: Customers Report
export function useCustomersReport(startDate: string, endDate: string) {
  const [data, setData] = useState<CustomersReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const startISO = formatDateForQuery(startDate);
      const endISO = getEndOfDay(endDate);

      // Fetch orders within date range
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_id, guest_email, total, created_at, status')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      const orders = ordersData || [];

      // Get unique customer IDs in this period
      const customerIdsInPeriod = new Set(orders.map(o => o.customer_id).filter(Boolean));

      // Count new vs returning customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, created_at');

      if (customersError) throw customersError;

      let newCustomers = 0;
      let returningCustomers = 0;

      const startDateObj = new Date(startDate);

      customerIdsInPeriod.forEach((customerId) => {
        const customer = (customersData || []).find((c: any) => c.id === customerId);
        if (customer) {
          const customerCreated = new Date(customer.created_at);
          if (customerCreated >= startDateObj) {
            newCustomers++;
          } else {
            returningCustomers++;
          }
        }
      });

      // Calculate top customers
      const customerOrdersMap = new Map<string, { email: string; orders: number; totalSpent: number }>();

      orders.forEach((order) => {
        const customerId = order.customer_id;
        if (!customerId) return;

        const existing = customerOrdersMap.get(customerId) || {
          email: order.guest_email || '',
          orders: 0,
          totalSpent: 0
        };
        customerOrdersMap.set(customerId, {
          email: existing.email || order.guest_email || '',
          orders: existing.orders + 1,
          totalSpent: existing.totalSpent + (order.total || 0),
        });
      });

      // Get customer names
      const { data: customerNamesData } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(customerOrdersMap.keys()));

      const customerNamesMap = new Map(
        (customerNamesData || []).map((c: any) => [
          c.id,
          { name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email, email: c.email }
        ])
      );

      const topCustomers: TopCustomer[] = Array.from(customerOrdersMap.entries())
        .map(([id, data]) => {
          const nameData = customerNamesMap.get(id);
          return {
            id,
            name: nameData?.name || 'Guest',
            email: nameData?.email || data.email,
            orders: data.orders,
            totalSpent: data.totalSpent,
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Fetch attribution data
      const { data: attributionData, error: attributionError } = await supabase
        .from('customer_attribution')
        .select('source, customer_id')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (attributionError) {
        console.warn('Could not fetch attribution data:', attributionError);
      }

      const attributionMap = new Map<string, number>();
      (attributionData || []).forEach((attr: any) => {
        const source = attr.source || 'Unknown';
        attributionMap.set(source, (attributionMap.get(source) || 0) + 1);
      });

      const totalAttribution = Array.from(attributionMap.values()).reduce((a, b) => a + b, 0);

      const attribution: AttributionSource[] = Array.from(attributionMap.entries())
        .map(([source, count]) => ({
          source,
          count,
          percentage: totalAttribution > 0 ? (count / totalAttribution) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      setData({
        customerStats: { newCustomers, returningCustomers },
        topCustomers,
        attribution,
      });
    } catch (err: any) {
      console.error('Error fetching customers report:', err);
      setError(err.message || 'Failed to fetch customers report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, error, refetch: fetchReport };
}

// Hook: Shipping Report
export function useShippingReport(startDate: string, endDate: string) {
  const [data, setData] = useState<ShippingReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const startISO = formatDateForQuery(startDate);
      const endISO = getEndOfDay(endDate);

      // Fetch orders within date range
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, status, shipping_method, tracking_number, created_at, updated_at, estimated_delivery')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (ordersError) throw ordersError;

      const orders = ordersData || [];

      // Calculate status breakdown
      const statusMap = new Map<string, number>();
      orders.forEach((order) => {
        const status = order.status || 'unknown';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const statusBreakdown: OrderStatusBreakdown[] = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate carrier stats
      const carrierMap = new Map<string, { shipments: number; transitDays: number[] }>();

      orders.forEach((order) => {
        if (order.shipping_method) {
          const carrier = order.shipping_method;
          const existing = carrierMap.get(carrier) || { shipments: 0, transitDays: [] };

          // Calculate transit time if we have delivery data
          if (order.status === 'delivered' && order.estimated_delivery) {
            const created = new Date(order.created_at);
            const delivered = new Date(order.updated_at);
            const transitDays = Math.ceil((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            if (transitDays > 0 && transitDays < 30) {
              existing.transitDays.push(transitDays);
            }
          }

          carrierMap.set(carrier, {
            shipments: existing.shipments + 1,
            transitDays: existing.transitDays,
          });
        }
      });

      const carrierStats: CarrierStats[] = Array.from(carrierMap.entries())
        .map(([carrier, data]) => ({
          carrier,
          shipments: data.shipments,
          avgTransitDays: data.transitDays.length > 0
            ? data.transitDays.reduce((a, b) => a + b, 0) / data.transitDays.length
            : 0,
        }))
        .sort((a, b) => b.shipments - a.shipments);

      // Calculate overall average transit time
      const allTransitDays = carrierStats.flatMap((c) =>
        c.avgTransitDays > 0 ? [c.avgTransitDays] : []
      );
      const avgTransitTime = allTransitDays.length > 0
        ? allTransitDays.reduce((a, b) => a + b, 0) / allTransitDays.length
        : 0;

      // Find delivery exceptions (cancelled, stuck orders)
      const exceptions = ['cancelled'];
      const stuckStatuses = ['pending', 'paid', 'allocated'];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deliveryExceptions: DeliveryException[] = orders
        .filter((order) => {
          if (exceptions.includes(order.status)) return true;
          if (stuckStatuses.includes(order.status)) {
            const createdDate = new Date(order.created_at);
            return createdDate < sevenDaysAgo;
          }
          return false;
        })
        .map((order) => ({
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          issue: order.status === 'cancelled'
            ? 'Order cancelled'
            : 'Order stuck in processing',
          date: order.created_at,
        }))
        .slice(0, 20);

      setData({
        statusBreakdown,
        carrierStats,
        avgTransitTime,
        deliveryExceptions,
      });
    } catch (err: any) {
      console.error('Error fetching shipping report:', err);
      setError(err.message || 'Failed to fetch shipping report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, error, refetch: fetchReport };
}
