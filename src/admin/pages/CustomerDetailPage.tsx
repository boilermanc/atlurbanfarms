import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import {
  Customer,
  CustomerProfile,
  CustomerPreferences,
  CustomerAddress,
  CustomerOrder,
  CustomerAttribution,
  EXPERIENCE_LEVEL_CONFIG,
  ENVIRONMENT_OPTIONS,
  GROWING_SYSTEM_OPTIONS,
  INTEREST_OPTIONS,
} from '../types/customer';

interface CustomerDetailPageProps {
  customerId: string;
  onBack?: () => void;
  onViewOrder?: (orderId: string) => void;
}

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = ({
  customerId,
  onBack,
  onViewOrder,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [preferences, setPreferences] = useState<CustomerPreferences | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [attribution, setAttribution] = useState<CustomerAttribution | null>(null);

  // Stats
  const [totalSpent, setTotalSpent] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      setProfile(profileData);

      // Fetch preferences
      const { data: preferencesData } = await supabase
        .from('customer_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      setPreferences(preferencesData);

      // Fetch addresses
      const { data: addressesData } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false });

      setAddresses(addressesData || []);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Get item counts for each order
      const ordersWithCounts: CustomerOrder[] = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { count } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            item_count: count || 0,
          };
        })
      );

      setOrders(ordersWithCounts);

      // Calculate stats
      const total = ordersWithCounts.reduce((sum, order) => sum + (order.total || 0), 0);
      setTotalSpent(total);
      setAverageOrderValue(ordersWithCounts.length > 0 ? total / ordersWithCounts.length : 0);

      // Fetch attribution
      const { data: attributionData } = await supabase
        .from('customer_attribution')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      setAttribution(attributionData);
    } catch (err) {
      console.error('Error fetching customer data:', err);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCustomerName = () => {
    if (!customer) return '';
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
    return name || 'No Name';
  };

  const getEnvironmentLabel = (value: string | null) => {
    if (!value) return '-';
    const option = ENVIRONMENT_OPTIONS.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getSystemLabels = (systems: string[] | null) => {
    if (!systems || systems.length === 0) return '-';
    return systems
      .map((sys) => GROWING_SYSTEM_OPTIONS.find((opt) => opt.value === sys)?.label || sys)
      .join(', ');
  };

  const getInterestLabels = (interests: string[] | null) => {
    if (!interests || interests.length === 0) return '-';
    return interests
      .map((int) => INTEREST_OPTIONS.find((opt) => opt.value === int)?.label || int)
      .join(', ');
  };

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-emerald-500';
      case 'processing':
      case 'shipped':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  if (error || !customer) {
    return (
      <AdminPageWrapper>
        <div className="space-y-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Customers
          </button>
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error || 'Customer not found'}
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Customers
        </button>

        {/* Customer Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {(customer.first_name?.[0] || customer.email[0]).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{getCustomerName()}</h1>
            <p className="text-slate-400">{customer.email}</p>
            <p className="text-slate-500 text-sm">Customer since {formatDate(customer.created_at)}</p>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMN 1 */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Contact Info</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-white">{customer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Phone</p>
                  <p className="text-white">{customer.phone || '-'}</p>
                </div>
              </div>
            </div>

            {/* Growing Profile */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Growing Profile</h2>
              {profile ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Environment</p>
                    <p className="text-white">{getEnvironmentLabel(profile.environment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Experience</p>
                    {profile.experience_level ? (
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${
                          EXPERIENCE_LEVEL_CONFIG[profile.experience_level]?.color || 'bg-slate-500'
                        }`}
                      >
                        {EXPERIENCE_LEVEL_CONFIG[profile.experience_level]?.label || profile.experience_level}
                      </span>
                    ) : (
                      <p className="text-slate-400">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Growing Systems</p>
                    <p className="text-white">{getSystemLabels(profile.growing_systems)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Interests</p>
                    <p className="text-white">{getInterestLabels(profile.interests)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Hardiness Zone</p>
                    <p className="text-white">{profile.hardiness_zone || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No profile data</p>
              )}
            </div>

            {/* Preferences */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Preferences</h2>
              {preferences ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Email Notifications</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        preferences.email_notifications
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {preferences.email_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">SMS Notifications</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        preferences.sms_notifications
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {preferences.sms_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Newsletter</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        preferences.newsletter_subscribed
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {preferences.newsletter_subscribed ? 'Subscribed' : 'Not Subscribed'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No preferences set</p>
              )}
            </div>
          </div>

          {/* COLUMN 2 */}
          <div className="space-y-6">
            {/* Addresses */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Addresses</h2>
              {addresses.length > 0 ? (
                <div className="space-y-4">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="p-4 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-wider text-slate-400">
                          {address.type}
                        </span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-white">
                        {address.first_name} {address.last_name}
                      </p>
                      <p className="text-slate-300 text-sm">{address.address_line1}</p>
                      {address.address_line2 && (
                        <p className="text-slate-300 text-sm">{address.address_line2}</p>
                      )}
                      <p className="text-slate-300 text-sm">
                        {address.city}, {address.state} {address.postal_code}
                      </p>
                      <p className="text-slate-400 text-sm">{address.country}</p>
                      {address.phone && (
                        <p className="text-slate-400 text-sm mt-1">{address.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No saved addresses</p>
              )}
            </div>
          </div>

          {/* COLUMN 3 */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Stats</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{orders.length}</p>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Average Order Value</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(averageOrderValue)}</p>
                </div>
              </div>
            </div>

            {/* Attribution */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Attribution</h2>
              {attribution ? (
                <div className="space-y-3">
                  {attribution.source && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Source</p>
                      <p className="text-white">{attribution.source}</p>
                    </div>
                  )}
                  {attribution.medium && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Medium</p>
                      <p className="text-white">{attribution.medium}</p>
                    </div>
                  )}
                  {attribution.campaign && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Campaign</p>
                      <p className="text-white">{attribution.campaign}</p>
                    </div>
                  )}
                  {attribution.referrer && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Referrer</p>
                      <p className="text-white text-sm break-all">{attribution.referrer}</p>
                    </div>
                  )}
                  {attribution.landing_page && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Landing Page</p>
                      <p className="text-white text-sm break-all">{attribution.landing_page}</p>
                    </div>
                  )}
                  {!attribution.source && !attribution.medium && !attribution.campaign && !attribution.referrer && !attribution.landing_page && (
                    <p className="text-slate-400">No attribution data</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-400">How they found you: Unknown</p>
              )}
            </div>
          </div>
        </div>

        {/* Order History - Full Width */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Order History</h2>
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-white font-mono text-sm">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white capitalize ${getOrderStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {order.item_count}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onViewOrder?.(order.id)}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400">No orders yet</p>
          )}
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default CustomerDetailPage;
