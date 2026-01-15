import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import {
  CustomerWithStats,
  NewsletterSubscriber,
  SubscriberStatus,
  SUBSCRIBER_STATUS_CONFIG,
} from '../types/customer';

type TabType = 'customers' | 'newsletter';

interface CustomersPageProps {
  onViewCustomer?: (customerId: string) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ onViewCustomer }) => {
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Customers state
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerCount, setCustomerCount] = useState(0);

  // Newsletter state
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subscriberFilter, setSubscriberFilter] = useState<SubscriberStatus | 'all'>('all');
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Fetch customers with stats
  const fetchCustomers = async () => {
    try {
      // First get all customers
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (customerSearch) {
        query = query.or(`email.ilike.%${customerSearch}%,first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%`);
      }

      const { data: customersData, error: customersError } = await query;

      if (customersError) throw customersError;

      // Get order stats for each customer
      const customersWithStats: CustomerWithStats[] = await Promise.all(
        (customersData || []).map(async (customer) => {
          const { data: orderStats } = await supabase
            .from('orders')
            .select('id, total')
            .eq('customer_id', customer.id);

          const orders = orderStats || [];
          return {
            ...customer,
            order_count: orders.length,
            total_spent: orders.reduce((sum, order) => sum + (order.total || 0), 0),
          };
        })
      );

      setCustomers(customersWithStats);
      setCustomerCount(customersWithStats.length);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to load customers');
    }
  };

  // Fetch newsletter subscribers
  const fetchSubscribers = async () => {
    try {
      let query = supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (subscriberFilter !== 'all') {
        query = query.eq('status', subscriberFilter);
      }

      const { data, error: subError } = await query;

      if (subError) throw subError;

      setSubscribers(data || []);

      // Get total count
      const { count } = await supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true });

      setSubscriberCount(count || 0);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      setError('Failed to load newsletter subscribers');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      if (activeTab === 'customers') {
        await fetchCustomers();
      } else {
        await fetchSubscribers();
      }

      setLoading(false);
    };

    loadData();
  }, [activeTab, customerSearch, subscriberFilter]);

  const handleCustomerClick = (customerId: string) => {
    onViewCustomer?.(customerId);
  };

  const handleExportCSV = () => {
    const headers = ['Email', 'Name', 'Status', 'Source', 'Subscribed Date'];
    const rows = subscribers.map((sub) => [
      sub.email,
      [sub.first_name, sub.last_name].filter(Boolean).join(' ') || '-',
      sub.status,
      sub.source || '-',
      new Date(sub.subscribed_at).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const getCustomerName = (customer: CustomerWithStats) => {
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
    return name || 'No Name';
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'customers', label: 'All Customers' },
    { id: 'newsletter', label: 'Newsletter Subscribers' },
  ];

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Customers</h1>
            <p className="text-slate-400 text-sm mt-1">
              {activeTab === 'customers'
                ? `${customerCount} total customers`
                : `${subscriberCount} newsletter subscribers`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="customerActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* All Customers Tab */}
            {activeTab === 'customers' && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Search */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Customers Table */}
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Orders
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Total Spent
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                            {customerSearch ? 'No customers found matching your search' : 'No customers yet'}
                          </td>
                        </tr>
                      ) : (
                        customers.map((customer) => (
                          <tr
                            key={customer.id}
                            onClick={() => handleCustomerClick(customer.id)}
                            className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {(customer.first_name?.[0] || customer.email[0]).toUpperCase()}
                                </div>
                                <span className="text-white font-medium">{getCustomerName(customer)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{customer.email}</td>
                            <td className="px-6 py-4 text-slate-300">{customer.phone || '-'}</td>
                            <td className="px-6 py-4 text-right text-white">{customer.order_count}</td>
                            <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                              {formatCurrency(customer.total_spent)}
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-sm">
                              {formatDate(customer.created_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Newsletter Subscribers Tab */}
            {activeTab === 'newsletter' && (
              <motion.div
                key="newsletter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Filters */}
                <div className="flex items-center justify-between">
                  <select
                    value={subscriberFilter}
                    onChange={(e) => setSubscriberFilter(e.target.value as SubscriberStatus | 'all')}
                    className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(SUBSCRIBER_STATUS_CONFIG).map(([status, config]) => (
                      <option key={status} value={status}>
                        {config.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export CSV
                  </button>
                </div>

                {/* Subscribers Table */}
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Subscribed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {subscribers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            No subscribers found
                          </td>
                        </tr>
                      ) : (
                        subscribers.map((subscriber) => (
                          <tr key={subscriber.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 text-white">{subscriber.email}</td>
                            <td className="px-6 py-4 text-slate-300">
                              {[subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${
                                  SUBSCRIBER_STATUS_CONFIG[subscriber.status]?.color || 'bg-slate-500'
                                }`}
                              >
                                {SUBSCRIBER_STATUS_CONFIG[subscriber.status]?.label || subscriber.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{subscriber.source || '-'}</td>
                            <td className="px-6 py-4 text-slate-300 text-sm">
                              {formatDate(subscriber.subscribed_at)}
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
      </div>
    </AdminPageWrapper>
  );
};

export default CustomersPage;
