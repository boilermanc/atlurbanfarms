import React from 'react';
import { motion } from 'framer-motion';
import { useCombinedOrders, useFavorites } from '../../hooks/useSupabase';
import { ORDER_STATUS_CONFIG, type OrderStatus } from '../../constants/orderStatus';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardHomeProps {
  userId: string;
  customerProfile: any;
  onNavigate: (view: string) => void;
  onTabChange: (tab: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const DashboardHome: React.FC<DashboardHomeProps> = ({ userId, customerProfile, onNavigate, onTabChange }) => {
  const { orders, loading: ordersLoading } = useCombinedOrders(userId);
  const { favorites } = useFavorites(userId);

  // ─── Derived values ─────────────────────────────────────────────────────

  const firstName = customerProfile?.first_name || '';
  const accountType = customerProfile?.account_type as string | undefined;
  const memberSince = customerProfile?.created_at
    ? new Date(customerProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // Profile completion
  const profileFields = [
    customerProfile?.growing_environment,
    customerProfile?.experience_level,
    (customerProfile?.growing_systems?.length || 0) > 0 ? true : null,
    (customerProfile?.growing_interests?.length || 0) > 0 ? true : null,
  ];
  const completedFields = profileFields.filter(Boolean).length;
  const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

  const recentOrders = (orders || []).slice(0, 3);

  // Account type display
  const getAccountBadge = () => {
    switch (accountType) {
      case 'school_partner': return { label: 'School Partner', perk: '15% discount on all orders' };
      case 'title1_partner': return { label: 'Title I Partner', perk: '20% discount on all orders' };
      case 'wholesale': return { label: 'Wholesale', perk: 'Wholesale pricing on all orders' };
      default: return null;
    }
  };
  const accountBadge = getAccountBadge();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-1">
          {firstName ? `Welcome back, ${firstName}!` : 'Welcome!'}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {memberSince && <span>Member since {memberSince}</span>}
          {accountBadge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {accountBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onTabChange('orders')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Orders</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {ordersLoading ? '—' : orders.length}
          </p>
        </button>

        <button
          onClick={() => onTabChange('favorites')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Favorites</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {favorites.length}
          </p>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Profile</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {profileCompletion}%
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Complete</p>
        </button>
      </div>

      {/* Preferred Grower Perks */}
      {accountBadge && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-heading font-bold text-emerald-900">{accountBadge.label}</h2>
            <p className="text-emerald-700 text-sm mt-0.5">{accountBadge.perk}</p>
            <p className="text-emerald-600/70 text-xs mt-1">Discount is automatically applied at checkout.</p>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {!ordersLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="font-heading font-bold text-gray-900">Recent Orders</h2>
            {orders.length > 0 && (
              <button
                onClick={() => onTabChange('orders')}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                View All
              </button>
            )}
          </div>
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order: any) => {
                const statusKey = order.status as OrderStatus;
                const statusConfig = ORDER_STATUS_CONFIG[statusKey];
                const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                });
                const trackingNumber = order.shipments?.[0]?.tracking_number;

                return (
                  <div key={order.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          #{order.order_number || order.id.slice(0, 8)}
                        </span>
                        {statusConfig && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{orderDate}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-heading font-bold text-gray-900 text-sm">
                        ${(order.total || 0).toFixed(2)}
                      </span>
                      {trackingNumber && (
                        <button
                          onClick={() => {
                            window.history.pushState({ view: 'tracking' }, '', `/tracking?number=${trackingNumber}`);
                            onNavigate('tracking');
                          }}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Track
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 pb-6 text-center">
              <p className="text-gray-400 text-sm mb-3">No orders yet</p>
              <button
                onClick={() => onNavigate('shop')}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Start Shopping
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profile Completion CTA */}
      {profileCompletion < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-lg">Complete Your Growing Profile</h2>
              <p className="text-emerald-100 text-sm mt-1">
                {!customerProfile?.growing_environment && 'Tell us about your growing environment. '}
                {!customerProfile?.experience_level && 'Set your experience level. '}
                {!(customerProfile?.growing_systems?.length > 0) && 'Select your growing systems. '}
                {!(customerProfile?.growing_interests?.length > 0) && 'Choose your growing interests. '}
                Help us personalize your experience!
              </p>
            </div>
            <button
              onClick={() => onTabChange('profile')}
              className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-50 transition-colors shrink-0"
            >
              Complete Profile
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardHome;
