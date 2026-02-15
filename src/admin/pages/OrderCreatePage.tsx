import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import CustomerSearchSelector from '../components/CustomerSearchSelector';
import ProductLineItems, { OrderLineItem } from '../components/ProductLineItems';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, Package, MapPin, CreditCard, AlertTriangle, Calculator, Loader2, Truck, Check } from 'lucide-react';
import {
  usePickupLocations,
  useAvailablePickupSlots,
  formatPickupDate,
  formatPickupTime,
  groupSlotsByDate,
  PickupLocation,
  PickupSlot,
} from '../../hooks/usePickup';
import { useEmailService } from '../../hooks/useIntegrations';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  first_name: string | null;
  last_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  is_default: boolean;
}

interface ShippingRate {
  rate_id: string;
  carrier_id: string;
  carrier_code: string;
  carrier_friendly_name: string;
  service_code: string;
  service_type: string;
  shipping_amount: number;
  currency: string;
  delivery_days: number | null;
  estimated_delivery_date: string | null;
  carrier_delivery_days: string | null;
  guaranteed_service: boolean;
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

  // Customer addresses state
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | ''>('');

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
  const [useManualShipping, setUseManualShipping] = useState<boolean>(false);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [fetchingRates, setFetchingRates] = useState<boolean>(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesSandbox, setRatesSandbox] = useState<boolean>(false);
  const [ratesMarkup, setRatesMarkup] = useState<string | null>(null);

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

  // Inventory override state
  const [overrideInventory, setOverrideInventory] = useState<boolean>(false);

