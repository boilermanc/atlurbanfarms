import React, { useState, Suspense, lazy, useEffect } from 'react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import ErrorBoundary from './ErrorBoundary';
import { AdminProvider } from '../context/AdminContext';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { supabase } from '../../lib/supabase';
import { ORDER_STATUS_CONFIG, ViewOrderHandler } from '../hooks/useOrders';
import {
  Package,
  Leaf,
  ClipboardList,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Plus,
  Truck,
  Settings,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';

// Lazy load admin pages to avoid circular dependencies
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const BatchEditPage = lazy(() => import('../pages/BatchEditPage'));
const ShippingZonesPage = lazy(() => import('../pages/ShippingZonesPage'));
const ShippingCalendarPage = lazy(() => import('../pages/ShippingCalendarPage'));
const ShippingServicesPage = lazy(() => import('../pages/ShippingServicesPage'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('../pages/CustomerDetailPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
const OrderCreatePage = lazy(() => import('../pages/OrderCreatePage'));
const FAQPage = lazy(() => import('../pages/FAQPage'));
const ContentPagesPage = lazy(() => import('../pages/ContentPagesPage'));
const ContentEditPage = lazy(() => import('../pages/ContentEditPage'));
const AttributionPage = lazy(() => import('../pages/AttributionPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const FeatureFlagsPage = lazy(() => import('../pages/FeatureFlagsPage'));
const IntegrationsPage = lazy(() => import('../pages/IntegrationsPage'));
const EmailTemplatesPage = lazy(() => import('../pages/EmailTemplatesPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const ProductEditPage = lazy(() => import('../pages/ProductEditPage'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));
const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage'));
const ShippingPage = lazy(() => import('../pages/ShippingPage'));
const PromotionsPage = lazy(() => import('../pages/PromotionsPage'));
const PromotionEditPage = lazy(() => import('../pages/PromotionEditPage'));
const FulfillmentPage = lazy(() => import('../pages/FulfillmentPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const GiftCardsPage = lazy(() => import('../pages/GiftCardsPage'));
const GiftCardDetailPage = lazy(() => import('../pages/GiftCardDetailPage'));
const GiftCardCreateModal = lazy(() => import('./GiftCardCreateModal'));
const WooImportPage = lazy(() => import('../pages/WooImportPage'));
const ProductTagsPage = lazy(() => import('../pages/ProductTagsPage'));
const CustomerTagsPage = lazy(() => import('../pages/CustomerTagsPage'));
const LegacyOrderDetailPage = lazy(() => import('../pages/LegacyOrderDetailPage'));
const SiteContentPage = lazy(() => import('../pages/SiteContentPage'));
const GrowersPage = lazy(() => import('../pages/GrowersPage'));
const SproutifyCreditsPage = lazy(() => import('../pages/SproutifyCreditsPage'));
const BlogListPage = lazy(() => import('../pages/BlogListPage'));
const BlogEditPage = lazy(() => import('../pages/BlogEditPage'));
const GrowingSystemsPage = lazy(() => import('../pages/GrowingSystemsPage'));
const GrowingInterestsPage = lazy(() => import('../pages/GrowingInterestsPage'));
const WeeklySalesReportPage = lazy(() => import('../pages/WeeklySalesReportPage'));

// Loading component for Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 brand-spinner rounded-full animate-spin" />
  </div>
);

interface AdminLayoutProps {
  children?: React.ReactNode;
  initialPage?: string;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  'order-detail': 'Order Details',
  'legacy-order-detail': 'Legacy Order Details',
  'order-create': 'Create Order',
  products: 'Products',
  'product-edit': 'Edit Product',
  categories: 'Categories',
  inventory: 'Inventory',
  'batch-edit': 'Batch Edit',
  customers: 'Customers',
  'customer-detail': 'Customer Details',
  shipping: 'Shipping',
  fulfillment: 'Fulfillment',
  zones: 'Shipping Zones & Rules',
  calendar: 'Events Calendar',
  services: 'Shipping Services',
  faqs: 'FAQs',
  'content-pages': 'Content Pages',
  'content-edit': 'Edit Content',
  attribution: 'Attribution',
  settings: 'Settings',
  'feature-flags': 'Feature Flags',
  integrations: 'Integrations',
  'email-templates': 'Email Templates',
  reports: 'Reports',
  'users-roles': 'Admin Users & Roles',
  'audit-log': 'Audit Log',
  promotions: 'Promotions',
  'promotion-edit': 'Edit Promotion',
  alerts: 'Alerts',
  'gift-cards': 'Gift Cards',
  'gift-card-detail': 'Gift Card Details',
  'woo-import': 'WooCommerce Import',
  'product-tags': 'Product Tags',
  'customer-tags': 'Customer Tags',
  'site-content': 'Site Content',
  'growers': 'Team Members',
  'sproutify-credits': 'Sproutify Credits',
  'blog': 'Blog',
  'blog-edit': 'Edit Blog Post',
  'growing-systems': 'Growing Systems',
  'growing-interests': 'Growing Interests',
  'weekly-sales-report': 'Weekly Sales Report',
};

// Dashboard Stats Interface
interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalActiveProducts: number;
  inventoryHealth: 'critical' | 'low' | 'good';
  totalCustomers: number;
  abandonedCarts: number;
  abandonedCartValue: number;
  recentOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    total: number;
    status: string;
    created_at: string;
  }>;
}

// Dashboard Component
const Dashboard: React.FC<{ onNavigate: (page: string) => void; onViewOrder: ViewOrderHandler }> = ({ onNavigate, onViewOrder }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch today's orders
        const { data: todayOrdersData, error: todayError } = await supabase
          .from('orders')
          .select('id, total')
          .gte('created_at', today.toISOString());

        // Fetch pending orders count
        const { count: pendingCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending_payment', 'processing', 'on_hold']);

        // Fetch inventory stats from products table directly
        // Get total active products
        const { count: totalActiveCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch all active products to calculate low stock properly
        // We need to compare quantity_available to each product's low_stock_threshold
        const { data: activeProducts } = await supabase
          .from('products')
          .select('id, quantity_available, low_stock_threshold')
          .eq('is_active', true);

        let outOfStockCount = 0;
        let lowStockCount = 0;

        if (activeProducts) {
          activeProducts.forEach((product) => {
            const qty = product.quantity_available ?? 0;
            const threshold = product.low_stock_threshold ?? 10;

            if (qty === 0) {
              outOfStockCount++;
            } else if (qty <= threshold) {
              lowStockCount++;
            }
          });
        }

        // Calculate inventory health based on percentage of problematic items
        const totalActive = totalActiveCount || 0;
        const problemItems = outOfStockCount + lowStockCount;
        const problemPercentage = totalActive > 0 ? (problemItems / totalActive) * 100 : 0;

        let inventoryHealth: 'critical' | 'low' | 'good' = 'good';
        if (outOfStockCount > 0 && outOfStockCount >= totalActive * 0.25) {
          // Critical: 25% or more products are out of stock
          inventoryHealth = 'critical';
        } else if (problemPercentage >= 30) {
          // Low: 30% or more products have stock issues
          inventoryHealth = 'low';
        }

        // Fetch total customers
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });

        // Fetch abandoned carts (last 7 days, not converted)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: abandonedCartsData } = await supabase
          .from('abandoned_carts')
          .select('cart_total')
          .is('converted_at', null)
          .gt('created_at', sevenDaysAgo.toISOString());

        const abandonedCarts = abandonedCartsData?.length || 0;
        const abandonedCartValue = (abandonedCartsData || [])
          .reduce((sum: number, cart: any) => sum + (Number(cart.cart_total) || 0), 0);

        // Fetch recent orders
        const { data: recentOrdersData } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            total,
            status,
            created_at,
            customers (
              first_name,
              last_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        const todayOrders = todayOrdersData || [];
        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);

        setStats({
          todayOrders: todayOrders.length,
          todayRevenue,
          pendingOrders: pendingCount || 0,
          lowStockItems: lowStockCount + outOfStockCount,
          outOfStockItems: outOfStockCount,
          totalActiveProducts: totalActive,
          inventoryHealth,
          totalCustomers: customerCount || 0,
          abandonedCarts,
          abandonedCartValue,
          recentOrders: (recentOrdersData || []).map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customers
              ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || 'Guest'
              : 'Guest',
            total: order.total,
            status: order.status,
            created_at: order.created_at,
          })),
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending_payment: 'bg-amber-100 text-amber-700 border-amber-200',
      processing: 'bg-blue-100 text-blue-700 border-blue-200',
      on_hold: 'bg-purple-100 text-purple-700 border-purple-200',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      refunded: 'bg-rose-100 text-rose-700 border-rose-200',
      failed: 'bg-slate-200 text-slate-700 border-slate-300',
    };
    return statusStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-3 brand-spinner rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Today's Orders",
      value: stats?.todayOrders || 0,
      icon: ShoppingCart,
      color: '#10b981',
      bgColor: 'from-emerald-50 to-emerald-100/50',
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(stats?.todayRevenue || 0),
      icon: DollarSign,
      color: '#3b82f6',
      bgColor: 'from-blue-50 to-blue-100/50',
    },
    {
      title: 'Pending Orders',
      value: stats?.pendingOrders || 0,
      icon: Package,
      color: '#8b5cf6',
      bgColor: 'from-purple-50 to-purple-100/50',
    },
    {
      title: 'Low Stock Items',
      value: stats?.lowStockItems || 0,
      icon: AlertTriangle,
      color: stats?.lowStockItems ? '#f59e0b' : '#10b981',
      bgColor: stats?.lowStockItems ? 'from-amber-50 to-amber-100/50' : 'from-emerald-50 to-emerald-100/50',
    },
  ];

  const quickActions = [
    { label: 'New Order', icon: Plus, onClick: () => onNavigate('orders'), color: 'emerald' },
    { label: 'Add Product', icon: Leaf, onClick: () => onNavigate('products'), color: 'blue' },
    { label: 'Shipping', icon: Truck, onClick: () => onNavigate('shipping'), color: 'purple' },
    { label: 'Settings', icon: Settings, onClick: () => onNavigate('settings'), color: 'slate' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-admin-display">Welcome back!</h2>
        <p className="text-slate-500 mt-1">Here's what's happening with your store today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${card.bgColor} border border-slate-200/60 animate-slide-up`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1 font-admin-display">{card.value}</p>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: `${card.color}15` }}
              >
                <card.icon size={24} style={{ color: card.color }} />
              </div>
            </div>
            {/* Decorative circle */}
            <div
              className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10"
              style={{ backgroundColor: card.color }}
            />
          </div>
        ))}
      </div>

      {/* Quick Actions & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-semibold text-slate-800 font-admin-display mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-${action.color}-50 hover:bg-${action.color}-100 border border-${action.color}-200 transition-colors group`}
              >
                <action.icon className={`text-${action.color}-600 group-hover:scale-110 transition-transform`} size={24} />
                <span className={`text-sm font-medium text-${action.color}-700`}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 font-admin-display">Recent Orders</h3>
            <button
              onClick={() => onNavigate('orders')}
              className="text-sm font-medium brand-text hover:opacity-80 flex items-center gap-1"
            >
              View all <ArrowRight size={16} />
            </button>
          </div>

          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="space-y-3">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => onViewOrder(order.id)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
                    {order.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{order.customer_name}</p>
                    <p className="text-sm text-slate-500">{order.order_number} • {formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{formatCurrency(order.total)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(order.status)}`}>
                      {ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.label || order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>No orders yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customers Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Customers</p>
              <p className="text-2xl font-bold text-slate-800 font-admin-display">{stats?.totalCustomers || 0}</p>
            </div>
          </div>
        </div>

        {/* Abandoned Carts Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100">
              <ShoppingCart size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Abandoned Carts (7d)</p>
              <p className="text-2xl font-bold text-slate-800 font-admin-display">{stats?.abandonedCarts || 0}</p>
              {(stats?.abandonedCartValue || 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {formatCurrency(stats?.abandonedCartValue || 0)} potential revenue
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Status Card */}
        {stats?.inventoryHealth === 'critical' ? (
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 border border-red-200/60">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">Critical Stock Alert</p>
                <p className="text-lg font-bold text-red-800">
                  {stats.outOfStockItems} out of stock, {stats.lowStockItems - stats.outOfStockItems} low stock
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {stats.totalActiveProducts > 0
                    ? `${Math.round((stats.lowStockItems / stats.totalActiveProducts) * 100)}% of products need attention`
                    : 'No active products'}
                </p>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors text-sm"
              >
                View Inventory
              </button>
            </div>
          </div>
        ) : stats?.inventoryHealth === 'low' || (stats?.lowStockItems && stats.lowStockItems > 0) ? (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200/60">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700">Low Stock Alert</p>
                <p className="text-lg font-bold text-amber-800">
                  {stats?.outOfStockItems ? `${stats.outOfStockItems} out of stock, ` : ''}
                  {(stats?.lowStockItems || 0) - (stats?.outOfStockItems || 0)} low stock
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {stats?.lowStockItems} item{stats?.lowStockItems !== 1 ? 's' : ''} need restocking
                </p>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors text-sm"
              >
                View Inventory
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-200/60">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingUp size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">Inventory Status</p>
                <p className="text-lg font-bold text-emerald-800">All items well stocked!</p>
                <p className="text-xs text-emerald-600 mt-1">
                  {stats?.totalActiveProducts || 0} active product{stats?.totalActiveProducts !== 1 ? 's' : ''} in stock
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, initialPage = 'dashboard' }) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLegacyOrder, setIsLegacyOrder] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null);
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null);
  const [showGiftCardCreateModal, setShowGiftCardCreateModal] = useState(false);
  const [selectedBlogPostId, setSelectedBlogPostId] = useState<string | null>(null);
  const [orderContext, setOrderContext] = useState<{ customerId: string; customerName?: string } | null>(null);

  const { isAdmin, adminUser, loading } = useAdminAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen brand-gradient-subtle flex items-center justify-center font-admin-body">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 brand-spinner rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!adminUser) {
    window.location.href = '/admin/login';
    return null;
  }

  // Authenticated but not an admin - show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen brand-gradient-subtle flex items-center justify-center font-admin-body">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center border border-slate-200 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2 font-admin-display">Access Denied</h1>
          <p className="text-slate-500 mb-6">
            You do not have permission to access the admin area.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
            >
              Sign Out
            </button>
            <a
              href="/"
              className="inline-block px-4 py-2 btn-brand font-medium rounded-xl transition-colors"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    // Reset detail selections when navigating to list pages
    if (page === 'orders') {
      setSelectedOrderId(null);
      setIsLegacyOrder(false);
    }
    if (page === 'customers') setSelectedCustomerId(null);
    if (page === 'products') setSelectedProductId(null);
    if (page === 'content-pages') setSelectedContentId(null);
    if (page === 'inventory') setSelectedBatchId(null);
    if (page === 'promotions') setSelectedPromotionId(null);
    if (page === 'gift-cards') setSelectedGiftCardId(null);
    if (page === 'blog') setSelectedBlogPostId(null);
    if (page !== 'order-detail' && page !== 'legacy-order-detail') setOrderContext(null);
  };

  const handleEditBatch = (batchId?: string) => {
    setSelectedBatchId(batchId || null);
    setCurrentPage('batch-edit');
  };

  const handleViewOrder: ViewOrderHandler = (orderId, options) => {
    setSelectedOrderId(orderId);
    setIsLegacyOrder(options?.isLegacy || false);
    if (options?.fromCustomerId) {
      setOrderContext({
        customerId: options.fromCustomerId,
        customerName: options.fromCustomerName,
      });
    } else {
      setOrderContext(null);
    }
    setCurrentPage(options?.isLegacy ? 'legacy-order-detail' : 'order-detail');
  };

  const handleViewCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentPage('customer-detail');
  };

  const handleEditProduct = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentPage('product-edit');
  };

  const handleEditContent = (contentId: string) => {
    setSelectedContentId(contentId);
    setCurrentPage('content-edit');
  };

  const handleEditPromotion = (promotionId: string) => {
    setSelectedPromotionId(promotionId || null);
    setCurrentPage('promotion-edit');
  };

  const handleViewGiftCard = (giftCardId: string) => {
    setSelectedGiftCardId(giftCardId);
    setCurrentPage('gift-card-detail');
  };

  const handleCreateGiftCard = () => {
    setShowGiftCardCreateModal(true);
  };

  const handleEditBlogPost = (postId: string) => {
    setSelectedBlogPostId(postId);
    setCurrentPage('blog-edit');
  };

  const handleCreateBlogPost = () => {
    setSelectedBlogPostId(null);
    setCurrentPage('blog-edit');
  };

  const handleGiftCardCreated = (_: string, code: string) => {
    setShowGiftCardCreateModal(false);
    // Optionally navigate to the new gift card or just refresh the list
    handleNavigate('gift-cards');
  };

  const handleBackToOrders = () => {
    setOrderContext(null);
    handleNavigate('orders');
  };

  const handleBackToCustomerFromOrder = () => {
    if (!orderContext) return;
    handleViewCustomer(orderContext.customerId);
    setOrderContext(null);
  };

  const renderPage = () => {
    // If children are provided, render them (for backward compatibility)
    if (children) {
      return children;
    }

    switch (currentPage) {
      case 'orders':
        return <OrdersPage onViewOrder={handleViewOrder} onNavigate={handleNavigate} />;
      case 'order-detail':
        return selectedOrderId ? (
          <OrderDetailPage
            orderId={selectedOrderId}
            onBack={handleBackToOrders}
            onBackToCustomer={orderContext ? handleBackToCustomerFromOrder : undefined}
            customerContextName={orderContext?.customerName}
          />
        ) : null;
      case 'legacy-order-detail':
        return selectedOrderId ? (
          <LegacyOrderDetailPage
            orderId={selectedOrderId}
            onBack={handleBackToOrders}
            onBackToCustomer={orderContext ? handleBackToCustomerFromOrder : undefined}
            customerContextName={orderContext?.customerName}
          />
        ) : null;
      case 'order-create':
        return <OrderCreatePage onNavigate={handleNavigate} />;
      case 'products':
        return <ProductsPage onEditProduct={handleEditProduct} />;
      case 'product-edit':
        return (
          <ProductEditPage
            productId={selectedProductId}
            onBack={() => handleNavigate('products')}
            onSave={() => handleNavigate('products')}
          />
        );
      case 'categories':
        return <CategoriesPage />;
      case 'inventory':
        return <InventoryPage onNavigateToBatchEdit={handleEditBatch} onEditProduct={handleEditProduct} />;
      case 'batch-edit':
        return <BatchEditPage batchId={selectedBatchId || undefined} onNavigateBack={() => handleNavigate('inventory')} />;
      case 'customers':
        return <CustomersPage onViewCustomer={handleViewCustomer} />;
      case 'alerts':
        return <AlertsPage />;
      case 'customer-detail':
        return selectedCustomerId ? (
          <CustomerDetailPage
            customerId={selectedCustomerId}
            onBack={() => handleNavigate('customers')}
            onViewOrder={handleViewOrder}
          />
        ) : null;
      case 'shipping':
        return <ShippingPage />;
      case 'fulfillment':
        return <FulfillmentPage onViewOrder={handleViewOrder} />;
      case 'weekly-sales-report':
        return <WeeklySalesReportPage />;
      case 'zones':
        return <ShippingZonesPage />;
      case 'calendar':
        return <ShippingCalendarPage />;
      case 'services':
        return <ShippingServicesPage />;
      case 'faqs':
        return <FAQPage />;
      case 'content-pages':
        return <ContentPagesPage onEditContent={handleEditContent} />;
      case 'content-edit':
        return (
          <ContentEditPage
            contentId={selectedContentId}
            onBack={() => handleNavigate('content-pages')}
            onSave={() => handleNavigate('content-pages')}
          />
        );
      case 'attribution':
        return <AttributionPage />;
      case 'settings':
        return <SettingsPage />;
      case 'feature-flags':
        return <FeatureFlagsPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'email-templates':
        return <EmailTemplatesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users-roles':
        return <AdminUsersPage />;
      case 'audit-log':
        return <AuditLogPage />;
      case 'promotions':
        return <PromotionsPage onEditPromotion={handleEditPromotion} />;
      case 'promotion-edit':
        return (
          <PromotionEditPage
            promotionId={selectedPromotionId}
            onBack={() => handleNavigate('promotions')}
            onSave={() => handleNavigate('promotions')}
          />
        );
      case 'gift-cards':
        return (
          <GiftCardsPage
            onViewGiftCard={handleViewGiftCard}
            onCreateGiftCard={handleCreateGiftCard}
          />
        );
      case 'gift-card-detail':
        return selectedGiftCardId ? (
          <GiftCardDetailPage
            giftCardId={selectedGiftCardId}
            onBack={() => handleNavigate('gift-cards')}
          />
        ) : null;
      case 'woo-import':
        return <WooImportPage />;
      case 'product-tags':
        return <ProductTagsPage />;
      case 'customer-tags':
        return <CustomerTagsPage />;
      case 'site-content':
        return <SiteContentPage />;
      case 'growers':
        return <GrowersPage />;
      case 'sproutify-credits':
        return <SproutifyCreditsPage />;
      case 'blog':
        return <BlogListPage onEditPost={handleEditBlogPost} onCreatePost={handleCreateBlogPost} />;
      case 'growing-systems':
        return <GrowingSystemsPage />;
      case 'growing-interests':
        return <GrowingInterestsPage />;
      case 'blog-edit':
        return (
          <BlogEditPage
            postId={selectedBlogPostId}
            onBack={() => handleNavigate('blog')}
            onSave={() => handleNavigate('blog')}
          />
        );
      case 'dashboard':
      default:
        return <Dashboard onNavigate={handleNavigate} onViewOrder={handleViewOrder} />;
    }
  };

  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard';

  return (
    <AdminProvider currentPage={currentPage} navigate={handleNavigate}>
      <div className="min-h-screen brand-gradient-subtle flex font-admin-body">
        {/* Sidebar */}
        <AdminSidebar currentPage={currentPage} onNavigate={handleNavigate} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 ml-64">
          {/* Header */}
          <AdminHeader title={pageTitle} onLogout={handleLogout} />

          {/* Main content */}
          <main className="flex-1 p-8 overflow-auto max-w-[1600px]">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                {renderPage()}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>

        {/* Gift Card Create Modal */}
        <ErrorBoundary>
          <Suspense fallback={null}>
            <GiftCardCreateModal
              isOpen={showGiftCardCreateModal}
              onClose={() => setShowGiftCardCreateModal(false)}
              onSuccess={handleGiftCardCreated}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AdminProvider>
  );
};

export default AdminLayout;
