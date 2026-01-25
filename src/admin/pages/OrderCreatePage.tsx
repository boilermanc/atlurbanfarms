import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import CustomerSearchSelector from '../components/CustomerSearchSelector';
import ProductLineItems, { OrderLineItem } from '../components/ProductLineItems';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, Package, MapPin, CreditCard } from 'lucide-react';
import {
  usePickupLocations,
  useAvailablePickupSlots,
  formatPickupDate,
  formatPickupTime,
  groupSlotsByDate,
  PickupLocation,
  PickupSlot,
} from '../../hooks/usePickup';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

interface OrderCreatePageProps {
  onNavigate: (page: string) => void;
}

const US_STATES = [
  { name: 'Alabama', abbreviation: 'AL' },
  { name: 'Alaska', abbreviation: 'AK' },
  { name: 'Arizona', abbreviation: 'AZ' },
  { name: 'Arkansas', abbreviation: 'AR' },
  { name: 'California', abbreviation: 'CA' },
  { name: 'Colorado', abbreviation: 'CO' },
  { name: 'Connecticut', abbreviation: 'CT' },
  { name: 'Delaware', abbreviation: 'DE' },
  { name: 'Florida', abbreviation: 'FL' },
  { name: 'Georgia', abbreviation: 'GA' },
  { name: 'Hawaii', abbreviation: 'HI' },
  { name: 'Idaho', abbreviation: 'ID' },
  { name: 'Illinois', abbreviation: 'IL' },
  { name: 'Indiana', abbreviation: 'IN' },
  { name: 'Iowa', abbreviation: 'IA' },
  { name: 'Kansas', abbreviation: 'KS' },
  { name: 'Kentucky', abbreviation: 'KY' },
  { name: 'Louisiana', abbreviation: 'LA' },
  { name: 'Maine', abbreviation: 'ME' },
  { name: 'Maryland', abbreviation: 'MD' },
  { name: 'Massachusetts', abbreviation: 'MA' },
  { name: 'Michigan', abbreviation: 'MI' },
  { name: 'Minnesota', abbreviation: 'MN' },
  { name: 'Mississippi', abbreviation: 'MS' },
  { name: 'Missouri', abbreviation: 'MO' },
  { name: 'Montana', abbreviation: 'MT' },
  { name: 'Nebraska', abbreviation: 'NE' },
  { name: 'Nevada', abbreviation: 'NV' },
  { name: 'New Hampshire', abbreviation: 'NH' },
  { name: 'New Jersey', abbreviation: 'NJ' },
  { name: 'New Mexico', abbreviation: 'NM' },
  { name: 'New York', abbreviation: 'NY' },
  { name: 'North Carolina', abbreviation: 'NC' },
  { name: 'North Dakota', abbreviation: 'ND' },
  { name: 'Ohio', abbreviation: 'OH' },
  { name: 'Oklahoma', abbreviation: 'OK' },
  { name: 'Oregon', abbreviation: 'OR' },
  { name: 'Pennsylvania', abbreviation: 'PA' },
  { name: 'Rhode Island', abbreviation: 'RI' },
  { name: 'South Carolina', abbreviation: 'SC' },
  { name: 'South Dakota', abbreviation: 'SD' },
  { name: 'Tennessee', abbreviation: 'TN' },
  { name: 'Texas', abbreviation: 'TX' },
  { name: 'Utah', abbreviation: 'UT' },
  { name: 'Vermont', abbreviation: 'VT' },
  { name: 'Virginia', abbreviation: 'VA' },
  { name: 'Washington', abbreviation: 'WA' },
  { name: 'West Virginia', abbreviation: 'WV' },
  { name: 'Wisconsin', abbreviation: 'WI' },
  { name: 'Wyoming', abbreviation: 'WY' },
];

const TAX_RATE = 0.08; // 8% tax rate

type DeliveryMethod = 'shipping' | 'pickup';

