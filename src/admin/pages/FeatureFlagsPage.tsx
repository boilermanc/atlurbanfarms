import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import EmergencyToggle from '../components/EmergencyToggle';
import { useFeatureFlags, useToggleFeatureFlag, FeatureFlag } from '../hooks/useFeatureFlags';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  commerce: {
    label: 'Commerce',
    description: 'Shopping cart, checkout, and payment features',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  fulfillment: {
    label: 'Fulfillment',
    description: 'Order processing and shipping features',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  notifications: {
    label: 'Notifications',
    description: 'Email, SMS, and push notification features',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  general: {
    label: 'General',
    description: 'Core application features',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  experimental: {
    label: 'Experimental',
    description: 'Beta features under development',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
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
            <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
            <p className="text-slate-400 mt-1">Manage feature toggles and emergency controls</p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Emergency Controls Section */}
        <div className="bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 rounded-2xl border-2 border-red-500/30 overflow-hidden">
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Emergency Controls</h2>
                <p className="text-sm text-red-400">These controls immediately affect live operations</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {emergencyFlags.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-400">No emergency controls configured</p>
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
            <div className="mt-6 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Changes to emergency controls take effect immediately
                </p>
                <p className="text-xs text-amber-400/70 mt-1">
                  Disabling any of these controls will require a reason that will be logged in the audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Flags by Category */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Feature Flags</h2>

          {regularCategories.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-slate-400">No feature flags configured</p>
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
                      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
                    >
                      {/* Category Header */}
                      <div className="bg-slate-700/30 border-b border-slate-700 px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-300">
                            {config?.icon}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {config?.label || category}
                            </h3>
                            <p className="text-sm text-slate-400">{config?.description}</p>
                          </div>
                          <span className="ml-auto px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full">
                            {flags.length} {flags.length === 1 ? 'flag' : 'flags'}
                          </span>
                        </div>
                      </div>

                      {/* Flags List */}
                      <div className="divide-y divide-slate-700/50">
                        {flags.map((flag) => (
                          <div
                            key={flag.id}
                            className="px-6 py-4 hover:bg-slate-700/20 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-white">{flag.name}</h4>
                                  <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded font-mono">
                                    {flag.flag_key}
                                  </span>
                                </div>
                                {flag.description && (
                                  <p className="text-sm text-slate-400 mt-1">{flag.description}</p>
                                )}
                                <p className="text-xs text-slate-500 mt-2">
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
                                    flag.enabled ? 'bg-emerald-500' : 'bg-slate-600'
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
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About Feature Flags
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-400">
            <div>
              <h4 className="font-medium text-slate-300 mb-2">Categories</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li><span className="text-emerald-400">Commerce</span> - Shopping and checkout features</li>
                <li><span className="text-blue-400">Fulfillment</span> - Order processing features</li>
                <li><span className="text-purple-400">Notifications</span> - Messaging features</li>
                <li><span className="text-slate-300">General</span> - Core application features</li>
                <li><span className="text-amber-400">Experimental</span> - Beta features</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-300 mb-2">Usage</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Regular flags toggle immediately</li>
                <li>Emergency flags require confirmation</li>
                <li>All changes are logged in the audit trail</li>
                <li>Use <code className="px-1 py-0.5 bg-slate-700 rounded text-xs">flag_key</code> in code to check status</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default FeatureFlagsPage;
