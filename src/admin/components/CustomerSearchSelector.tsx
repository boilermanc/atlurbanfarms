import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, User, Mail, Phone, X } from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

interface CustomerWithStats extends Customer {
  order_count?: number;
  total_spent?: number;
}

interface CustomerSearchSelectorProps {
  onCustomerSelected: (customer: Customer) => void;
  selectedCustomer: Customer | null;
}

type Mode = 'search' | 'create';

const CustomerSearchSelector: React.FC<CustomerSearchSelectorProps> = ({
  onCustomerSelected,
  selectedCustomer,
}) => {
  const [mode, setMode] = useState<Mode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create new customer form state
  const [newCustomer, setNewCustomer] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [creating, setCreating] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (mode !== 'search') return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchCustomers();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, mode]);

  const searchCustomers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: customersData, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (searchError) throw searchError;

      // Fetch order stats for each customer
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

      setSearchResults(customersWithStats);
      setShowDropdown(customersWithStats.length > 0);
    } catch (err) {
      console.error('Error searching customers:', err);
      setError('Failed to search customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    onCustomerSelected(customer);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newCustomer.email || !newCustomer.first_name || !newCustomer.last_name) {
      setError('Email, first name, and last name are required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCustomer.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setCreating(true);

    try {
      // Check if customer with this email already exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', newCustomer.email.toLowerCase())
        .single();

      if (existing) {
        setError('A customer with this email already exists');
        setCreating(false);
        return;
      }

      // Create new customer
      const { data, error: createError } = await supabase
        .from('customers')
        .insert([
          {
            email: newCustomer.email.toLowerCase(),
            first_name: newCustomer.first_name,
            last_name: newCustomer.last_name,
            phone: newCustomer.phone || null,
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Select the newly created customer
      onCustomerSelected(data);

      // Reset form
      setNewCustomer({ email: '', first_name: '', last_name: '', phone: '' });
      setMode('search');
    } catch (err: any) {
      console.error('Error creating customer:', err);
      // Show the actual error message from Supabase for debugging
      const errorMessage = err?.message || err?.details || err?.hint || 'Unknown error';
      const errorCode = err?.code ? ` (${err.code})` : '';
      setError(`Failed to create customer: ${errorMessage}${errorCode}`);
    } finally {
      setCreating(false);
    }
  };

  const handleClearSelection = () => {
    onCustomerSelected(null as any);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {!selectedCustomer && (
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setMode('search')}
            className={`px-4 py-2 font-medium transition-colors ${
              mode === 'search'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Search Existing
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2 font-medium transition-colors ${
              mode === 'create'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create New
          </button>
        </div>
      )}

      {/* Selected Customer Display */}
      {selectedCustomer && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <User className="text-emerald-600" size={20} />
              </div>
              <div>
                <div className="font-medium text-slate-900">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </div>
                <div className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                  <Mail size={14} />
                  {selectedCustomer.email}
                </div>
                {selectedCustomer.phone && (
                  <div className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                    <Phone size={14} />
                    {selectedCustomer.phone}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleClearSelection}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Search Mode */}
      {!selectedCustomer && mode === 'search' && (
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="Search by email or name..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
              {searchResults.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <div className="font-medium text-slate-900">
                    {customer.first_name} {customer.last_name}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{customer.email}</div>
                  {customer.order_count !== undefined && (
                    <div className="text-xs text-slate-500 mt-1">
                      {customer.order_count} {customer.order_count === 1 ? 'order' : 'orders'}
                      {customer.total_spent !== undefined &&
                        ` • ${formatCurrency(customer.total_spent)} spent`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !loading && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-slate-500">
              No customers found. Try creating a new customer instead.
            </div>
          )}
        </div>
      )}

      {/* Create Mode */}
      {!selectedCustomer && mode === 'create' && (
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="customer@example.com"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCustomer.first_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                placeholder="John"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCustomer.last_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                placeholder="Doe"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="tel"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors"
          >
            {creating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={18} />
                Create Customer
              </>
            )}
          </button>
        </form>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default CustomerSearchSelector;
