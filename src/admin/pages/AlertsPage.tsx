import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import {
  Bell,
  Package,
  Mail,
  Search,
  Filter,
  Send,
  X,
  Check,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  useBackInStockAlerts,
  useProductsWithPendingAlerts,
  useNotifyBackInStock,
  useCancelAlert,
  useAlertStats,
  AlertsFilter,
  BackInStockAlert,
  ProductWithAlerts,
} from '../hooks/useAlerts';

type TabType = 'subscribers' | 'products';

const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('subscribers');
  const [filters, setFilters] = useState<AlertsFilter>({ status: 'pending' });
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmNotify, setConfirmNotify] = useState<ProductWithAlerts | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<BackInStockAlert | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useBackInStockAlerts({
    ...filters,
    search: searchTerm,
  });
  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useProductsWithPendingAlerts();
  const { stats, loading: statsLoading, refetch: refetchStats } = useAlertStats();
  const { notifySubscribers, notifying } = useNotifyBackInStock();
  const { cancelAlert, cancelling } = useCancelAlert();

  const handleNotifySubscribers = useCallback(async () => {
    if (!confirmNotify) return;

    const result = await notifySubscribers(confirmNotify.product_id);
    if (result.success) {
      setSuccessMessage(`Successfully marked ${result.count} subscriber${result.count !== 1 ? 's' : ''} as notified for "${confirmNotify.product_name}"`);
      setConfirmNotify(null);
      refetchAlerts();
      refetchProducts();
      refetchStats();
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [confirmNotify, notifySubscribers, refetchAlerts, refetchProducts, refetchStats]);

  const handleCancelAlert = useCallback(async () => {
    if (!confirmCancel) return;

    const result = await cancelAlert(confirmCancel.id);
    if (result.success) {
      setSuccessMessage('Alert cancelled successfully');
      setConfirmCancel(null);
      refetchAlerts();
      refetchProducts();
      refetchStats();
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [confirmCancel, cancelAlert, refetchAlerts, refetchProducts, refetchStats]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'notified':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} />;
      case 'notified':
        return <CheckCircle size={14} />;
      case 'cancelled':
        return <X size={14} />;
      default:
        return null;
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'subscribers', label: 'All Subscribers' },
    { id: 'products', label: 'Products with Alerts' },
  ];

  const loading = activeTab === 'subscribers' ? alertsLoading : productsLoading;
  const error = activeTab === 'subscribers' ? alertsError : productsError;

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Alerts</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage back-in-stock notification subscribers
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {!statsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Pending Alerts</p>
                  <p className="text-2xl font-bold text-slate-800 font-admin-display">{stats.pending}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Notified (30 days)</p>
                  <p className="text-2xl font-bold text-slate-800 font-admin-display">{stats.notified}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <Package size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Products with Alerts</p>
                  <p className="text-2xl font-bold text-slate-800 font-admin-display">{stats.productsWithAlerts}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 flex items-center gap-3"
            >
              <Check size={20} />
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="alertsActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-3">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'subscribers' && (
              <motion.div
                key="subscribers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Filters */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select
                      value={filters.status || 'all'}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value as AlertsFilter['status'] })}
                      className="pl-10 pr-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="notified">Notified</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by email, product, or customer name..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition-all"
                    />
                  </div>
                </div>

                {/* Subscribers Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscribed</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alerts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Bell size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500">
                              {searchTerm || filters.status !== 'pending'
                                ? 'No alerts found matching your filters'
                                : 'No pending back-in-stock alerts'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        alerts.map((alert) => {
                          const customerName = [alert.customer_first_name, alert.customer_last_name]
                            .filter(Boolean)
                            .join(' ');

                          return (
                            <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-medium">
                                    <Mail size={16} />
                                  </div>
                                  <span className="text-slate-800">{alert.email}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {customerName || <span className="text-slate-400">Guest</span>}
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-slate-800 font-medium">{alert.product_name}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(alert.status)}`}
                                >
                                  {getStatusIcon(alert.status)}
                                  {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500 text-sm">
                                {formatDate(alert.created_at)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {alert.status === 'pending' && (
                                  <button
                                    onClick={() => setConfirmCancel(alert)}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                                {alert.status === 'notified' && alert.notified_at && (
                                  <span className="text-xs text-slate-500">
                                    Notified {formatDate(alert.notified_at)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'products' && (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Stock</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting Subscribers</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Package size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500">No products with pending alerts</p>
                          </td>
                        </tr>
                      ) : (
                        products.map((product) => (
                          <tr key={product.product_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
                                  <Package size={20} />
                                </div>
                                <p className="text-slate-800 font-medium">{product.product_name}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  product.product_quantity > 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {product.product_quantity > 0 ? (
                                  <>
                                    <Check size={12} />
                                    {product.product_quantity} in stock
                                  </>
                                ) : (
                                  <>
                                    <X size={12} />
                                    Out of stock
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                <Mail size={12} />
                                {product.alert_count} subscriber{product.alert_count !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {product.product_quantity > 0 && (
                                <button
                                  onClick={() => setConfirmNotify(product)}
                                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ml-auto"
                                >
                                  <Send size={16} />
                                  Notify Subscribers
                                </button>
                              )}
                              {product.product_quantity === 0 && (
                                <span className="text-xs text-slate-500">
                                  Restock to notify
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Confirm Notify Modal */}
        <AnimatePresence>
          {confirmNotify && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setConfirmNotify(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800">Notify Subscribers</h2>
                  <button
                    onClick={() => setConfirmNotify(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <Send size={24} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{confirmNotify.product_name}</p>
                      <p className="text-sm text-slate-500">
                        {confirmNotify.alert_count} subscriber{confirmNotify.alert_count !== 1 ? 's' : ''} waiting
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-600 mb-6">
                    This will mark all pending alerts for this product as "notified". You should send the actual
                    notification emails separately (e.g., via your email service).
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmNotify(null)}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNotifySubscribers}
                      disabled={notifying}
                      className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {notifying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Mark as Notified
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Cancel Modal */}
        <AnimatePresence>
          {confirmCancel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setConfirmCancel(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800">Cancel Alert</h2>
                  <button
                    onClick={() => setConfirmCancel(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="p-6">
                  <p className="text-slate-600 mb-6">
                    Are you sure you want to cancel this alert subscription? The subscriber ({confirmCancel.email})
                    will not be notified when <strong>{confirmCancel.product_name}</strong> is back in stock.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmCancel(null)}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      Keep Alert
                    </button>
                    <button
                      onClick={handleCancelAlert}
                      disabled={cancelling}
                      className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {cancelling ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Alert'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  );
};

export default AlertsPage;
