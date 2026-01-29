// Admin Panel Components
export { default as AdminLayout } from './components/AdminLayout';
export { default as AdminHeader } from './components/AdminHeader';
export { default as AdminSidebar } from './components/AdminSidebar';
export { default as AdminPageWrapper } from './components/AdminPageWrapper';
export { AdminProvider, useAdminContext } from './context/AdminContext';
export { default as InventoryAdjustmentModal } from './components/InventoryAdjustmentModal';
export { default as LowStockAlert } from './components/LowStockAlert';
export { default as ZoneEditModal } from './components/ZoneEditModal';
export { default as RuleEditModal } from './components/RuleEditModal';
export { default as BlackoutDateModal } from './components/BlackoutDateModal';
export { default as OverrideDateModal } from './components/OverrideDateModal';
export { default as FAQEditModal } from './components/FAQEditModal';
export { default as ServiceEditModal } from './components/ServiceEditModal';

// Admin Pages
export { default as InventoryPage } from './pages/InventoryPage';
export { default as BatchEditPage } from './pages/BatchEditPage';
export { default as ShippingPage } from './pages/ShippingPage';
export { default as ShippingZonesPage } from './pages/ShippingZonesPage';
export { default as ShippingCalendarPage } from './pages/ShippingCalendarPage';
export { default as CustomersPage } from './pages/CustomersPage';
export { default as CustomerDetailPage } from './pages/CustomerDetailPage';
export { default as OrdersPage } from './pages/OrdersPage';
export { default as OrderDetailPage } from './pages/OrderDetailPage';
export { default as FAQPage } from './pages/FAQPage';
export { default as ContentPagesPage } from './pages/ContentPagesPage';
export { default as ContentEditPage } from './pages/ContentEditPage';
export { default as AttributionPage } from './pages/AttributionPage';
export { default as ShippingServicesPage } from './pages/ShippingServicesPage';
export { default as SettingsPage } from './pages/SettingsPage';
export { default as IntegrationsPage } from './pages/IntegrationsPage';
export { default as EmailTemplatesPage } from './pages/EmailTemplatesPage';
export { default as ProductsPage } from './pages/ProductsPage';
export { default as ProductEditPage } from './pages/ProductEditPage';
export { default as CategoriesPage } from './pages/CategoriesPage';
export { default as ReportsPage } from './pages/ReportsPage';
export { default as AuditLogPage } from './pages/AuditLogPage';
export { default as AdminUsersPage } from './pages/AdminUsersPage';
export { default as AlertsPage } from './pages/AlertsPage';

// Admin User Components
export { default as InviteAdminModal } from './components/InviteAdminModal';
export { default as EditAdminUserModal } from './components/EditAdminUserModal';
export { default as RolePermissionsModal } from './components/RolePermissionsModal';

// Admin Hooks
export { useAdminAuth } from './hooks/useAdminAuth';
export {
  useOrders,
  useOrder,
  useUpdateOrderStatus,
  useAddOrderNote,
  useCancelOrder,
  useOrderRefund,
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
} from './hooks/useOrders';
export {
  useSettings,
  useSetting,
  useUpdateSetting,
  useBulkUpdateSettings,
} from './hooks/useSettings';
export {
  useBackInStockAlerts,
  useProductsWithPendingAlerts,
  useNotifyBackInStock,
  useCancelAlert,
  useAlertStats,
} from './hooks/useAlerts';

// Admin Types
export * from './types/inventory';
export * from './types/customer';
export type {
  ShippingZone,
  ZoneConditions,
  ShippingZoneRule,
  RuleConditions,
  RuleActions
} from './components/shipping/ShippingZonesTab';
export type {
  Order,
  OrderItem,
  OrderStatusHistory,
  OrderRefund,
  OrderRefundItem,
  OrderFilters,
  OrdersResponse,
  OrderStatus
} from './hooks/useOrders';
export type { ShippingService } from './pages/ShippingServicesPage';
export type { ConfigSetting, SettingsMap } from './hooks/useSettings';
export type { AdminUser, AdminRole } from './pages/AdminUsersPage';
export { ALL_PERMISSIONS } from './pages/AdminUsersPage';
export type {
  BackInStockAlert,
  AlertsFilter,
  ProductWithAlerts,
} from './hooks/useAlerts';
