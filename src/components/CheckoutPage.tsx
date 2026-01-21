import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CartItem } from '../../types';
import { SHIPPING_NOTICE } from '../../constants';
import { useShippingServices, useCreateOrder, useAuth, useCustomerProfile, useAddresses } from '../hooks/useSupabase';
import { useSetting } from '../admin/hooks/useSettings';
import { useStripePayment } from '../hooks/useStripePayment';
import { useEmailService } from '../hooks/useIntegrations';
import StripePaymentWrapper from './StripePaymentForm';
import { supabase } from '../lib/supabase';

interface ShippingService {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
}

interface OrderData {
  order_number: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    category?: string;
  }>;
  customerFirstName: string;
  customerEmail: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  isGuest: boolean;
}

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onNavigate: (view: string) => void;
  onOrderComplete?: (orderData: OrderData) => void;
}

interface CheckoutFormData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface FormErrors {
  [key: string]: string;
}

// US States and territories for dropdown
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
  { name: 'Washington, D.C.', abbreviation: 'DC' },
  { name: 'West Virginia', abbreviation: 'WV' },
  { name: 'Wisconsin', abbreviation: 'WI' },
  { name: 'Wyoming', abbreviation: 'WY' },
];

const TAX_RATE = 0.08; // 8% tax rate