  // Email service
  const { sendOrderConfirmation } = useEmailService();

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch customer addresses when customer is selected
  useEffect(() => {
    const fetchCustomerAddresses = async () => {
      if (!selectedCustomer) {
        setCustomerAddresses([]);
        setSelectedSavedAddressId('');
        return;
      }

      setLoadingAddresses(true);
      try {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', selectedCustomer.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCustomerAddresses(data || []);

        // Auto-select default address if exists
        const defaultAddress = data?.find((addr) => addr.is_default);
        if (defaultAddress && deliveryMethod === 'shipping') {
          setSelectedSavedAddressId(defaultAddress.id);
          // Auto-fill the form with default address
          const fullName = [defaultAddress.first_name, defaultAddress.last_name]
            .filter(Boolean)
            .join(' ') || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim();
          setShippingAddress({
            name: fullName,
            street: defaultAddress.address_line1,
            street2: defaultAddress.address_line2 || '',
            city: defaultAddress.city,
            state: defaultAddress.state,
            zip: defaultAddress.zip,
          });
        }
      } catch (err) {
        console.error('Error fetching customer addresses:', err);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchCustomerAddresses();
  }, [selectedCustomer]);

  // Auto-populate shipping name from customer (only if no saved address selected)
  useEffect(() => {
    if (selectedCustomer && deliveryMethod === 'shipping' && !selectedSavedAddressId) {
      setShippingAddress((prev) => ({
        ...prev,
        name: `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
      }));
    }
  }, [selectedCustomer, deliveryMethod, selectedSavedAddressId]);

  // Handle saved address selection
  const handleSavedAddressSelect = (addressId: string) => {
    setSelectedSavedAddressId(addressId);

    if (addressId === '') {
      // User chose to enter new address - clear form but keep customer name
      setShippingAddress({
        name: selectedCustomer
          ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
          : '',
        street: '',
        street2: '',
        city: '',
        state: '',
        zip: '',
      });
      // Reset shipping rates when address changes
      setShippingRates([]);
      setSelectedRate(null);
      setShippingCost(0);
      return;
    }

    const address = customerAddresses.find((addr) => addr.id === addressId);
    if (address) {
      const fullName = [address.first_name, address.last_name]
        .filter(Boolean)
        .join(' ') || (selectedCustomer
          ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
          : '');
      setShippingAddress({
        name: fullName,
        street: address.address_line1,
        street2: address.address_line2 || '',
        city: address.city,
        state: address.state,
        zip: address.zip,
      });
      // Reset shipping rates when address changes
      setShippingRates([]);
      setSelectedRate(null);
      setShippingCost(0);
    }
  };

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
      // Customer name is required for pickup orders (used as shipping name in DB)
      if (selectedCustomer && !selectedCustomer.first_name && !selectedCustomer.last_name) {
        errors.push('Customer must have a name for pickup orders');
      }
    }

    // Payment validation
    if (!paymentMethod) errors.push('Payment method is required');
    if (!paymentStatus) errors.push('Payment status is required');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Calculate shipping rates from ShipEngine
  const calculateShippingRates = async () => {
    // Validate address fields
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
      setRatesError('Please fill in all shipping address fields before calculating rates');
      return;
    }

    // Validate we have items
    if (lineItems.length === 0) {
      setRatesError('Please add products before calculating shipping rates');
      return;
    }

    setFetchingRates(true);
    setRatesError(null);
    setShippingRates([]);
    setSelectedRate(null);
    setRatesSandbox(false);
    setRatesMarkup(null);

    try {
      const requestBody = {
        ship_to: {
          name: shippingAddress.name || 'Customer',
          address_line1: shippingAddress.street,
          address_line2: shippingAddress.street2 || '',
          city_locality: shippingAddress.city,
          state_province: shippingAddress.state,
          postal_code: shippingAddress.zip,
          country_code: 'US'
        },
        order_items: lineItems.map(item => ({
          quantity: item.quantity,
          weight_per_item: 0.5 // Default weight per plant
        }))
      };

      const { data, error } = await supabase.functions.invoke('shipengine-get-rates', {
        body: requestBody
      });

      if (error) {
        // Extract actual error details from the response body
        let errorMessage = 'Failed to calculate shipping rates';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errorBody = await error.context.json();
            errorMessage = errorBody?.error?.message || errorBody?.message || errorMessage;
          } else if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
            errorMessage = error.message;
          }
        } catch {
          // If we can't parse the response, use the original error
          console.error('Could not parse edge function error response:', error);
        }
        throw new Error(errorMessage);
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get shipping rates');
      }

      if (data.rates.length === 0) {
        setRatesError('No shipping rates available for this address. You can enter a manual amount.');
        setUseManualShipping(true);
        return;
      }

      // Log carrier IDs and errors for debugging
      if (data.carrier_ids_used) {
        console.log('Carrier IDs used for rate request:', data.carrier_ids_used);
      }
      if (data.carrier_errors?.length > 0) {
        console.warn('Some carriers did not return rates:', data.carrier_errors);
      }

      // Track sandbox mode and markup for admin visibility
      if (data.is_sandbox) {
        setRatesSandbox(true);
      }
      if (data.markup_applied) {
        if (data.markup_applied.type === 'fixed') {
          setRatesMarkup(`+$${data.markup_applied.amount.toFixed(2)} fixed markup applied`);
        } else if (data.markup_applied.type === 'percentage') {
          setRatesMarkup(`+${data.markup_applied.percent}% markup applied`);
        }
      }

      // Deduplicate rates: keep cheapest per carrier_id + service_code.
      // Using carrier_id (not carrier_code) so rates from different accounts
      // for the same carrier (e.g., ShipStation UPS vs Direct UPS) both appear.
      const bestByService = new Map<string, ShippingRate>();
      for (const rate of data.rates) {
        const key = `${rate.carrier_id}::${rate.service_code}`;
        const existing = bestByService.get(key);
        if (!existing || rate.shipping_amount < existing.shipping_amount) {
          bestByService.set(key, rate);
        }
      }
      const deduped = Array.from(bestByService.values())
        .sort((a, b) => a.shipping_amount - b.shipping_amount);

      setShippingRates(deduped);
      // Auto-select the cheapest rate
      const cheapest = deduped[0];
      setSelectedRate(cheapest);
      setShippingCost(cheapest.shipping_amount);
      setUseManualShipping(false);
    } catch (err: any) {
      console.error('Error fetching shipping rates:', err);
      setRatesError(err.message || 'Failed to calculate shipping rates');
      setUseManualShipping(true);
    } finally {
      setFetchingRates(false);
    }
  };

  // Handle rate selection
  const handleRateSelect = (rate: ShippingRate) => {
    setSelectedRate(rate);
    setShippingCost(rate.shipping_amount);
    setUseManualShipping(false);
  };

  // Switch to manual shipping entry
  const handleUseManualShipping = () => {
    setUseManualShipping(true);
    setSelectedRate(null);
    // Keep existing shipping cost if any, or reset to 0
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

      // Build internal notes
      const finalInternalNotes = internalNotes || '';

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
        internal_notes: finalInternalNotes || null,
        skip_inventory_check: overrideInventory,
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
          shipping_method: selectedRate
            ? `${selectedRate.carrier_friendly_name} - ${selectedRate.service_type}`
            : 'Manual Order',
          shipping_cost: shippingCost,
          is_pickup: false,
          pickup_location_id: null,
          pickup_date: null,
          pickup_time_start: null,
          pickup_time_end: null,
        });
      } else {
        // Pickup — shipping address fields are NOT NULL in DB, so populate them:
        // 1. Use customer's default saved address if available
        // 2. Fall back to the pickup location address
        const defaultAddr = customerAddresses.find((addr) => addr.is_default);
        const pickupLoc = pickupLocations.find((loc) => loc.id === selectedPickupLocation);

        let pickupShippingLine1: string;
        let pickupShippingLine2: string | null;
        let pickupShippingCity: string;
        let pickupShippingState: string;
        let pickupShippingZip: string;

        if (defaultAddr) {
          pickupShippingLine1 = defaultAddr.address_line1;
          pickupShippingLine2 = defaultAddr.address_line2 || null;
          pickupShippingCity = defaultAddr.city;
          pickupShippingState = defaultAddr.state;
          pickupShippingZip = defaultAddr.zip;
        } else if (pickupLoc) {
          pickupShippingLine1 = pickupLoc.address_line1;
          pickupShippingLine2 = pickupLoc.address_line2 || null;
          pickupShippingCity = pickupLoc.city;
          pickupShippingState = pickupLoc.state;
          pickupShippingZip = pickupLoc.postal_code;
        } else {
          // Shouldn't happen (validation requires a pickup location), but safe fallback
          pickupShippingLine1 = 'Pickup Order';
          pickupShippingLine2 = null;
          pickupShippingCity = 'Atlanta';
          pickupShippingState = 'GA';
          pickupShippingZip = '30301';
        }

        Object.assign(orderData, {
          shipping_first_name: selectedCustomer!.first_name || '',
          shipping_last_name: selectedCustomer!.last_name || '',
          shipping_address_line1: pickupShippingLine1,
          shipping_address_line2: pickupShippingLine2,
          shipping_city: pickupShippingCity,
          shipping_state: pickupShippingState,
          shipping_zip: pickupShippingZip,
          shipping_country: 'US',
          shipping_phone: selectedCustomer!.phone,
          shipping_method: 'Local Pickup',
          shipping_cost: 0,
          is_pickup: true,
          pickup_location_id: selectedPickupLocation,
          pickup_schedule_id: selectedPickupSlot!.schedule_id,
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
      // NOTE: Customer checkout uses the same RPC via useCreateOrder hook (useSupabase.js) — keep order data shape in sync
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

      // Update order with shipping rate info if a calculated rate was selected
      if (selectedRate && deliveryMethod === 'shipping') {
        const shippingMethodName = `${selectedRate.carrier_friendly_name} - ${selectedRate.service_type}`;
        await supabase
          .from('orders')
          .update({
            shipping_rate_id: selectedRate.rate_id,
            shipping_carrier_id: selectedRate.carrier_id,
            shipping_service_code: selectedRate.service_code,
            shipping_method: shippingMethodName,
            shipping_method_name: shippingMethodName,
          })
          .eq('id', result.order_id);
      }

      // Send order confirmation email (non-blocking)
      // NOTE: Customer checkout (CheckoutPage.tsx) has a parallel email flow — keep both in sync
      try {
        await sendOrderConfirmation(selectedCustomer!.email, {
          orderNumber: result.order_number,
          customerName: selectedCustomer!.first_name || 'Customer',
          items: lineItems.map(item => ({
            name: item.product_name,
            quantity: item.quantity,
            price: item.product_price,
          })),
          subtotal,
          shipping: shippingCost,
          tax,
          total,
          shippingAddress: deliveryMethod === 'shipping' ? {
            name: shippingAddress.name,
            address: `${shippingAddress.street}${shippingAddress.street2 ? ', ' + shippingAddress.street2 : ''}`,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.zip,
          } : undefined,
          pickupInfo: deliveryMethod === 'pickup' ? {
            locationName: pickupLocations.find(l => l.id === selectedPickupLocation)?.name || 'Pickup Location',
            date: selectedPickupSlot!.slot_date,
            time: `${formatPickupTime(selectedPickupSlot!.start_time)} - ${formatPickupTime(selectedPickupSlot!.end_time)}`,
          } : undefined,
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't block order creation if email fails
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 font-semibold">2</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Products</h2>
              </div>

              {/* Override Inventory Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideInventory}
                  onChange={(e) => setOverrideInventory(e.target.checked)}
                  className="w-4 h-4 text-amber-600 bg-white border-slate-300 rounded focus:ring-amber-500 focus:ring-2"
                />
                <span className="text-sm text-slate-700">Override inventory restrictions</span>
              </label>
            </div>

            {/* Override Warning */}
            {overrideInventory && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="font-medium text-amber-800 mb-1">
                      Inventory Override Enabled
                    </div>
                    <p className="text-sm text-amber-700">
                      You can now add out-of-stock products or exceed available quantities.
                      This may result in backorders or fulfillment delays.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <ProductLineItems
              lineItems={lineItems}
              onChange={setLineItems}
              overrideInventory={overrideInventory}
            />
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
                {/* Saved Addresses Selector */}
                {selectedCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Saved Addresses
                    </label>
                    {loadingAddresses ? (
                      <div className="flex items-center gap-2 py-2 text-slate-500">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Loading saved addresses...</span>
                      </div>
                    ) : customerAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {customerAddresses.map((address) => (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => handleSavedAddressSelect(address.id)}
                            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                              selectedSavedAddressId === address.id
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <MapPin
                                  size={18}
                                  className={`mt-0.5 ${selectedSavedAddressId === address.id ? 'text-emerald-600' : 'text-slate-400'}`}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-900">{address.label}</span>
                                    {address.is_default && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-600 mt-1">
                                    {address.address_line1}
                                    {address.address_line2 && `, ${address.address_line2}`}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {address.city}, {address.state} {address.zip}
                                  </div>
                                </div>
                              </div>
                              {selectedSavedAddressId === address.id && (
                                <Check size={18} className="text-emerald-600 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleSavedAddressSelect('')}
                          className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                            selectedSavedAddressId === ''
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Package
                              size={18}
                              className={selectedSavedAddressId === '' ? 'text-emerald-600' : 'text-slate-400'}
                            />
                            <span className={`font-medium ${selectedSavedAddressId === '' ? 'text-emerald-700' : 'text-slate-700'}`}>
                              Enter a new address
                            </span>
                            {selectedSavedAddressId === '' && (
                              <Check size={18} className="text-emerald-600 ml-auto" />
                            )}
                          </div>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 py-2">
                        No saved addresses for this customer. Enter address below.
                      </p>
                    )}
                  </div>
                )}

                {/* Divider when saved addresses exist */}
                {selectedCustomer && customerAddresses.length > 0 && (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      {selectedSavedAddressId ? 'Selected Address Details' : 'New Address Details'}
                    </p>
                  </div>
                )}

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

                {/* Shipping Cost Section */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Shipping Cost
                    </label>
                    <button
                      type="button"
                      onClick={calculateShippingRates}
                      disabled={fetchingRates || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip || lineItems.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                    >
                      {fetchingRates ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator size={16} />
                          Calculate Shipping
                        </>
                      )}
                    </button>
                  </div>

                  {/* Rates Error */}
                  {ratesError && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      {ratesError}
                    </div>
                  )}

                  {/* Sandbox Warning */}
                  {ratesSandbox && shippingRates.length > 0 && (
                    <div className="mb-3 p-3 bg-orange-50 border border-orange-300 rounded-lg text-sm text-orange-800">
                      <strong>Sandbox Mode:</strong> Using a TEST API key. These are estimated retail rates, not your negotiated Shipstation rates. Switch to a production API key in Settings &rarr; Integrations for accurate pricing.
                    </div>
                  )}

                  {/* Markup Info */}
                  {ratesMarkup && shippingRates.length > 0 && !ratesSandbox && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      {ratesMarkup} (configured in Settings &rarr; Shipping)
                    </div>
                  )}

                  {/* Available Rates */}
                  {shippingRates.length > 0 && !useManualShipping && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-slate-500 mb-2">Select a shipping rate:</p>
                      {shippingRates.map((rate) => (
                        <button
                          key={rate.rate_id}
                          type="button"
                          onClick={() => handleRateSelect(rate)}
                          className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                            selectedRate?.rate_id === rate.rate_id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Truck size={18} className={selectedRate?.rate_id === rate.rate_id ? 'text-emerald-600' : 'text-slate-400'} />
                              <div>
                                <div className="font-medium text-slate-900">
                                  {rate.carrier_friendly_name} - {rate.service_type}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {rate.delivery_days ? `${rate.delivery_days} day${rate.delivery_days > 1 ? 's' : ''}` : 'Delivery time varies'}
                                  {rate.guaranteed_service && ' • Guaranteed'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">${rate.shipping_amount.toFixed(2)}</span>
                              {selectedRate?.rate_id === rate.rate_id && (
                                <Check size={18} className="text-emerald-600" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* Option to use manual entry */}
                      <button
                        type="button"
                        onClick={handleUseManualShipping}
                        className="w-full p-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Or enter a custom amount
                      </button>
                    </div>
                  )}

                  {/* Manual Shipping Entry */}
                  {(useManualShipping || shippingRates.length === 0) && (
                    <div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          value={shippingCost}
                          onChange={(e) => {
                            setShippingCost(parseFloat(e.target.value) || 0);
                            setSelectedRate(null);
                          }}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {shippingRates.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setUseManualShipping(false)}
                            className="text-blue-600 hover:underline"
                          >
                            Use calculated rates instead
                          </button>
                        ) : (
                          'Enter shipping cost or calculate rates above'
                        )}
                      </p>
                    </div>
                  )}
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
