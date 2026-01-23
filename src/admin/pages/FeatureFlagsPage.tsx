import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import EmergencyToggle from '../components/EmergencyToggle';
import { useFeatureFlags, useToggleFeatureFlag, FeatureFlag } from '../hooks/useFeatureFlags';
import { ShoppingCart, Truck, Bell, Settings, Beaker, AlertTriangle, RefreshCw, CheckCircle, Package } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  commerce: {
    label: 'Commerce',
    description: 'Shopping cart, checkout, and payment features',
    icon: <ShoppingCart size={20} />,
  },
  fulfillment: {
    label: 'Fulfillment',
    description: 'Order processing and shipping features',
    icon: <Truck size={20} />,
  },
  notifications: {
    label: 'Notifications',
    description: 'Email, SMS, and push notification features',
    icon: <Bell size={20} />,
  },
  general: {
    label: 'General',
    description: 'Core application features',
    icon: <Settings size={20} />,
  },
  experimental: {
    label: 'Experimental',
    description: 'Beta features under development',
    icon: <Beaker size={20} />,
  },
};

const CATEGORY_ORDER = ['commerce', 'fulfillment', 'notifications', 'general', 'experimental'];

const FeatureFlagsPage: React.FC = () => {
  const { flagsByCategory, loading, error, refetch } = useFeatureFlags();
  const { toggleFlag, loading: toggling } = useToggleFeatureFlag();

  const emergencyFlags = flagsByCategory['emergency'] || [];
  const regularCategories = CATEGORY_ORDER.filter(
    (cat) => flagsByCategory[cat] && flagsByCategory[cat].length > 0
  );

  const handleEmergencyToggle = useCallback(
    async (flag: FeatureFlag, enabled: boolean, reason?: string) => {
      const success = await toggleFlag(flag.id, enabled, reason);
      if (success) {
        refetch();
      }
      return success;
    },
    [toggleFlag, refetch]
  );

  const handleRegularToggle = useCallback(
    async (flag: FeatureFlag) => {
      const success = await toggleFlag(flag.id, !flag.enabled);
      if (success) {
        refetch();
      }
    },
    [toggleFlag, refetch]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Feature Flags</h1>
            <p className="text-slate-500 text-sm mt-1">Manage feature toggles and emergency controls</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Emergency Controls Section */}
        <div className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-red-200 overflow-hidden">
          <div className="bg-red-100/50 border-b border-red-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Emergency Controls</h2>
                <p className="text-sm text-red-600">These controls immediately affect live operations</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {emergencyFlags.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-slate-400" />
                </div>
                <p className="text-slate-600">No emergency controls configured</p>
                <p className="text-sm text-slate-500 mt-1">
                  Add emergency flags to the feature_flags table with is_emergency = true
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {emergencyFlags.map((flag) => (
                  <EmergencyToggle
                    key={flag.id}
                    name={flag.name}
                    description={flag.description || undefined}
                    enabled={flag.enabled}
                    lastUpdated={flag.updated_at}
                    loading={toggling}
                    onToggle={(enabled, reason) => handleEmergencyToggle(flag, enabled, reason)}
                  />
                ))}
              </div>
            )}

            {/* Warning banner */}
            <div className="mt-6 flex items-start gap-3 p-4 bg-amber-100 border border-amber-200 rounded-xl">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Changes to emergency controls take effect immediately
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Disabling any of these controls will require a reason that will be logged in the audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Flags by Category */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Feature Flags</h2>

          {regularCategories.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-600">No feature flags configured</p>
              <p className="text-sm text-slate-500 mt-1">
                Feature flags will appear here once added to the database
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {regularCategories.map((category) => {
                  const config = CATEGORY_CONFIG[category];
                  const flags = flagsByCategory[category] || [];

                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden"
                    >
                      {/* Category Header */}
                      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-600 border border-slate-200">
                            {config?.icon}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                              {config?.label || category}
                            </h3>
                            <p className="text-sm text-slate-500">{config?.description}</p>
                          </div>
                          <span className="ml-auto px-3 py-1 bg-white border border-slate-200 text-slate-600 text-sm rounded-full">
                            {flags.length} {flags.length === 1 ? 'flag' : 'flags'}
                          </span>
                        </div>
                      </div>

                      {/* Flags List */}
                      <div className="divide-y divide-slate-100">
                        {flags.map((flag) => (
                          <div
                            key={flag.id}
                            className="px-6 py-4 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-slate-800">{flag.name}</h4>
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded font-mono">
                                    {flag.flag_key}
                                  </span>
                                </div>
                                {flag.description && (
                                  <p className="text-sm text-slate-500 mt-1">{flag.description}</p>
                                )}
                                <p className="text-xs text-slate-400 mt-2">
                                  Updated: {formatDate(flag.updated_at)}
                                </p>
                              </div>

                              {/* Toggle Switch */}
                              <button
                                onClick={() => handleRegularToggle(flag)}
                                disabled={toggling}
                                className="relative"
                              >
                                <div
                                  className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                                    flag.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                                  } ${toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <motion.div
                                    className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow"
                                    animate={{ left: flag.enabled ? '30px' : '2px' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  />
                                </div>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-slate-500" />
            About Feature Flags
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Categories</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li><span className="text-emerald-600 font-medium">Commerce</span> - Shopping and checkout features</li>
                <li><span className="text-blue-600 font-medium">Fulfillment</span> - Order processing features</li>
                <li><span className="text-purple-600 font-medium">Notifications</span> - Messaging features</li>
                <li><span className="text-slate-700 font-medium">General</span> - Core application features</li>
                <li><span className="text-amber-600 font-medium">Experimental</span> - Beta features</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-2">Usage</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Regular flags toggle immediately</li>
                <li>Emergency flags require confirmation</li>
                <li>All changes are logged in the audit trail</li>
                <li>Use <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs">flag_key</code> in code to check status</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default FeatureFlagsPage;