const CheckoutPage: React.FC<CheckoutPageProps> = ({ items, onBack, onNavigate, onOrderComplete }) => {
  const { shippingServices, loading: shippingLoading } = useShippingServices();
  const { createOrder, loading: orderLoading } = useCreateOrder();
  const { user } = useAuth();
  const { profile } = useCustomerProfile(user?.id);
  const { addresses } = useAddresses(user?.id);
  const { value: stripeEnabled, loading: stripeSettingLoading } = useSetting('integrations', 'stripe_enabled');
  const { createPaymentIntent, processing: paymentProcessing, error: paymentError } = useStripePayment();
  const { sendOrderConfirmation } = useEmailService();

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'form' | 'payment'>('form');
  const [saveAddress, setSaveAddress] = useState(false);
  const [hasPrefilledForm, setHasPrefilledForm] = useState(false);

  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States'
  });

  // Set default shipping when services load
  useEffect(() => {
    if (shippingServices.length > 0 && !selectedShipping) {
      setSelectedShipping(shippingServices[0].id);
    }
  }, [shippingServices, selectedShipping]);

  // Pre-fill form with user data when logged in (only once)
  useEffect(() => {
    if (!user || hasPrefilledForm) return;

    const defaultAddress = addresses?.find((addr: any) => addr.is_default) || addresses?.[0];

    // Only pre-fill if we have user data loaded
    if (user.email || profile || defaultAddress) {
      // Mark the default address as selected in the UI
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }

      setFormData(prev => ({
        ...prev,
        // Email from auth user
        email: user.email || prev.email,
        // Name and phone from profile or address
        firstName: profile?.first_name || defaultAddress?.first_name || prev.firstName,
        lastName: profile?.last_name || defaultAddress?.last_name || prev.lastName,
        phone: profile?.phone || defaultAddress?.phone || prev.phone,
        // Address from default address
        address1: defaultAddress?.street || prev.address1,
        address2: defaultAddress?.unit || prev.address2,
        city: defaultAddress?.city || prev.city,
        state: defaultAddress?.state || prev.state,
        zip: defaultAddress?.zip || prev.zip,
      }));

      setHasPrefilledForm(true);
    }
  }, [user, profile, addresses, hasPrefilledForm]);

  const selectedShippingService = shippingServices.find(s => s.id === selectedShipping);
  const shippingCost = selectedShippingService?.price || 0;

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shippingCost + tax;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectSavedAddress = (address: any) => {
    setSelectedAddressId(address.id);
    setFormData(prev => ({
      ...prev,
      firstName: address.first_name || prev.firstName,
      lastName: address.last_name || prev.lastName,
      phone: address.phone || prev.phone,
      address1: address.street || '',
      address2: address.unit || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.zip || '',
    }));
    // Clear any address-related errors
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.firstName;
      delete newErrors.lastName;
      delete newErrors.address1;
      delete newErrors.city;
      delete newErrors.state;
      delete newErrors.zip;
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    const requiredFields: (keyof CheckoutFormData)[] = [
      'email', 'phone', 'firstName', 'lastName', 'address1', 'city', 'state', 'zip'
    ];

    requiredFields.forEach(field => {
      if (!formData[field].trim()) {
        errors[field] = 'This field is required';
      }
    });

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (formData.phone && !/^[\d\s\-\(\)\+]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }

    // ZIP validation
    if (formData.zip && !/^\d{5}(-\d{4})?$/.test(formData.zip)) {
      errors.zip = 'Please enter a valid ZIP code';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setOrderError(null);

    if (!validateForm()) {
      return;
    }

    // If Stripe is enabled, create payment intent and show payment form
    if (stripeEnabled) {
      // Create order first with pending payment status
      const result = await createOrder({
        cartItems: items,
        customerInfo: {
          email: formData.email,
          phone: formData.phone,
          firstName: formData.firstName,
          lastName: formData.lastName
        },
        shippingInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address1: formData.address1,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          country: formData.country
        },
        shippingMethod: selectedShippingService?.name || 'Standard',
        shippingCost: shippingCost,
        customerId: user?.id || null,
        paymentStatus: 'pending',
        saveAddress: saveAddress
      });

      if (!result.success || !result.order) {
        setOrderError(result.error || 'Failed to create order. Please try again.');
        return;
      }

      // Create payment intent
      const paymentResult = await createPaymentIntent({
        amount: total,
        customerEmail: formData.email,
        orderId: result.order.id,
        metadata: {
          orderNumber: result.order.order_number
        }
      });

      if (!paymentResult) {
        setOrderError(paymentError || 'Failed to initialize payment. Please try again.');
        return;
      }

      setPendingOrderId(result.order.id);
      setClientSecret(paymentResult.clientSecret);
      setPaymentStep('payment');
    } else {
      // Test mode - create order without payment
      await completeOrder();
    }
  };

  const completeOrder = async () => {
    // Create the order in Supabase
    const result = await createOrder({
      cartItems: items,
      customerInfo: {
        email: formData.email,
        phone: formData.phone,
        firstName: formData.firstName,
        lastName: formData.lastName
      },
      shippingInfo: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        address1: formData.address1,
        address2: formData.address2,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        country: formData.country
      },
      shippingMethod: selectedShippingService?.name || 'Standard',
      shippingCost: shippingCost,
      customerId: user?.id || null,
      saveAddress: saveAddress
    });

    if (result.success && result.order) {
      await handleOrderSuccess(result.order);
    } else {
      setOrderError(result.error || 'Failed to create order. Please try again.');
    }
  };

  const handleOrderSuccess = async (order: any) => {
    // Prepare order data for confirmation page
    const orderData: OrderData = {
      order_number: order.order_number,
      items: order.items,
      customerFirstName: formData.firstName,
      customerEmail: formData.email,
      shippingAddress: {
        name: `${formData.firstName} ${formData.lastName}`,
        address: formData.address2
          ? `${formData.address1}, ${formData.address2}`
          : formData.address1,
        city: formData.city,
        state: formData.state,
        zip: formData.zip
      },
      totals: {
        subtotal,
        shipping: shippingCost,
        tax,
        total
      },
      isGuest: !user
    };

    // Send order confirmation email
    try {
      await sendOrderConfirmation(formData.email, {
        orderNumber: order.order_number,
        customerName: formData.firstName,
        items: order.items,
        subtotal,
        shipping: shippingCost,
        tax,
        total,
        shippingAddress: orderData.shippingAddress
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't block the order flow if email fails
    }

    // Navigate to order confirmation
    if (onOrderComplete) {
      onOrderComplete(orderData);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    // Payment succeeded, navigate to confirmation
    if (pendingOrderId) {
      // Fetch the order details and complete
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', pendingOrderId)
        .single();

      if (order) {
        await handleOrderSuccess(order);
      }
    }
  };

  const handlePaymentError = (error: string) => {
    setOrderError(error);
  };

  const getInputClassName = (fieldName: string) => {
    const baseClass = "w-full px-6 py-4 bg-gray-50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all";
    const errorClass = formErrors[fieldName] && submitAttempted
      ? "border-red-300 bg-red-50/50"
      : "border-gray-100";
    return `${baseClass} ${errorClass}`;
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-extrabold text-gray-900 mb-4">Your cart is empty</h2>
          <p className="text-gray-500 mb-8">Add some items to your cart before checking out.</p>
          <button
            onClick={() => onNavigate('shop')}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="border-b border-gray-100 py-6 px-4 md:px-12 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" x2="5" y1="12" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Return to Cart
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">A</div>
            <span className="font-heading font-extrabold text-gray-900">Secure Checkout</span>
          </div>
          <div className="w-28 hidden md:block" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left Column: Form */}
          <div className="lg:col-span-7 space-y-10">
            <form onSubmit={handleSubmit}>

              {/* Contact Information */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Contact Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      type="email"
                      placeholder="you@example.com"
                      className={getInputClassName('email')}
                    />
                    {formErrors.email && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      type="tel"
                      placeholder="(404) 555-0123"
                      className={getInputClassName('phone')}
                    />
                    {formErrors.phone && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>
                    )}
                  </div>
                </div>
              </motion.section>

              <hr className="my-10 border-gray-100" />

              {/* Shipping Address */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Shipping Address</h3>
                </div>

                {/* Saved Addresses Selector */}
                {user && addresses && addresses.length > 0 && (
                  <div className="mb-6">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 block">
                      Saved Addresses
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {addresses.map((address: any) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => handleSelectSavedAddress(address)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            selectedAddressId === address.id
                              ? 'border-emerald-600 bg-emerald-50/30'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                selectedAddressId === address.id
                                  ? 'border-emerald-600'
                                  : 'border-gray-300'
                              }`}>
                                {selectedAddressId === address.id && (
                                  <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                                )}
                              </div>
                              <span className="font-bold text-gray-900 text-sm">{address.label || 'Address'}</span>
                            </div>
                            {address.is_default && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-2 ml-6 text-xs text-gray-500 space-y-0.5">
                            <p>{address.first_name} {address.last_name}</p>
                            <p>{address.street}{address.unit ? `, ${address.unit}` : ''}</p>
                            <p>{address.city}, {address.state} {address.zip}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Select a saved address or enter a new one below
                    </p>
                  </div>
                )}

                {/* Name fields side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Jane"
                      className={getInputClassName('firstName')}
                    />
                    {formErrors.firstName && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Doe"
                      className={getInputClassName('lastName')}
                    />
                    {formErrors.lastName && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Address Line 1 */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="address1"
                    value={formData.address1}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="123 Main Street"
                    className={getInputClassName('address1')}
                  />
                  {formErrors.address1 && submitAttempted && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.address1}</p>
                  )}
                </div>

                {/* Address Line 2 */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Apartment, Suite, etc. <span className="text-gray-300">(optional)</span>
                  </label>
                  <input
                    name="address2"
                    value={formData.address2}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="Apt 4B"
                    className={getInputClassName('address2')}
                  />
                </div>

                {/* City, State, ZIP */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-4 md:col-span-2 space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      City <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Atlanta"
                      className={getInputClassName('city')}
                    />
                    {formErrors.city && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.city}</p>
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-1 space-y-2">
                    <label htmlFor="state-select" className="text-xs font-black uppercase tracking-widest text-gray-400">
                      State <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="state-select"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      required
                      aria-required="true"
                      aria-invalid={formErrors.state && submitAttempted ? 'true' : 'false'}
                      aria-describedby={formErrors.state && submitAttempted ? 'state-error' : undefined}
                      className={getInputClassName('state')}
                    >
                      <option value="" disabled>Select a state</option>
                      {US_STATES.map((state) => (
                        <option key={state.abbreviation} value={state.abbreviation}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.state && submitAttempted && (
                      <p id="state-error" className="text-xs text-red-500 mt-1">{formErrors.state}</p>
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-1 space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      ZIP <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="zip"
                      value={formData.zip}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="30318"
                      className={getInputClassName('zip')}
                    />
                    {formErrors.zip && submitAttempted && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.zip}</p>
                    )}
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Country
                  </label>
                  <input
                    name="country"
                    value={formData.country}
                    type="text"
                    disabled
                    className="w-full px-6 py-4 bg-gray-100 border border-gray-100 rounded-2xl text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400">Currently shipping within the United States only</p>
                </div>

                {/* Save Address Checkbox - only show for logged in users */}
                {user && (
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setSaveAddress(!saveAddress)}
                      className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        saveAddress
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {saveAddress && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <label
                      onClick={() => setSaveAddress(!saveAddress)}
                      className="text-sm text-gray-600 cursor-pointer select-none"
                    >
                      Save this address to my address book
                    </label>
                  </div>
                )}
              </motion.section>

              <hr className="my-10 border-gray-100" />

              {/* Shipping Method */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Shipping Method</h3>
                </div>

                {shippingLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                      <div key={i} className="p-6 rounded-[2rem] border-2 border-gray-100 bg-gray-50 animate-pulse">
                        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shippingServices.map((service: ShippingService) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedShipping(service.id)}
                        className={`p-6 rounded-[2rem] border-2 text-left transition-all ${
                          selectedShipping === service.id
                            ? 'border-emerald-600 bg-emerald-50/30'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedShipping === service.id
                                ? 'border-emerald-600'
                                : 'border-gray-300'
                            }`}>
                              {selectedShipping === service.id && (
                                <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></div>
                              )}
                            </div>
                            <span className="font-bold text-gray-900">{service.name}</span>
                          </div>
                          <span className="text-emerald-600 font-black">${service.price.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-8">{service.description}</p>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {SHIPPING_NOTICE}
                </p>
              </motion.section>

              <hr className="my-10 border-gray-100" />

              {/* Payment Section */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Payment</h3>
                </div>

                {/* Show Stripe payment form if we have a client secret */}
                {paymentStep === 'payment' && clientSecret ? (
                  <div className="p-6 rounded-[2rem] border-2 border-emerald-200 bg-emerald-50/30">
                    <StripePaymentWrapper
                      clientSecret={clientSecret}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </div>
                ) : stripeEnabled && !stripeSettingLoading ? (
                  // Stripe is enabled - show secure payment notice
                  <div className="p-6 rounded-[2rem] border-2 border-emerald-200 bg-emerald-50/30">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">Secure Payment</h4>
                        <p className="text-sm text-gray-600">
                          Your payment will be processed securely through Stripe. Click "Continue to Payment" to enter your card details.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Test mode - Stripe not enabled
                  <div className="p-6 rounded-[2rem] border-2 border-amber-200 bg-amber-50/50">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-full">
                            Test Mode
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 mb-1">No Payment Required</h4>
                        <p className="text-sm text-gray-600">
                          Payment processing is currently disabled. You can place a test order to complete the checkout flow.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>

              {/* Order Error */}
              {orderError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{orderError}</span>
                  </div>
                </motion.div>
              )}

              {/* Submit Button - Desktop (hidden on mobile, shown in order summary on mobile) */}
              {/* Only show if not in payment step (Stripe form has its own submit) */}
              {paymentStep !== 'payment' && (
                <div className="hidden lg:block mt-12">
                  <button
                    type="submit"
                    disabled={orderLoading || paymentProcessing}
                    className="w-full py-6 rounded-[2rem] font-black text-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-4 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {orderLoading || paymentProcessing ? (
                      <>
                        <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {stripeEnabled ? 'Preparing Payment...' : 'Processing Order...'}
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={stripeEnabled ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M5 13l4 4L19 7"} />
                        </svg>
                        {stripeEnabled ? 'Continue to Payment' : 'Place Order'}
                      </>
                    )}
                  </button>
                  {!stripeEnabled && (
                    <p className="text-center text-xs text-gray-400 mt-4">
                      Test Mode - No payment will be processed
                    </p>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-xl shadow-gray-100/50"
              >
                <h3 className="text-2xl font-heading font-extrabold text-gray-900 mb-8">Order Summary</h3>

                {/* Cart Items */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto mb-8 pr-2 scrollbar-thin">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                        <p className="text-xs text-gray-400 font-medium">{item.category || 'Plant'}</p>
                        <p className="text-sm font-black text-emerald-600 mt-0.5">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-3 pt-6 border-t border-gray-100">
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Subtotal</span>
                    <span className="font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Shipping</span>
                    <span className="font-bold">
                      {shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'Select method'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Tax (8%)</span>
                    <span className="font-bold">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <span className="text-lg font-heading font-extrabold text-gray-900">Total</span>
                    <span className="text-2xl font-black text-emerald-600">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Mobile Submit Button - Only show if not in payment step */}
                {paymentStep !== 'payment' && (
                  <div className="lg:hidden mt-8">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={orderLoading || paymentProcessing}
                      className="w-full py-5 rounded-[2rem] font-black text-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {orderLoading || paymentProcessing ? (
                        <>
                          <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {stripeEnabled ? 'Preparing...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={stripeEnabled ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M5 13l4 4L19 7"} />
                          </svg>
                          {stripeEnabled ? 'Continue to Payment' : 'Place Order'}
                        </>
                      )}
                    </button>
                    {!stripeEnabled && (
                      <p className="text-center text-xs text-gray-400 mt-3">
                        Test Mode - No payment required
                      </p>
                    )}
                  </div>
                )}

                {/* Trust Badges */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-6 text-gray-400">
                    <div className="flex items-center gap-2 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Protected</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span>Encrypted</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
