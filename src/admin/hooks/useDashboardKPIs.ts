import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Types matching the SQL views
export interface TodayKPIs {
  today_revenue: number;
  today_orders: number;
  today_customers: number;
  avg_order_value: number;
}

export interface YesterdayKPIs {
  yesterday_revenue: number;
  yesterday_orders: number;
  yesterday_customers: number;
}

export interface WeeklyComparison {
  this_week_revenue: number;
  last_week_revenue: number;
  this_week_orders: number;
  last_week_orders: number;
}

export interface NewCustomers {
  this_week: number;
  last_week: number;
}

export interface InventorySummary {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_units: number;
}

export interface OrderStatusSummary {
  status: string;
  count: number;
  total_value: number;
}

export interface TopProduct {
  id: string;
  name: string;
  slug: string;
  units_sold: number;
  revenue: number;
  order_count: number;
}

export interface CategorySales {
  id: string;
  category_name: string;
  order_count: number;
  units_sold: number;
  revenue: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  slug: string;
  quantity_available: number;
  low_stock_threshold: number;
  units_needed: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface DailyRevenue {
  date: string;
  order_count: number;
  revenue: number;
  unique_customers: number;
  avg_order_value: number;
}

export interface MonthlyRevenue {
  month: string;
  order_count: number;
  revenue: number;
  unique_customers: number;
}

export interface DashboardKPIs {
  today: TodayKPIs | null;
  yesterday: YesterdayKPIs | null;
  weekly: WeeklyComparison | null;
  new_customers: NewCustomers | null;
  inventory: InventorySummary | null;
  order_statuses: OrderStatusSummary[] | null;
  top_products: TopProduct[] | null;
  category_sales: CategorySales[] | null;
  low_stock: LowStockItem[] | null;
  recent_orders: RecentOrder[] | null;
  daily_revenue: DailyRevenue[] | null;
  monthly_revenue: MonthlyRevenue[] | null;
}

export function useDashboardKPIs() {
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: kpiData, error: kpiError } = await supabase
        .rpc('get_dashboard_kpis');

      if (kpiError) throw kpiError;

      setData(kpiData as DashboardKPIs);
    } catch (err: any) {
      console.error('Error fetching dashboard KPIs:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchKPIs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchKPIs]);

  return { data, loading, error, refetch: fetchKPIs };
}

// Helper function to calculate percentage change
export function calculateChange(current: number, previous: number): { value: number; isPositive: boolean } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, isPositive: current >= 0 };
  }
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), isPositive: change >= 0 };
}

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper function to format date for display
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Helper to get time ago string
export function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
