import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User } from 'lucide-react';
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

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [preferences, setPreferences] = useState<CustomerPreferences | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [attribution, setAttribution] = useState<CustomerAttribution | null>(null);

  const [totalSpent, setTotalSpent] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      const { data: profileData } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      setProfile(profileData);

      const { data: preferencesData } = await supabase
        .from('customer_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      setPreferences(preferencesData);

      const { data: addressesData } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false });

      setAddresses(addressesData || []);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

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

      const total = ordersWithCounts.reduce((sum, order) => sum + (order.total || 0), 0);
      setTotalSpent(total);
      setAverageOrderValue(ordersWithCounts.length > 0 ? total / ordersWithCounts.length : 0);

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

  const getOrderStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'processing':
      case 'shipped':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
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
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Customers
          </button>
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error || 'Customer not found'}
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Customers
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-2xl font-bold">
            {(customer.first_name?.[0] || customer.email[0]).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">{getCustomerName()}</h1>
            <p className="text-slate-500">{customer.email}</p>
            <p className="text-slate-400 text-sm">Customer since {formatDate(customer.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMN 1 */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Contact Info</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-slate-800">{customer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                  <p className="text-slate-800">{customer.phone || '-'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Growing Profile</h2>
              {profile ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Environment</p>
                    <p className="text-slate-800">{getEnvironmentLabel(profile.environment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Experience</p>
                    {profile.experience_level ? (
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                          EXPERIENCE_LEVEL_CONFIG[profile.experience_level]?.color || 'bg-slate-500'
                        }`}
                      >
                        {EXPERIENCE_LEVEL_CONFIG[profile.experience_level]?.label || profile.experience_level}
                      </span>
                    ) : (
                      <p className="text-slate-500">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Growing Systems</p>
                    <p className="text-slate-800">{getSystemLabels(profile.growing_systems)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Interests</p>
                    <p className="text-slate-800">{getInterestLabels(profile.interests)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Hardiness Zone</p>
                    <p className="text-slate-800">{profile.hardiness_zone || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No profile data</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Preferences</h2>
              {preferences ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Email Notifications</span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        preferences.email_notifications
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {preferences.email_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">SMS Notifications</span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        preferences.sms_notifications
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {preferences.sms_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Newsletter</span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        preferences.newsletter_subscribed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {preferences.newsletter_subscribed ? 'Subscribed' : 'Not Subscribed'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No preferences set</p>
              )}
            </div>
          </div>

          {/* COLUMN 2 */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Addresses</h2>
              {addresses.length > 0 ? (
                <div className="space-y-4">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-wider text-slate-500">
                          {address.type}
                        </span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 font-medium">
                        {address.first_name} {address.last_name}
                      </p>
                      <p className="text-slate-600 text-sm">{address.address_line1}</p>
                      {address.address_line2 && (
                        <p className="text-slate-600 text-sm">{address.address_line2}</p>
                      )}
                      <p className="text-slate-600 text-sm">
                        {address.city}, {address.state} {address.postal_code}
                      </p>
                      <p className="text-slate-500 text-sm">{address.country}</p>
                      {address.phone && (
                        <p className="text-slate-500 text-sm mt-1">{address.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No saved addresses</p>
              )}
            </div>
          </div>

          {/* COLUMN 3 */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Stats</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-800">{orders.length}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <p className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Average Order Value</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(averageOrderValue)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Attribution</h2>
              {attribution ? (
                <div className="space-y-3">
                  {attribution.source && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Source</p>
                      <p className="text-slate-800">{attribution.source}</p>
                    </div>
                  )}
                  {attribution.medium && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Medium</p>
                      <p className="text-slate-800">{attribution.medium}</p>
                    </div>
                  )}
                  {attribution.campaign && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Campaign</p>
                      <p className="text-slate-800">{attribution.campaign}</p>
                    </div>
                  )}
                  {attribution.referrer && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Referrer</p>
                      <p className="text-slate-800 text-sm break-all">{attribution.referrer}</p>
                    </div>
                  )}
                  {attribution.landing_page && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Landing Page</p>
                      <p className="text-slate-800 text-sm break-all">{attribution.landing_page}</p>
                    </div>
                  )}
                  {!attribution.source && !attribution.medium && !attribution.campaign && !attribution.referrer && !attribution.landing_page && (
                    <p className="text-slate-500">No attribution data</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">How they found you: Unknown</p>
              )}
            </div>
          </div>
        </div>

        {/* Order History - Full Width */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Order History</h2>
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-800 font-mono text-sm">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${getOrderStatusBadge(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {order.item_count}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onViewOrder?.(order.id)}
                          className="text-emerald-600 hover:text-emerald-700 transition-colors text-sm font-medium"
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
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-500">No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default CustomerDetailPage;