const OrderCreatePage: React.FC<OrderCreatePageProps> = ({ onNavigate }) => {
  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Product state
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);

  // Delivery method state
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('shipping');

  // Shipping state
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [shippingCost, setShippingCost] = useState<number>(0);

  // Pickup state
  const { locations: pickupLocations, loading: loadingLocations } = usePickupLocations();
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<string>('');
  const [selectedPickupSlot, setSelectedPickupSlot] = useState<PickupSlot | null>(null);
  const { slots: pickupSlots, loading: loadingSlots } = useAvailablePickupSlots(
    selectedPickupLocation || null
  );

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentStatus, setPaymentStatus] = useState<string>('paid');
  const [internalNotes, setInternalNotes] = useState<string>('');

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Auto-populate shipping name from customer
  useEffect(() => {
    if (selectedCustomer && deliveryMethod === 'shipping') {
      setShippingAddress((prev) => ({
        ...prev,
        name: `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
      }));
    }
  }, [selectedCustomer, deliveryMethod]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const tax = subtotal * TAX_RATE;
    const shipping = deliveryMethod === 'pickup' ? 0 : shippingCost;
    const total = subtotal + tax + shipping;

    return { subtotal, tax, shipping, total };
  };

  const { subtotal, tax, shipping, total } = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Customer validation
    if (!selectedCustomer) {
      errors.push('Please select or create a customer');
    }

    // Products validation
    if (lineItems.length === 0) {
      errors.push('Please add at least one product');
    }

    // Delivery validation
    if (deliveryMethod === 'shipping') {
      if (!shippingAddress.name) errors.push('Shipping name is required');
      if (!shippingAddress.street) errors.push('Shipping street is required');
      if (!shippingAddress.city) errors.push('Shipping city is required');
      if (!shippingAddress.state) errors.push('Shipping state is required');
      if (!shippingAddress.zip) errors.push('Shipping ZIP code is required');

      // ZIP code validation
      if (shippingAddress.zip && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zip)) {
        errors.push('ZIP code must be 5 digits (or 5+4 format)');
      }
    } else if (deliveryMethod === 'pickup') {
      if (!selectedPickupLocation) errors.push('Please select a pickup location');
      if (!selectedPickupSlot) errors.push('Please select a pickup date and time');
    }

    // Payment validation
    if (!paymentMethod) errors.push('Payment method is required');
    if (!paymentStatus) errors.push('Payment status is required');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    setError(null);
    setValidationErrors([]);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Get current admin user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Determine order status based on payment status
      const orderStatus =
        paymentStatus === 'paid' || paymentStatus === 'partial'
          ? 'processing'
          : paymentStatus === 'failed'
            ? 'failed'
            : 'pending_payment';

      // Prepare order data
      const orderData = {
        customer_id: selectedCustomer!.id,
        customer_email: selectedCustomer!.email,
        customer_phone: selectedCustomer!.phone,
        guest_email: null,
        guest_phone: null,
        subtotal,
        tax,
        total,
        status: orderStatus,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        created_by_admin_id: user.id,
        internal_notes: internalNotes || null,
      };

      // Add delivery-specific fields
      if (deliveryMethod === 'shipping') {
        Object.assign(orderData, {
          shipping_first_name: shippingAddress.name.split(' ')[0] || shippingAddress.name,
          shipping_last_name: shippingAddress.name.split(' ').slice(1).join(' ') || '',
          shipping_address_line1: shippingAddress.street,
          shipping_address_line2: shippingAddress.street2 || null,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: 'US',
          shipping_phone: selectedCustomer!.phone,
          shipping_method: paymentMethod === 'cash' ? 'Manual Order' : 'Admin Created',
          shipping_cost: shippingCost,
          is_pickup: false,
          pickup_location_id: null,
          pickup_date: null,
          pickup_time_start: null,
          pickup_time_end: null,
        });
      } else {
        // Pickup
        Object.assign(orderData, {
          shipping_first_name: null,
          shipping_last_name: null,
          shipping_address_line1: null,
          shipping_address_line2: null,
          shipping_city: null,
          shipping_state: null,
          shipping_zip: null,
          shipping_country: null,
          shipping_phone: null,
          shipping_method: null,
          shipping_cost: 0,
          is_pickup: true,
          pickup_location_id: selectedPickupLocation,
          pickup_date: selectedPickupSlot!.slot_date,
          pickup_time_start: selectedPickupSlot!.start_time,
          pickup_time_end: selectedPickupSlot!.end_time,
        });
      }

      // Prepare order items
      const orderItems = lineItems.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
        line_total: item.line_total,
      }));

      // Call RPC function to create order with inventory check
      const { data: result, error: rpcError } = await supabase.rpc(
        'create_order_with_inventory_check',
        {
          p_order_data: orderData,
          p_order_items: orderItems,
        }
      );

      if (rpcError) throw rpcError;

      if (!result.success) {
        throw new Error(result.message || result.error || 'Failed to create order');
      }

      // Navigate to order detail page
      onNavigate(`order-detail?id=${result.order_id}`);
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedSlots = groupSlotsByDate(pickupSlots);

  return (
    <AdminPageWrapper>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('orders')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Create Order</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* 1. Customer Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-semibold">1</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Customer Information</h2>
            </div>
            <CustomerSearchSelector
              onCustomerSelected={setSelectedCustomer}
              selectedCustomer={selectedCustomer}
            />
          </motion.div>

          {/* 2. Products */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-semibold">2</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Products</h2>
            </div>
            <ProductLineItems lineItems={lineItems} onChange={setLineItems} />
          </motion.div>

          {/* 3. Delivery Method */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-semibold">3</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Delivery Method</h2>
            </div>

            {/* Delivery Method Toggle */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setDeliveryMethod('shipping')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  deliveryMethod === 'shipping'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Package
                    size={24}
                    className={deliveryMethod === 'shipping' ? 'text-emerald-600' : 'text-slate-400'}
                  />
                  <div className="text-left">
                    <div className="font-medium text-slate-900">Shipping</div>
                    <div className="text-sm text-slate-600">Deliver to address</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setDeliveryMethod('pickup')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  deliveryMethod === 'pickup'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin
                    size={24}
                    className={deliveryMethod === 'pickup' ? 'text-emerald-600' : 'text-slate-400'}
                  />
                  <div className="text-left">
                    <div className="font-medium text-slate-900">Local Pickup</div>
                    <div className="text-sm text-slate-600">Pick up at location</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Shipping Form */}
            {deliveryMethod === 'shipping' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.street}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Apartment, suite, etc. <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.street2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street2: e.target.value })}
                    placeholder="Apt 4B"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    >
                      <option value="">Select</option>
                      {US_STATES.map((state) => (
                        <option key={state.abbreviation} value={state.abbreviation}>
                          {state.abbreviation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.zip}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                      placeholder="12345"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Shipping Cost
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Enter the shipping cost for this order</p>
                </div>
              </div>
            )}

            {/* Pickup Form */}
            {deliveryMethod === 'pickup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pickup Location <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPickupLocation}
                    onChange={(e) => {
                      setSelectedPickupLocation(e.target.value);
                      setSelectedPickupSlot(null);
                    }}
                    disabled={loadingLocations}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">Select a location</option>
                    {pickupLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} - {location.city}, {location.state}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPickupLocation && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pickup Date & Time <span className="text-red-500">*</span>
                    </label>
                    {loadingSlots ? (
                      <div className="text-center py-8 text-slate-500">Loading available slots...</div>
                    ) : pickupSlots.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No available pickup slots for this location
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(groupedSlots.entries()).map(([date, slots]) => (
                          <div key={date}>
                            <div className="text-sm font-medium text-slate-700 mb-2">
                              {formatPickupDate(date)}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {slots.map((slot) => (
                                <button
                                  key={`${slot.slot_date}-${slot.start_time}`}
                                  onClick={() => setSelectedPickupSlot(slot)}
                                  disabled={slot.slots_available === 0}
                                  className={`px-4 py-2 rounded-lg border transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                    selectedPickupSlot?.schedule_id === slot.schedule_id &&
                                    selectedPickupSlot?.slot_date === slot.slot_date &&
                                    selectedPickupSlot?.start_time === slot.start_time
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                      : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  {formatPickupTime(slot.start_time)} - {formatPickupTime(slot.end_time)}
                                  {slot.slots_available > 0 && slot.slots_available < 5 && (
                                    <span className="block text-xs text-amber-600 mt-1">
                                      Only {slot.slots_available} left
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* 4. Payment Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-semibold">4</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Payment Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="phone">Phone</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Unpaid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any internal notes about this order..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </div>
          </motion.div>

          {/* 5. Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-semibold">5</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-700">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Shipping</span>
                <span className="font-medium">{formatCurrency(shipping)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Tax (8%)</span>
                <span className="font-medium">{formatCurrency(tax)}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between text-lg font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </motion.div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-medium text-red-900 mb-2">Please fix the following errors:</div>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              onClick={() => onNavigate('orders')}
              disabled={submitting}
              className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Create Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default OrderCreatePage;
