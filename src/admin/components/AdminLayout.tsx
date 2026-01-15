import React, { useState, useEffect, Suspense, lazy } from 'react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import { AdminProvider } from '../context/AdminContext';
import { supabase } from '../../lib/supabase';

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
const FAQPage = lazy(() => import('../pages/FAQPage'));
const ContentPagesPage = lazy(() => import('../pages/ContentPagesPage'));
const ContentEditPage = lazy(() => import('../pages/ContentEditPage'));
const AttributionPage = lazy(() => import('../pages/AttributionPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const FeatureFlagsPage = lazy(() => import('../pages/FeatureFlagsPage'));
const IntegrationsPage = lazy(() => import('../pages/IntegrationsPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const ProductEditPage = lazy(() => import('../pages/ProductEditPage'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));
const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage'));

// Loading component for Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
  products: 'Products',
  'product-edit': 'Edit Product',
  categories: 'Categories',
  inventory: 'Inventory',
  'batch-edit': 'Batch Edit',
  customers: 'Customers',
  'customer-detail': 'Customer Details',
  fulfillment: 'Fulfillment',
  zones: 'Shipping Zones & Rules',
  calendar: 'Shipping Calendar',
  services: 'Shipping Services',
  faqs: 'FAQs',
  'content-pages': 'Content Pages',
  'content-edit': 'Edit Content',
  attribution: 'Attribution',
  settings: 'Settings',
  'feature-flags': 'Feature Flags',
  integrations: 'Integrations',
  reports: 'Reports',
  'users-roles': 'Admin Users & Roles',
  'audit-log': 'Audit Log',
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, initialPage = 'dashboard' }) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to admin login
        window.history.pushState({}, '', '/admin/login');
        window.location.href = '/admin/login';
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        window.location.href = '/admin/login';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    // Reset detail selections when navigating to list pages
    if (page === 'orders') setSelectedOrderId(null);
    if (page === 'customers') setSelectedCustomerId(null);
    if (page === 'products') setSelectedProductId(null);
    if (page === 'content-pages') setSelectedContentId(null);
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentPage('order-detail');
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

  const renderPage = () => {
    // If children are provided, render them (for backward compatibility)
    if (children) {
      return children;
    }

    switch (currentPage) {
      case 'orders':
        return <OrdersPage onViewOrder={handleViewOrder} />;
      case 'order-detail':
        return selectedOrderId ? (
          <OrderDetailPage
            orderId={selectedOrderId}
            onBack={() => handleNavigate('orders')}
          />
        ) : null;
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
        return <InventoryPage onBatchEdit={() => handleNavigate('batch-edit')} />;
      case 'batch-edit':
        return <BatchEditPage onBack={() => handleNavigate('inventory')} />;
      case 'customers':
        return <CustomersPage onViewCustomer={handleViewCustomer} />;
      case 'customer-detail':
        return selectedCustomerId ? (
          <CustomerDetailPage
            customerId={selectedCustomerId}
            onBack={() => handleNavigate('customers')}
            onViewOrder={handleViewOrder}
          />
        ) : null;
      case 'fulfillment':
        return <OrdersPage onViewOrder={handleViewOrder} />;
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
      case 'reports':
        return <ReportsPage />;
      case 'users-roles':
        return <AdminUsersPage />;
      case 'audit-log':
        return <AuditLogPage />;
      case 'dashboard':
      default:
        return (
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-4">Welcome to Admin Panel</h2>
            <p className="text-slate-400 mb-6">Select a section from the sidebar to get started.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="text-lg font-semibold mb-1">Orders</h3>
                <p className="text-slate-400 text-sm">Manage customer orders</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-3xl mb-2">🌱</div>
                <h3 className="text-lg font-semibold mb-1">Products</h3>
                <p className="text-slate-400 text-sm">Edit your product catalog</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-3xl mb-2">📋</div>
                <h3 className="text-lg font-semibold mb-1">Inventory</h3>
                <p className="text-slate-400 text-sm">Track stock levels</p>
              </div>
            </div>
          </div>
        );
    }
  };

  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard';

  return (
    <AdminProvider currentPage={currentPage} navigate={handleNavigate}>
      <div className="min-h-screen bg-slate-900 flex">
        {/* Sidebar */}
        <AdminSidebar currentPage={currentPage} onNavigate={handleNavigate} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 ml-[280px]">
          {/* Header */}
          <AdminHeader title={pageTitle} onLogout={handleLogout} />

          {/* Main content */}
          <main className="flex-1 p-6 overflow-auto">
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
};

export default AdminLayout;
