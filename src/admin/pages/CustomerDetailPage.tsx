import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, Tag, X, Plus, Edit2, Save, XCircle, MapPin } from 'lucide-react';
import {
  Customer,
  CustomerProfile,
  CustomerPreferences,
  CustomerAddress,
  CustomerOrder,
  CustomerAttribution,
  CustomerRole,
  TAG_COLOR_CONFIG,
  EXPERIENCE_LEVEL_CONFIG,
  ENVIRONMENT_OPTIONS,
  GROWING_SYSTEM_OPTIONS,
  INTEREST_OPTIONS,
} from '../types/customer';
import { useCustomerRole } from '../hooks/useCustomerRole';
import { useCustomerTagAssignments } from '../hooks/useCustomerTagAssignments';
import { useCustomerTags } from '../hooks/useCustomerTags';
import { ORDER_STATUS_CONFIG, ViewOrderHandler } from '../hooks/useOrders';

interface CustomerDetailPageProps {
  customerId: string;
  onBack?: () => void;
  onViewOrder?: ViewOrderHandler;
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

  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Edit mode states
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isEditingAddresses, setIsEditingAddresses] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isEditingAttribution, setIsEditingAttribution] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [editedCustomer, setEditedCustomer] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const [editedAddresses, setEditedAddresses] = useState<CustomerAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: '',
    first_name: '',
    last_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    is_default: false,
  });
  const [editedProfile, setEditedProfile] = useState<Partial<CustomerProfile>>({});
  const [editedPreferences, setEditedPreferences] = useState<Partial<CustomerPreferences>>({});
  const [editedAttribution, setEditedAttribution] = useState<Partial<CustomerAttribution>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const { updateRole, updating: updatingRole } = useCustomerRole();
  const { tags: assignedTags, assignTag, unassignTag } = useCustomerTagAssignments(customerId);
  const { tags: allTags } = useCustomerTags();

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

      // Fetch regular orders
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
            isLegacy: false,
          };
        })
      );

      // Fetch legacy orders for this customer
      let legacyOrdersList: CustomerOrder[] = [];
      try {
        const { data: legacyOrdersData } = await supabase
          .from('legacy_orders')
          .select('id, woo_order_id, status, total, order_date')
          .eq('customer_id', customerId)
          .order('order_date', { ascending: false });

        if (legacyOrdersData && legacyOrdersData.length > 0) {
          // Get item counts for legacy orders
          const legacyWithCounts = await Promise.all(
            legacyOrdersData.map(async (order) => {
              const { count } = await supabase
                .from('legacy_order_items')
                .select('*', { count: 'exact', head: true })
                .eq('legacy_order_id', order.id);

              return {
                id: order.id,
                order_number: `WC-${order.woo_order_id}`,
                status: order.status || 'completed',
                total: order.total || 0,
                item_count: count || 0,
                created_at: order.order_date,
                isLegacy: true,
              };
            })
          );
          legacyOrdersList = legacyWithCounts;
        }
      } catch (err) {
        // Silently ignore if legacy_orders table doesn't exist
        console.warn('Could not fetch legacy orders:', err);
      }

      // Merge and sort all orders by date
      const allOrders = [...ordersWithCounts, ...legacyOrdersList].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(allOrders);

      // Calculate totals including legacy orders
      const total = allOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      setTotalSpent(total);
      setAverageOrderValue(allOrders.length > 0 ? total / allOrders.length : 0);

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

  const startEditingCustomer = () => {
    if (customer) {
      setEditedCustomer({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email,
        phone: customer.phone || '',
      });
      setIsEditingCustomer(true);
      setValidationErrors({});
    }
  };

  const startEditingAddresses = () => {
    setEditedAddresses([...addresses]);
    setIsEditingAddresses(true);
    setValidationErrors({});
  };

  const cancelEditingCustomer = () => {
    setIsEditingCustomer(false);
    setValidationErrors({});
  };

  const cancelEditingAddresses = () => {
    setIsEditingAddresses(false);
    setValidationErrors({});
  };

  const startAddingAddress = () => {
    setNewAddress({
      label: '',
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      phone: customer?.phone || '',
      is_default: addresses.length === 0,
    });
    setIsAddingAddress(true);
    setValidationErrors({});
  };

  const cancelAddingAddress = () => {
    setIsAddingAddress(false);
    setValidationErrors({});
  };

  const validateNewAddressForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newAddress.first_name.trim()) {
      errors.new_address_first_name = 'First name is required';
    }
    if (!newAddress.last_name.trim()) {
      errors.new_address_last_name = 'Last name is required';
    }
    if (!newAddress.address_line1.trim()) {
      errors.new_address_address_line1 = 'Address is required';
    }
    if (!newAddress.city.trim()) {
      errors.new_address_city = 'City is required';
    }
    if (!newAddress.state.trim()) {
      errors.new_address_state = 'State is required';
    }
    if (!newAddress.zip.trim()) {
      errors.new_address_zip = 'Zip code is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveNewAddress = async () => {
    if (!validateNewAddressForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // If setting as default, unset other defaults first
      if (newAddress.is_default && addresses.length > 0) {
        const { error: unsetError } = await supabase
          .from('customer_addresses')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('customer_id', customerId)
          .eq('is_default', true);

        if (unsetError) throw unsetError;
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: customerId,
          label: newAddress.label || null,
          first_name: newAddress.first_name,
          last_name: newAddress.last_name,
          address_line1: newAddress.address_line1,
          address_line2: newAddress.address_line2 || null,
          city: newAddress.city,
          state: newAddress.state,
          zip: newAddress.zip,
          country: 'US',
          phone: newAddress.phone || null,
          is_default: newAddress.is_default,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      if (newAddress.is_default) {
        setAddresses([data, ...addresses.map(a => ({ ...a, is_default: false }))]);
      } else {
        setAddresses([...addresses, data]);
      }

      setIsAddingAddress(false);
      setValidationErrors({});
      setToast({ message: 'Address added successfully', type: 'success' });
    } catch (err) {
      console.error('Error adding address:', err);
      setToast({ message: 'Failed to add address', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingProfile = () => {
    setEditedProfile({
      growing_environment: profile?.growing_environment || null,
      experience_level: profile?.experience_level || null,
      growing_systems: profile?.growing_systems || [],
      growing_interests: profile?.growing_interests || [],
      usda_zone: profile?.usda_zone || '',
    });
    setIsEditingProfile(true);
    setValidationErrors({});
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setValidationErrors({});
  };

  const startEditingPreferences = () => {
    setEditedPreferences({
      email_notifications: preferences?.email_notifications ?? true,
      sms_notifications: preferences?.sms_notifications ?? false,
      newsletter_subscribed: preferences?.newsletter_subscribed ?? false,
    });
    setIsEditingPreferences(true);
    setValidationErrors({});
  };

  const cancelEditingPreferences = () => {
    setIsEditingPreferences(false);
    setValidationErrors({});
  };

  const startEditingAttribution = () => {
    setEditedAttribution({
      source: attribution?.source || '',
      medium: attribution?.medium || '',
      campaign: attribution?.campaign || '',
      referrer: attribution?.referrer || '',
      landing_page: attribution?.landing_page || '',
    });
    setIsEditingAttribution(true);
    setValidationErrors({});
  };

  const cancelEditingAttribution = () => {
    setIsEditingAttribution(false);
    setValidationErrors({});
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCustomerForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!editedCustomer.first_name.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!editedCustomer.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }

    if (!editedCustomer.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(editedCustomer.email)) {
      errors.email = 'Invalid email format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateAddressForm = (): boolean => {
    const errors: Record<string, string> = {};

    editedAddresses.forEach((address, index) => {
      if (!address.first_name.trim()) {
        errors[`address_${index}_first_name`] = 'First name is required';
      }
      if (!address.last_name.trim()) {
        errors[`address_${index}_last_name`] = 'Last name is required';
      }
      if (!address.address_line1.trim()) {
        errors[`address_${index}_address_line1`] = 'Address is required';
      }
      if (!address.city.trim()) {
        errors[`address_${index}_city`] = 'City is required';
      }
      if (!address.state.trim()) {
        errors[`address_${index}_state`] = 'State is required';
      }
      if (!address.zip.trim()) {
        errors[`address_${index}_zip`] = 'Zip code is required';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveCustomer = async () => {
    if (!validateCustomerForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          first_name: editedCustomer.first_name,
          last_name: editedCustomer.last_name,
          email: editedCustomer.email,
          phone: editedCustomer.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;

      setCustomer(data);
      setIsEditingCustomer(false);
      setValidationErrors({});
      setToast({ message: 'Customer information updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating customer:', err);
      setValidationErrors({ general: 'Failed to update customer information' });
      setToast({ message: 'Failed to update customer information', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAddresses = async () => {
    if (!validateAddressForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // Update each address
      for (const address of editedAddresses) {
        const { error } = await supabase
          .from('customer_addresses')
          .update({
            label: address.label || null,
            first_name: address.first_name,
            last_name: address.last_name,
            address_line1: address.address_line1,
            address_line2: address.address_line2 || null,
            city: address.city,
            state: address.state,
            zip: address.zip,
            phone: address.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', address.id);

        if (error) throw error;
      }

      setAddresses(editedAddresses);
      setIsEditingAddresses(false);
      setValidationErrors({});
      setToast({ message: 'Addresses updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating addresses:', err);
      setValidationErrors({ general: 'Failed to update addresses' });
      setToast({ message: 'Failed to update addresses', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const profileData = {
        growing_environment: editedProfile.growing_environment || null,
        experience_level: editedProfile.experience_level || null,
        growing_systems: editedProfile.growing_systems || [],
        growing_interests: editedProfile.growing_interests || [],
        usda_zone: editedProfile.usda_zone || null,
        updated_at: new Date().toISOString(),
      };

      if (profile?.id) {
        // Update existing profile
        const { data, error } = await supabase
          .from('customer_profiles')
          .update(profileData)
          .eq('id', profile.id)
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('customer_profiles')
          .insert({
            customer_id: customerId,
            ...profileData,
          })
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      }

      setIsEditingProfile(false);
      setValidationErrors({});
      setToast({ message: 'Growing profile updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating profile:', err);
      setValidationErrors({ general: 'Failed to update growing profile' });
      setToast({ message: 'Failed to update growing profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const preferencesData = {
        email_notifications: editedPreferences.email_notifications ?? true,
        sms_notifications: editedPreferences.sms_notifications ?? false,
        newsletter_subscribed: editedPreferences.newsletter_subscribed ?? false,
        updated_at: new Date().toISOString(),
      };

      if (preferences?.id) {
        // Update existing preferences
        const { data, error } = await supabase
          .from('customer_preferences')
          .update(preferencesData)
          .eq('id', preferences.id)
          .select()
          .single();

        if (error) throw error;
        setPreferences(data);
      } else {
        // Create new preferences
        const { data, error } = await supabase
          .from('customer_preferences')
          .insert({
            customer_id: customerId,
            ...preferencesData,
          })
          .select()
          .single();

        if (error) throw error;
        setPreferences(data);
      }

      setIsEditingPreferences(false);
      setValidationErrors({});
      setToast({ message: 'Preferences updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating preferences:', err);
      setValidationErrors({ general: 'Failed to update preferences' });
      setToast({ message: 'Failed to update preferences', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAttribution = async () => {
    setIsSaving(true);
    try {
      const attributionData = {
        source: editedAttribution.source || null,
        medium: editedAttribution.medium || null,
        campaign: editedAttribution.campaign || null,
        referrer: editedAttribution.referrer || null,
        landing_page: editedAttribution.landing_page || null,
      };

      if (attribution?.id) {
        // Update existing attribution
        const { data, error } = await supabase
          .from('customer_attribution')
          .update(attributionData)
          .eq('id', attribution.id)
          .select()
          .single();

        if (error) throw error;
        setAttribution(data);
      } else {
        // Create new attribution
        const { data, error } = await supabase
          .from('customer_attribution')
          .insert({
            customer_id: customerId,
            ...attributionData,
          })
          .select()
          .single();

        if (error) throw error;
        setAttribution(data);
      }

      setIsEditingAttribution(false);
      setValidationErrors({});
      setToast({ message: 'Attribution updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating attribution:', err);
      setValidationErrors({ general: 'Failed to update attribution' });
      setToast({ message: 'Failed to update attribution', type: 'error' });
    } finally {
      setIsSaving(false);
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
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'processing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'on_hold':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'pending_payment':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'refunded':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'failed':
        return 'bg-slate-200 text-slate-700 border-slate-300';
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

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-slide-down ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Contact Info</h2>
                {!isEditingCustomer && (
                  <button
                    onClick={startEditingCustomer}
                    className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
              </div>

              {validationErrors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {validationErrors.general}
                </div>
              )}

              {isEditingCustomer ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedCustomer.first_name}
                      onChange={(e) =>
                        setEditedCustomer({ ...editedCustomer, first_name: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        validationErrors.first_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                      }`}
                    />
                    {validationErrors.first_name && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.first_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedCustomer.last_name}
                      onChange={(e) =>
                        setEditedCustomer({ ...editedCustomer, last_name: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        validationErrors.last_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                      }`}
                    />
                    {validationErrors.last_name && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.last_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="email"
                        value={editedCustomer.email}
                        onChange={(e) =>
                          setEditedCustomer({ ...editedCustomer, email: e.target.value })
                        }
                        className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                          validationErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                        }`}
                      />
                      <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={customer?.newsletter_subscribed || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              const { error } = await supabase
                                .from('customers')
                                .update({ newsletter_subscribed: newValue, updated_at: new Date().toISOString() })
                                .eq('id', customerId);
                              if (!error) {
                                setCustomer(prev => prev ? { ...prev, newsletter_subscribed: newValue } : null);
                                setToast({ message: newValue ? 'Subscribed to newsletter' : 'Unsubscribed from newsletter', type: 'success' });
                              }
                            } catch (err) {
                              console.error('Error updating newsletter subscription:', err);
                              setToast({ message: 'Failed to update subscription', type: 'error' });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-emerald-600 transition-colors">Newsletter</span>
                      </label>
                    </div>
                    {validationErrors.email && (
                      <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Phone
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="tel"
                        value={editedCustomer.phone}
                        onChange={(e) =>
                          setEditedCustomer({ ...editedCustomer, phone: e.target.value })
                        }
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={customer?.sms_opt_in || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              const { error } = await supabase
                                .from('customers')
                                .update({ sms_opt_in: newValue, updated_at: new Date().toISOString() })
                                .eq('id', customerId);
                              if (!error) {
                                setCustomer(prev => prev ? { ...prev, sms_opt_in: newValue } : null);
                                setToast({ message: newValue ? 'SMS notifications enabled' : 'SMS notifications disabled', type: 'success' });
                              }
                            } catch (err) {
                              console.error('Error updating SMS opt-in:', err);
                              setToast({ message: 'Failed to update SMS preference', type: 'error' });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-emerald-600 transition-colors">SMS Updates</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveCustomer}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingCustomer}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">First Name</p>
                    <p className="text-slate-800">{customer.first_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Last Name</p>
                    <p className="text-slate-800">{customer.last_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</p>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-800">{customer.email}</p>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={customer?.newsletter_subscribed || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              const { error } = await supabase
                                .from('customers')
                                .update({ newsletter_subscribed: newValue, updated_at: new Date().toISOString() })
                                .eq('id', customerId);
                              if (!error) {
                                setCustomer(prev => prev ? { ...prev, newsletter_subscribed: newValue } : null);
                                setToast({ message: newValue ? 'Subscribed to newsletter' : 'Unsubscribed from newsletter', type: 'success' });
                              }
                            } catch (err) {
                              console.error('Error updating newsletter subscription:', err);
                              setToast({ message: 'Failed to update subscription', type: 'error' });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-emerald-600 transition-colors">Newsletter</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-800">{customer.phone || '-'}</p>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={customer?.sms_opt_in || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              const { error } = await supabase
                                .from('customers')
                                .update({ sms_opt_in: newValue, updated_at: new Date().toISOString() })
                                .eq('id', customerId);
                              if (!error) {
                                setCustomer(prev => prev ? { ...prev, sms_opt_in: newValue } : null);
                                setToast({ message: newValue ? 'SMS notifications enabled' : 'SMS notifications disabled', type: 'success' });
                              }
                            } catch (err) {
                              console.error('Error updating SMS opt-in:', err);
                              setToast({ message: 'Failed to update SMS preference', type: 'error' });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-emerald-600 transition-colors">SMS Updates</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Role & Tags Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Role & Tags</h2>

              <div className="space-y-4">
                {/* Role Dropdown */}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Role</p>
                  <select
                    value={customer?.role || 'customer'}
                    onChange={async (e) => {
                      const newRole = e.target.value as CustomerRole;
                      const result = await updateRole(customerId, newRole);
                      if (result.success) {
                        setCustomer(prev => prev ? { ...prev, role: newRole } : null);
                      }
                    }}
                    disabled={updatingRole}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50"
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Tags Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Tags</p>
                    <button
                      onClick={() => setShowTagDropdown(!showTagDropdown)}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 transition-colors"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  {/* Assigned Tags */}
                  {assignedTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {assignedTags.map(tag => (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${TAG_COLOR_CONFIG[tag.color].badgeClass}`}
                        >
                          {tag.name}
                          <button
                            onClick={() => unassignTag(tag.id)}
                            className="hover:opacity-70 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm mb-2">No tags assigned</p>
                  )}

                  {/* Tag Dropdown */}
                  {showTagDropdown && (
                    <div className="mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {allTags
                        .filter(tag => !assignedTags.find(at => at.id === tag.id))
                        .map(tag => (
                          <button
                            key={tag.id}
                            onClick={async () => {
                              await assignTag(tag.id);
                              setShowTagDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <span className={`w-3 h-3 rounded-full bg-${tag.color}-500`}></span>
                            <span className="text-slate-800 text-sm">{tag.name}</span>
                          </button>
                        ))}
                      {allTags.filter(tag => !assignedTags.find(at => at.id === tag.id)).length === 0 && (
                        <p className="text-slate-500 text-sm p-2">All tags assigned</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Growing Profile</h2>
                {!isEditingProfile && (
                  <button
                    onClick={startEditingProfile}
                    className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Environment
                    </label>
                    <select
                      value={editedProfile.growing_environment || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, growing_environment: e.target.value as any || null })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Select environment...</option>
                      {ENVIRONMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Experience Level
                    </label>
                    <select
                      value={editedProfile.experience_level || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, experience_level: e.target.value as any || null })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Select experience level...</option>
                      {Object.entries(EXPERIENCE_LEVEL_CONFIG).map(([value, config]) => (
                        <option key={value} value={value}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                      Growing Systems
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {GROWING_SYSTEM_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer transition-colors text-xs ${
                            editedProfile.growing_systems?.includes(opt.value)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={editedProfile.growing_systems?.includes(opt.value) || false}
                            onChange={(e) => {
                              const current = editedProfile.growing_systems || [];
                              if (e.target.checked) {
                                setEditedProfile({
                                  ...editedProfile,
                                  growing_systems: [...current, opt.value],
                                });
                              } else {
                                setEditedProfile({
                                  ...editedProfile,
                                  growing_systems: current.filter((s) => s !== opt.value),
                                });
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                      Interests
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {INTEREST_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer transition-colors text-xs ${
                            editedProfile.growing_interests?.includes(opt.value)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={editedProfile.growing_interests?.includes(opt.value) || false}
                            onChange={(e) => {
                              const current = editedProfile.growing_interests || [];
                              if (e.target.checked) {
                                setEditedProfile({
                                  ...editedProfile,
                                  growing_interests: [...current, opt.value],
                                });
                              } else {
                                setEditedProfile({
                                  ...editedProfile,
                                  growing_interests: current.filter((i) => i !== opt.value),
                                });
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      USDA Zone
                    </label>
                    <input
                      type="text"
                      value={editedProfile.usda_zone || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, usda_zone: e.target.value })
                      }
                      placeholder="e.g., 7b"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveProfile}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingProfile}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : profile ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Environment</p>
                    <p className="text-slate-800">{getEnvironmentLabel(profile.growing_environment)}</p>
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
                    <p className="text-slate-800">{getInterestLabels(profile.growing_interests)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">USDA Zone</p>
                    <p className="text-slate-800">{profile.usda_zone || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No profile data</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Preferences</h2>
                {!isEditingPreferences && (
                  <button
                    onClick={startEditingPreferences}
                    className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
              </div>

              {isEditingPreferences ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={editedPreferences.email_notifications ?? true}
                      onChange={(e) =>
                        setEditedPreferences({ ...editedPreferences, email_notifications: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-slate-800 font-medium group-hover:text-emerald-600 transition-colors">Email Notifications</span>
                      <p className="text-xs text-slate-400">Receive order updates and announcements via email</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={editedPreferences.sms_notifications ?? false}
                      onChange={(e) =>
                        setEditedPreferences({ ...editedPreferences, sms_notifications: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-slate-800 font-medium group-hover:text-emerald-600 transition-colors">SMS Notifications</span>
                      <p className="text-xs text-slate-400">Receive text messages for important updates</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={editedPreferences.newsletter_subscribed ?? false}
                      onChange={(e) =>
                        setEditedPreferences({ ...editedPreferences, newsletter_subscribed: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-slate-800 font-medium group-hover:text-emerald-600 transition-colors">Newsletter</span>
                      <p className="text-xs text-slate-400">Receive newsletters and promotional content</p>
                    </div>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={savePreferences}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingPreferences}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : preferences ? (
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Addresses</h2>
                {!isEditingAddresses && !isAddingAddress && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={startAddingAddress}
                      className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                    {addresses.length > 0 && (
                      <button
                        onClick={startEditingAddresses}
                        className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isAddingAddress ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-emerald-200">
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                        Label
                      </label>
                      <input
                        type="text"
                        value={newAddress.label}
                        onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                        placeholder="e.g., Home, Work, Office"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAddress.first_name}
                          onChange={(e) => setNewAddress({ ...newAddress, first_name: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors.new_address_first_name
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors.new_address_first_name && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors.new_address_first_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAddress.last_name}
                          onChange={(e) => setNewAddress({ ...newAddress, last_name: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors.new_address_last_name
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors.new_address_last_name && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors.new_address_last_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                        Address Line 1 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newAddress.address_line1}
                        onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                          validationErrors.new_address_address_line1
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-200'
                        }`}
                      />
                      {validationErrors.new_address_address_line1 && (
                        <p className="mt-1 text-xs text-red-600">
                          {validationErrors.new_address_address_line1}
                        </p>
                      )}
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={newAddress.address_line2}
                        onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors.new_address_city
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors.new_address_city && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors.new_address_city}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          State <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newAddress.state}
                          onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors.new_address_state
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors.new_address_state && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors.new_address_state}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                        Zip Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newAddress.zip}
                        onChange={(e) => setNewAddress({ ...newAddress, zip: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                          validationErrors.new_address_zip
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-200'
                        }`}
                      />
                      {validationErrors.new_address_zip && (
                        <p className="mt-1 text-xs text-red-600">
                          {validationErrors.new_address_zip}
                        </p>
                      )}
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAddress.is_default}
                          onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">Set as default address</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveNewAddress}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save Address'}
                    </button>
                    <button
                      onClick={cancelAddingAddress}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isEditingAddresses ? (
                <div className="space-y-4">
                  {editedAddresses.map((address, index) => (
                    <div
                      key={address.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        {address.is_default && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Label
                        </label>
                        <input
                          type="text"
                          value={address.label || ''}
                          onChange={(e) => {
                            const updated = [...editedAddresses];
                            updated[index].label = e.target.value || null;
                            setEditedAddresses(updated);
                          }}
                          placeholder="e.g., Home, Work, Office"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={address.first_name}
                            onChange={(e) => {
                              const updated = [...editedAddresses];
                              updated[index].first_name = e.target.value;
                              setEditedAddresses(updated);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                              validationErrors[`address_${index}_first_name`]
                                ? 'border-red-300 bg-red-50'
                                : 'border-slate-200'
                            }`}
                          />
                          {validationErrors[`address_${index}_first_name`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {validationErrors[`address_${index}_first_name`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={address.last_name}
                            onChange={(e) => {
                              const updated = [...editedAddresses];
                              updated[index].last_name = e.target.value;
                              setEditedAddresses(updated);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                              validationErrors[`address_${index}_last_name`]
                                ? 'border-red-300 bg-red-50'
                                : 'border-slate-200'
                            }`}
                          />
                          {validationErrors[`address_${index}_last_name`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {validationErrors[`address_${index}_last_name`]}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Address Line 1 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={address.address_line1}
                          onChange={(e) => {
                            const updated = [...editedAddresses];
                            updated[index].address_line1 = e.target.value;
                            setEditedAddresses(updated);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors[`address_${index}_address_line1`]
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors[`address_${index}_address_line1`] && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors[`address_${index}_address_line1`]}
                          </p>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={address.address_line2 || ''}
                          onChange={(e) => {
                            const updated = [...editedAddresses];
                            updated[index].address_line2 = e.target.value;
                            setEditedAddresses(updated);
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            City <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={address.city}
                            onChange={(e) => {
                              const updated = [...editedAddresses];
                              updated[index].city = e.target.value;
                              setEditedAddresses(updated);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                              validationErrors[`address_${index}_city`]
                                ? 'border-red-300 bg-red-50'
                                : 'border-slate-200'
                            }`}
                          />
                          {validationErrors[`address_${index}_city`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {validationErrors[`address_${index}_city`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            State <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={address.state}
                            onChange={(e) => {
                              const updated = [...editedAddresses];
                              updated[index].state = e.target.value;
                              setEditedAddresses(updated);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                              validationErrors[`address_${index}_state`]
                                ? 'border-red-300 bg-red-50'
                                : 'border-slate-200'
                            }`}
                          />
                          {validationErrors[`address_${index}_state`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {validationErrors[`address_${index}_state`]}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Zip Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={address.zip}
                          onChange={(e) => {
                            const updated = [...editedAddresses];
                            updated[index].zip = e.target.value;
                            setEditedAddresses(updated);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            validationErrors[`address_${index}_zip`]
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {validationErrors[`address_${index}_zip`] && (
                          <p className="mt-1 text-xs text-red-600">
                            {validationErrors[`address_${index}_zip`]}
                          </p>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={address.phone || ''}
                          onChange={(e) => {
                            const updated = [...editedAddresses];
                            updated[index].phone = e.target.value;
                            setEditedAddresses(updated);
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveAddresses}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save All'}
                    </button>
                    <button
                      onClick={cancelEditingAddresses}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {addresses.length > 0 ? (
                    <div className="space-y-4">
                      {addresses.map((address) => {
                        const fullAddress = [
                          address.address_line1,
                          address.address_line2,
                          `${address.city}, ${address.state} ${address.zip}`,
                        ].filter(Boolean).join(', ');
                        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

                        return (
                          <div
                            key={address.id}
                            className="p-4 bg-slate-50 rounded-xl border border-slate-100"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {address.label && (
                                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
                                    {address.label}
                                  </span>
                                )}
                                {address.is_default && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
                                    Default
                                  </span>
                                )}
                              </div>
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-medium transition-colors"
                              >
                                <MapPin size={12} />
                                View on Map
                              </a>
                            </div>
                            <p className="text-slate-800 font-medium">
                              {address.first_name} {address.last_name}
                            </p>
                            <p className="text-slate-600 text-sm">{address.address_line1}</p>
                            {address.address_line2 && (
                              <p className="text-slate-600 text-sm">{address.address_line2}</p>
                            )}
                            <p className="text-slate-600 text-sm">
                              {address.city}, {address.state} {address.zip}
                            </p>
                            {address.phone && (
                              <p className="text-slate-500 text-sm mt-1">{address.phone}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500">No saved addresses</p>
                  )}
                </>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Attribution</h2>
                {!isEditingAttribution && (
                  <button
                    onClick={startEditingAttribution}
                    className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
              </div>

              {isEditingAttribution ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Source
                    </label>
                    <select
                      value={editedAttribution.source || ''}
                      onChange={(e) =>
                        setEditedAttribution({ ...editedAttribution, source: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Select source...</option>
                      <option value="google">Google Search</option>
                      <option value="social">Social Media</option>
                      <option value="referral">Word of Mouth / Referral</option>
                      <option value="farmers_market">Farmer's Market</option>
                      <option value="event">Event / Workshop</option>
                      <option value="advertisement">Advertisement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Medium
                    </label>
                    <input
                      type="text"
                      value={editedAttribution.medium || ''}
                      onChange={(e) =>
                        setEditedAttribution({ ...editedAttribution, medium: e.target.value })
                      }
                      placeholder="e.g., organic, cpc, email"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Campaign
                    </label>
                    <input
                      type="text"
                      value={editedAttribution.campaign || ''}
                      onChange={(e) =>
                        setEditedAttribution({ ...editedAttribution, campaign: e.target.value })
                      }
                      placeholder="e.g., spring_sale_2026"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Referrer
                    </label>
                    <input
                      type="text"
                      value={editedAttribution.referrer || ''}
                      onChange={(e) =>
                        setEditedAttribution({ ...editedAttribution, referrer: e.target.value })
                      }
                      placeholder="e.g., https://example.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                      Landing Page
                    </label>
                    <input
                      type="text"
                      value={editedAttribution.landing_page || ''}
                      onChange={(e) =>
                        setEditedAttribution({ ...editedAttribution, landing_page: e.target.value })
                      }
                      placeholder="e.g., /products/microgreens"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveAttribution}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingAttribution}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : attribution ? (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-800 font-mono text-sm">{order.order_number}</span>
                          {order.isLegacy && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              Legacy
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${getOrderStatusBadge(order.status)}`}
                        >
                          {ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.label || order.status}
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
                          onClick={() => onViewOrder?.(order.id, {
                            fromCustomerId: customerId,
                            fromCustomerName: getCustomerName(),
                            isLegacy: order.isLegacy,
                          })}
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
