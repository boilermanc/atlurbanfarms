import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { Search, Download, Users, Mail, Filter, Plus, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CustomerWithStats,
  NewsletterSubscriber,
  SubscriberStatus,
  SUBSCRIBER_STATUS_CONFIG,
  CustomerTag,
  TAG_COLOR_CONFIG,
  NEWSLETTER_SUBSCRIBER_BADGE,
} from '../types/customer';
import { useCustomerTags } from '../hooks/useCustomerTags';

type TabType = 'customers' | 'newsletter';
type SortField = 'last_name' | 'first_name' | 'email' | 'created_at' | 'phone';
type SortDirection = 'asc' | 'desc';

interface CustomersPageProps {
  onViewCustomer?: (customerId: string) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ onViewCustomer }) => {
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: update the query value 300ms after the user stops typing
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setCustomerSearch(searchInput);
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchInput]);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('last_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Reset to page 1 when filters/sort/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [customerSearch, selectedTagFilters, sortField, sortDirection, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subscriberFilter, setSubscriberFilter] = useState<SubscriberStatus | 'all'>('all');
  const [subscriberCount, setSubscriberCount] = useState(0);

  const { tags: allTags } = useCustomerTags();

  // Create Customer Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'customer',
    newsletter_subscribed: false,
    sms_opt_in: false,
  });

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'customer',
      newsletter_subscribed: false,
      sms_opt_in: false,
    });
    setCreateError(null);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Validation
    if (!formData.email.trim()) {
      setCreateError('Email is required');
      return;
    }
    if (!validateEmail(formData.email)) {
      setCreateError('Please enter a valid email address');
      return;
    }
    if (!formData.first_name.trim()) {
      setCreateError('First name is required');
      return;
    }
    if (!formData.last_name.trim()) {
      setCreateError('Last name is required');
      return;
    }

    setCreateLoading(true);

    try {
      // Check for duplicate email
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', formData.email.toLowerCase().trim())
        .single();

      if (existing) {
        setCreateError('A customer with this email already exists');
        setCreateLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('customers')
        .insert({
          id: crypto.randomUUID(),
          email: formData.email.toLowerCase().trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          newsletter_subscribed: formData.newsletter_subscribed,
          sms_opt_in: formData.sms_opt_in,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      // Refresh customers list
      await fetchCustomers();
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setCreateError(err.message || 'Failed to create customer');
    } finally {
      setCreateLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const offset = (currentPage - 1) * pageSize;

      // Step A: Server-side tag filtering (pre-query for matching customer IDs)
      let tagFilterIds: string[] | null = null;
      if (selectedTagFilters.length > 0) {
        const { data: tagMatches, error: tagError } = await supabase
          .from('customer_tag_assignments')
          .select('customer_id')
          .in('tag_id', selectedTagFilters);

        if (tagError) {
          console.error('Error fetching tag assignments:', tagError);
          throw tagError;
        }

        tagFilterIds = [...new Set((tagMatches || []).map((t: any) => t.customer_id))];

        if (tagFilterIds.length === 0) {
          setCustomers([]);
          setTotalCount(0);
          return;
        }
      }

      // Step B: Paginated customer query with count
      let query = supabase
        .from('customers')
        .select(`
          *,
          customer_tag_assignments!customer_id(
            tag:customer_tags(*)
          )
        `, { count: 'exact' })
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (customerSearch) {
        query = query.or(`email.ilike.%${customerSearch}%,first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`);
      }

      if (tagFilterIds !== null) {
        query = query.in('id', tagFilterIds);
      }

      query = query.range(offset, offset + pageSize - 1);

      let { data: customersData, error: customersError, count } = await query;

      // Fallback if tag join fails (e.g., tag tables don't exist)
      if (customersError) {
        console.error('Error fetching customers with tags, falling back to basic query:', customersError);

        let fallbackQuery = supabase
          .from('customers')
          .select('*', { count: 'exact' })
          .order(sortField, { ascending: sortDirection === 'asc' });

        if (customerSearch) {
          fallbackQuery = fallbackQuery.or(`email.ilike.%${customerSearch}%,first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`);
        }

        if (tagFilterIds !== null) {
          fallbackQuery = fallbackQuery.in('id', tagFilterIds);
        }

        fallbackQuery = fallbackQuery.range(offset, offset + pageSize - 1);

        const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery;

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw fallbackError;
        }

        customersData = (fallbackData || []).map((c: any) => ({ ...c, customer_tag_assignments: [] }));
        count = fallbackCount;
      }

      setTotalCount(count || 0);

      // Step C: Batch order stats for current page (fixes N+1)
      const pageCustomerIds = (customersData || []).map((c: any) => c.id);
      const orderStatsMap: Record<string, { order_count: number; total_spent: number }> = {};

      if (pageCustomerIds.length > 0) {
        // Override Supabase default 1000-row limit for order stats aggregation
        const { data: orderData } = await supabase
          .from('orders')
          .select('customer_id, total')
          .in('customer_id', pageCustomerIds)
          .limit(10000);

        for (const order of (orderData || [])) {
          if (!orderStatsMap[order.customer_id]) {
            orderStatsMap[order.customer_id] = { order_count: 0, total_spent: 0 };
          }
          orderStatsMap[order.customer_id].order_count += 1;
          orderStatsMap[order.customer_id].total_spent += (order.total || 0);
        }
      }

      const customersWithStats: CustomerWithStats[] = (customersData || []).map((customer: any) => {
        const stats = orderStatsMap[customer.id] || { order_count: 0, total_spent: 0 };
        return {
          ...customer,
          order_count: stats.order_count,
          total_spent: stats.total_spent,
          tags: customer.customer_tag_assignments?.map((a: any) => a.tag).filter(Boolean) || [],
        };
      });

      setCustomers(customersWithStats);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      const errorMessage = err?.message || err?.code || 'Unknown error';
      setError(`Failed to load customers: ${errorMessage}`);
    }
  };

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

      const { count } = await supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true });

      setSubscriberCount(count || 0);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      setError('Failed to load newsletter subscribers');
    }
  };

  const initialLoadRef = useRef(true);

  useEffect(() => {
    const loadData = async () => {
      // Only show full-page spinner on initial load, not on search/filter changes
      if (initialLoadRef.current) {
        setLoading(true);
      }
      setError(null);

      if (activeTab === 'customers') {
        await fetchCustomers();
      } else {
        await fetchSubscribers();
      }

      setLoading(false);
      initialLoadRef.current = false;
    };

    loadData();
  }, [activeTab, customerSearch, subscriberFilter, selectedTagFilters, sortField, sortDirection, currentPage, pageSize]);

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-slate-300">↕</span>;
    }
    return sortDirection === 'asc'
      ? <ChevronUp size={14} className="ml-1 inline" />
      : <ChevronDown size={14} className="ml-1 inline" />;
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Customers</h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === 'customers'
                ? `${totalCount.toLocaleString()} total customers`
                : `${subscriberCount} newsletter subscribers`}
            </p>
          </div>
          {activeTab === 'customers' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Add Customer
            </button>
          )}
        </div>

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
                    layoutId="customerActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'customers' && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Sort Dropdown */}
                  <select
                    value={`${sortField}-${sortDirection}`}
                    onChange={(e) => {
                      const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
                      setSortField(field);
                      setSortDirection(direction);
                    }}
                    className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="last_name-asc">Last Name (A-Z)</option>
                    <option value="last_name-desc">Last Name (Z-A)</option>
                    <option value="first_name-asc">First Name (A-Z)</option>
                    <option value="first_name-desc">First Name (Z-A)</option>
                    <option value="email-asc">Email (A-Z)</option>
                    <option value="email-desc">Email (Z-A)</option>
                    <option value="created_at-desc">Joined (Newest)</option>
                    <option value="created_at-asc">Joined (Oldest)</option>
                    <option value="phone-asc">Phone (A-Z)</option>
                    <option value="phone-desc">Phone (Z-A)</option>
                  </select>

                  {/* Tag Filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select
                      value=""
                      onChange={(e) => {
                        const tagId = e.target.value;
                        if (tagId && !selectedTagFilters.includes(tagId)) {
                          setSelectedTagFilters([...selectedTagFilters, tagId]);
                        }
                      }}
                      className="pl-10 pr-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Filter by tag...</option>
                      {allTags
                        .filter(tag => !selectedTagFilters.includes(tag.id))
                        .map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Active Tag Filters */}
                  {selectedTagFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedTagFilters.map(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${TAG_COLOR_CONFIG[tag.color].badgeClass}`}
                          >
                            {tag.name}
                            <button
                              onClick={() => setSelectedTagFilters(selectedTagFilters.filter(id => id !== tagId))}
                              className="hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs">×</span>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Page Size Selector */}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>

                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by name, email, or phone..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('last_name')}
                        >
                          Name
                          <SortIndicator field="last_name" />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</th>
                        <th
                          className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('email')}
                        >
                          Email
                          <SortIndicator field="email" />
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('phone')}
                        >
                          Phone
                          <SortIndicator field="phone" />
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Spent</th>
                        <th
                          className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('created_at')}
                        >
                          Joined
                          <SortIndicator field="created_at" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Users size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500">
                              {customerSearch ? 'No customers found matching your search' : 'No customers yet'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        customers.map((customer) => {
                          const customerTags = (customer as any).tags || [];

                          return (
                            <tr
                              key={customer.id}
                              onClick={() => handleCustomerClick(customer.id)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-sm font-medium">
                                    {(customer.first_name?.[0] || customer.email[0]).toUpperCase()}
                                  </div>
                                  <span className="text-slate-800 font-medium">{getCustomerName(customer)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {/* Newsletter Subscriber Badge */}
                                  {customer.newsletter_subscribed && (
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${NEWSLETTER_SUBSCRIBER_BADGE.badgeClass}`}
                                    >
                                      {NEWSLETTER_SUBSCRIBER_BADGE.label}
                                    </span>
                                  )}
                                  {customerTags.length > 0 ? (
                                    <>
                                      {customerTags.slice(0, 2).map((tag: CustomerTag) => (
                                        <span
                                          key={tag.id}
                                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${TAG_COLOR_CONFIG[tag.color].badgeClass}`}
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                      {customerTags.length > 2 && (
                                        <span className="text-slate-400 text-xs">+{customerTags.length - 2}</span>
                                      )}
                                    </>
                                  ) : !customer.newsletter_subscribed ? (
                                    <span className="text-slate-400 text-xs">-</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600">{customer.email}</td>
                              <td className="px-6 py-4 text-slate-600">{customer.phone || '-'}</td>
                              <td className="px-6 py-4 text-right text-slate-800 font-semibold">{customer.order_count}</td>
                              <td className="px-6 py-4 text-right text-emerald-600 font-semibold">
                                {formatCurrency(customer.total_spent)}
                              </td>
                              <td className="px-6 py-4 text-slate-500 text-sm">
                                {formatDate(customer.created_at)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500">
                        Showing {((currentPage - 1) * pageSize + 1).toLocaleString()} to{' '}
                        {Math.min(currentPage * pageSize, totalCount).toLocaleString()} of{' '}
                        {totalCount.toLocaleString()} customers
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={16} />
                          Previous
                        </button>
                        <span className="text-sm text-slate-500">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'newsletter' && (
              <motion.div
                key="newsletter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <select
                    value={subscriberFilter}
                    onChange={(e) => setSubscriberFilter(e.target.value as SubscriberStatus | 'all')}
                    className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(SUBSCRIBER_STATUS_CONFIG).map(([status, config]) => (
                      <option key={status} value={status}>{config.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                  >
                    <Download size={18} />
                    Export CSV
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscribed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subscribers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Mail size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500">No subscribers found</p>
                          </td>
                        </tr>
                      ) : (
                        subscribers.map((subscriber) => (
                          <tr key={subscriber.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-800">{subscriber.email}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {[subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                                  SUBSCRIBER_STATUS_CONFIG[subscriber.status]?.color || 'bg-slate-500'
                                }`}
                              >
                                {SUBSCRIBER_STATUS_CONFIG[subscriber.status]?.label || subscriber.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{subscriber.source || '-'}</td>
                            <td className="px-6 py-4 text-slate-500 text-sm">
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

        {/* Create Customer Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800">Add Customer</h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                  {createError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      {createError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="customer@example.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.newsletter_subscribed}
                        onChange={(e) => setFormData({ ...formData, newsletter_subscribed: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <span className="text-sm text-slate-700">Newsletter Subscriber</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sms_opt_in}
                        onChange={(e) => setFormData({ ...formData, sms_opt_in: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <span className="text-sm text-slate-700">SMS Opt-in</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createLoading ? 'Creating...' : 'Create Customer'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  );
};

export default CustomersPage;
