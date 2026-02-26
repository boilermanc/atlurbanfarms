import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CartItem } from '../../types';
import { SHIPPING_NOTICE } from '../../constants';
import { useCreateOrder, useAuth, useCustomerProfile, useAddresses } from '../hooks/useSupabase';
import { useAddressValidation, useShippingRates, ShippingRate, ShippingAddress, ZoneInfo } from '../hooks/useShipping';
import { usePickupLocations, useAvailablePickupSlots, formatPickupTime, formatPickupDate, groupSlotsByDate, PickupLocation, PickupSlot } from '../hooks/usePickup';
import { useSetting } from '../admin/hooks/useSettings';
import { useStripePayment } from '../hooks/useStripePayment';
import { useSeedlingCredit } from '../hooks/useSeedlingCredit';
import { calculateTax } from '../lib/tax';
import { useTaxConfig } from '../hooks/useTaxConfig';
import { useAutoApplyPromotion, useRecordPromotionUsage, useCartDiscount } from '../hooks/usePromotions';
import { CartDiscountResult } from '../admin/types/promotions';
import { useEmailService } from '../hooks/useIntegrations';
import StripePaymentWrapper from './StripePaymentForm';
import AddressAutocomplete, { ParsedAddress } from './ui/AddressAutocomplete';
import InsufficientStockModal, { StockIssue } from './InsufficientStockModal';
import { supabase } from '../lib/supabase';
import { submitNewsletterPreference } from '../services/newsletter';
import { useGrowingSystems } from '../admin/hooks/useGrowingSystems';
import { ChevronDown } from 'lucide-react';

type DeliveryMethod = 'shipping' | 'pickup';

interface SelectedShippingRate {
  rate_id: string;
  carrier_id: string;
  carrier_code: string;
  carrier_friendly_name: string;
  service_code: string;
  service_type: string;
  shipping_amount: number;
  delivery_days: number | null;
  estimated_delivery_date: string | null;
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
    bundleItems?: Array<{ name: string; quantity: number }>;
  }>;
  customerFirstName: string;
  customerEmail: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  pickupInfo?: {
    locationName: string;
    address: string;
    date: string;
    timeRange: string;
    instructions?: string;
  };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  isGuest: boolean;
  isPickup: boolean;
  shippingMethodName?: string;
  estimatedDeliveryDate?: string | null;
  packageBreakdown?: {
    total_packages: number;
    packages: Array<{ name: string; item_count: number }>;
    summary: string;
  } | null;
}

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onNavigate: (view: string) => void;
  onOrderComplete?: (orderData: OrderData) => void;
  onUpdateCart?: (updatedItems: CartItem[]) => void;
}

interface CheckoutFormData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  shippingPhone: string;
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

const GROWING_SYSTEMS_FALLBACK = [
  'Tower Garden',
  'Aerospring',
  'Lettuce Grow',
  'Gardyn',
  'DIY',
  'Other',
];

/**
 * Calculate the next ship date based on current time, cutoff, and ship day settings.
 * All times evaluated in America/New_York timezone.
 * - cutoffDay: 0=Sun, 1=Mon, ... 6=Sat
 * - cutoffTime: "HH:MM" in 24h format
 * - shipDay: 0=Sun, 1=Mon, ... 6=Sat
 *
 * Logic: If we're before this week's cutoff, we ship on the next shipDay after the cutoff.
 * If we're past the cutoff, we ship on the shipDay after *next* week's cutoff.
 */
function getNextShipDate(cutoffDay: number, cutoffTime: string, shipDay: number): Date {
  // Get current time in ET
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const currentDay = nowET.getDay(); // 0=Sun
  const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);

  // How many days until the cutoff day from today?
  let daysToCutoff = (cutoffDay - currentDay + 7) % 7;

  // Build cutoff datetime for this week
  const cutoffDate = new Date(nowET);
  cutoffDate.setDate(cutoffDate.getDate() + daysToCutoff);
  cutoffDate.setHours(cutoffH, cutoffM, 0, 0);

  // If the cutoff is today but already passed, jump to next week
  let pastCutoff = nowET > cutoffDate;

  // Days from cutoff day to ship day (ship day is always after cutoff in the cycle)
  let cutoffToShip = (shipDay - cutoffDay + 7) % 7;
  if (cutoffToShip === 0) cutoffToShip = 7; // ship day same as cutoff day means next week

  const shipDate = new Date(cutoffDate);
  if (pastCutoff) {
    // Missed this week's cutoff — next cutoff is 7 days later
    shipDate.setDate(shipDate.getDate() + 7 + cutoffToShip);
  } else {
    shipDate.setDate(shipDate.getDate() + cutoffToShip);
  }

  return shipDate;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ items, onBack, onNavigate, onOrderComplete, onUpdateCart }) => {
  const { createOrder, loading: orderLoading } = useCreateOrder();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useCustomerProfile(user?.id);
  const { addresses, loading: addressesLoading } = useAddresses(user?.id);
  const { value: stripeEnabled, loading: stripeSettingLoading } = useSetting('integrations', 'stripe_enabled');
  const { value: shipEngineEnabled } = useSetting('integrations', 'shipstation_enabled');
  const { value: defaultShipDay } = useSetting('shipping', 'default_ship_day');
  const { value: weeklyCutoffDay } = useSetting('shipping', 'weekly_cutoff_day');
  const { value: weeklyCutoffTime } = useSetting('shipping', 'weekly_cutoff_time');
  const { value: customerShippingMessage } = useSetting('shipping', 'customer_shipping_message');
  const { createPaymentIntent, processing: paymentProcessing, error: paymentError } = useStripePayment();
  const { sendOrderConfirmation } = useEmailService();
  const { taxConfig } = useTaxConfig();
  const { systems: growingSystems } = useGrowingSystems();
  const growingSystemOptions = growingSystems.length > 0
    ? growingSystems.filter(s => s.is_active).map(s => s.name)
    : GROWING_SYSTEMS_FALLBACK;

  // Sproutify seedling credit
  const { hasCredit, creditAmount, isLifetime, redeemCredit, loading: creditLoading } = useSeedlingCredit(
    user?.email || null
  );

  // Auto-apply promotions from promotions table
  const { discount: autoPromotion, loading: promoLoading } = useAutoApplyPromotion(items, user?.id, user?.email);
  const { recordUsage: recordPromotionUsage } = useRecordPromotionUsage();

  // Manual promo code
  const { calculateDiscount, loading: manualPromoLoading } = useCartDiscount();
  const [manualPromoCode, setManualPromoCode] = useState('');
  const [manualPromoExpanded, setManualPromoExpanded] = useState(false);
  const [appliedManualPromo, setAppliedManualPromo] = useState<CartDiscountResult | null>(null);
  const [manualPromoError, setManualPromoError] = useState<string | null>(null);

  // ShipEngine address validation and rates
  const {
    validateAddress,
    clearValidation,
    validationResult,
    loading: validatingAddress,
    error: validationError
  } = useAddressValidation();
  const {
    fetchRates,
    clearRates,
    rates: shippingRates,
    loading: fetchingRates,
    error: ratesError,
    zoneInfo,
    isZoneBlocked,
    packageBreakdown
  } = useShippingRates();

  // Local Pickup
  const { locations: pickupLocations, loading: pickupLocationsLoading } = usePickupLocations();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('shipping');
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string | null>(null);
  const [selectedPickupSlot, setSelectedPickupSlot] = useState<PickupSlot | null>(null);

  const { slots: pickupSlots, loading: pickupSlotsLoading } = useAvailablePickupSlots(
    deliveryMethod === 'pickup' ? selectedPickupLocationId : null
  );

  const selectedPickupLocation = pickupLocations.find(l => l.id === selectedPickupLocationId);
  const hasPickupLocations = pickupLocations.length > 0;

  // Per-product fulfillment constraints
  const hasMustPickup = items.some(item => item.localPickup === 'must_be_picked_up');
  const allCannotPickup = items.length > 0 && items.every(item => item.localPickup === 'cannot_be_picked_up');
  const hasCannotPickup = items.some(item => item.localPickup === 'cannot_be_picked_up');
  const hasPickupConflict = hasMustPickup && hasCannotPickup;

  const [selectedShippingRate, setSelectedShippingRate] = useState<SelectedShippingRate | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pendingOrderItemsRef = useRef<any[]>([]);
  const [paymentStep, setPaymentStep] = useState<'form' | 'payment'>('form');
  const [saveAddress, setSaveAddress] = useState(false);
  const [hasPrefilledForm, setHasPrefilledForm] = useState(false);
  const [addressValidated, setAddressValidated] = useState(false);
  const [normalizedAddress, setNormalizedAddress] = useState<ShippingAddress | null>(null);
  const [showAddressSuggestion, setShowAddressSuggestion] = useState(false);
  const [addressWarningAcknowledged, setAddressWarningAcknowledged] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [growingTipsOptIn, setGrowingTipsOptIn] = useState(true);
  const [growingSystem, setGrowingSystem] = useState('');
  const [growingSystemOther, setGrowingSystemOther] = useState('');

  // Stock validation state
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);

  // Guard to prevent duplicate order submissions
  const orderCompletedRef = useRef(false);

  // Ref for scrolling to error banner on validation failure
  const orderErrorRef = useRef<HTMLDivElement>(null);

  // Abandoned cart tracking: session ID for deduplication across re-renders
  const [abandonedCartSessionId] = useState<string>(() => {
    let sid = sessionStorage.getItem('checkout-session-id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('checkout-session-id', sid);
    }
    return sid;
  });
  const abandonedCartSavedRef = useRef(false);

  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    shippingPhone: ''
  });

  // Auto-force delivery method based on product fulfillment constraints
  useEffect(() => {
    if (hasMustPickup) {
      setDeliveryMethod('pickup');
      setSelectedShippingRate(null);
    } else if (allCannotPickup) {
      setDeliveryMethod('shipping');
      setSelectedPickupLocationId(null);
      setSelectedPickupSlot(null);
    }
  }, [hasMustPickup, allCannotPickup]);

  // Scroll to error banner when orderError is set (especially important on mobile
  // where the error renders far above the submit button in the order summary)
  useEffect(() => {
    if (orderError && orderErrorRef.current) {
      orderErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [orderError]);

  // Auto-select first rate when rates are loaded
  useEffect(() => {
    if (shippingRates.length > 0 && !selectedShippingRate) {
      const firstRate = shippingRates[0];
      setSelectedShippingRate({
        rate_id: firstRate.rate_id,
        carrier_id: firstRate.carrier_id,
        carrier_code: firstRate.carrier_code,
        carrier_friendly_name: firstRate.carrier_friendly_name,
        service_code: firstRate.service_code,
        service_type: firstRate.service_type,
        shipping_amount: firstRate.shipping_amount,
        delivery_days: firstRate.delivery_days,
        estimated_delivery_date: firstRate.estimated_delivery_date
      });
    }
  }, [shippingRates, selectedShippingRate]);

  // Pre-fill form with user data when logged in (only once)
  // Wait for profile and addresses to finish loading to avoid race condition
  // where email triggers pre-fill before phone/name data arrives
  useEffect(() => {
    if (!user || hasPrefilledForm) return;
    if (profileLoading || addressesLoading) return;

    const defaultAddress = addresses?.find((addr: any) => addr.is_default) || addresses?.[0];

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
      // Shipping phone from default address (recipient phone, may differ from contact phone)
      shippingPhone: defaultAddress?.phone || prev.shippingPhone,
      // Company from default address
      company: defaultAddress?.company || prev.company,
      // Address from default address
      address1: defaultAddress?.street || prev.address1,
      address2: defaultAddress?.unit || prev.address2,
      city: defaultAddress?.city || prev.city,
      state: defaultAddress?.state || prev.state,
      zip: defaultAddress?.zip || prev.zip,
    }));

    setHasPrefilledForm(true);
  }, [user, profile, addresses, hasPrefilledForm, profileLoading, addressesLoading]);

  // Sync contact fields from customer profile when it loads.
  // Handles race condition where profile data arrives after initial pre-fill
  // (useCustomerProfile's loading state can be stale for one render cycle when
  // userId changes, causing the pre-fill effect to run with null profile).
  useEffect(() => {
    if (!profile) return;
    setFormData(prev => {
      const updates: Partial<CheckoutFormData> = {};
      if (profile.first_name && !prev.firstName) updates.firstName = profile.first_name;
      if (profile.last_name && !prev.lastName) updates.lastName = profile.last_name;
      if (profile.phone && !prev.phone) updates.phone = profile.phone;
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [profile]);

  // Sync recipient phone from default address when addresses load late
  useEffect(() => {
    if (!addresses?.length) return;
    const defaultAddr = addresses.find((addr: any) => addr.is_default) || addresses[0];
    if (!defaultAddr?.phone) return;
    setFormData(prev => {
      if (prev.shippingPhone) return prev; // Don't override user input
      return { ...prev, shippingPhone: defaultAddr.phone };
    });
  }, [addresses]);

  // Shipping cost is 0 for pickup, otherwise use selected rate
  const rawShippingCost = deliveryMethod === 'pickup' ? 0 : (selectedShippingRate?.shipping_amount || 0);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const lifetimeDiscount = isLifetime ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
  const autoPromoDiscount = autoPromotion?.valid ? autoPromotion.discount : 0;
  const manualPromoDiscount = appliedManualPromo?.valid ? appliedManualPromo.discount : 0;
  // Best promo wins between auto and manual
  const promoDiscount = Math.max(autoPromoDiscount, manualPromoDiscount);
  const activePromo = manualPromoDiscount >= autoPromoDiscount && manualPromoDiscount > 0
    ? appliedManualPromo
    : (autoPromoDiscount > 0 ? autoPromotion : null);
  // Best discount wins — no stacking between lifetime and promo
  const bestDiscount = Math.max(lifetimeDiscount, promoDiscount);
  const activeDiscountLabel = bestDiscount > 0
    ? (lifetimeDiscount >= promoDiscount
        ? 'Lifetime Member 10% Off'
        : (activePromo?.description || activePromo?.promotion_name || 'Promotion'))
    : '';
  // Free shipping from promo code
  const promoFreeShipping = activePromo?.free_shipping === true && promoDiscount >= lifetimeDiscount;
  const shippingCost = promoFreeShipping ? 0 : rawShippingCost;

  // For pickup orders, use the pickup location's state for tax (always in-state);
  // for shipping orders, use the customer's shipping address state.
  const taxState = deliveryMethod === 'pickup'
    ? (selectedPickupLocation?.state || 'GA')
    : formData.state;

  const taxResult = calculateTax({
    subtotal,
    shippingState: taxState,
    isTaxExempt: profile?.is_tax_exempt || false,
    taxExemptReason: profile?.tax_exempt_reason || undefined,
    config: taxConfig,
  });
  const tax = taxResult.taxAmount;
  const totalBeforeCredit = subtotal - bestDiscount + shippingCost + tax;
  const appliedCredit = hasCredit ? Math.min(creditAmount, totalBeforeCredit) : 0;
  const total = totalBeforeCredit - appliedCredit;

  // Manual promo code handlers
  const handleApplyManualPromo = useCallback(async () => {
    if (!manualPromoCode.trim()) return;
    setManualPromoError(null);

    const cartItems = items.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    const result = await calculateDiscount(
      cartItems,
      manualPromoCode.trim(),
      user?.id || undefined,
      user?.email || formData.email || undefined
    );

    if (result.valid && result.discount > 0) {
      setAppliedManualPromo(result);
      setManualPromoError(null);
      try { sessionStorage.setItem('atluf_promo_code', manualPromoCode.trim()); } catch {}
    } else {
      setAppliedManualPromo(null);
      setManualPromoError(result.message || 'Invalid promo code');
    }
  }, [manualPromoCode, items, calculateDiscount, user, formData.email]);

  const handleRemoveManualPromo = useCallback(() => {
    setAppliedManualPromo(null);
    setManualPromoCode('');
    setManualPromoError(null);
    try { sessionStorage.removeItem('atluf_promo_code'); } catch {}
  }, []);

  // Auto-apply promo code carried over from cart drawer via sessionStorage
  const promoAutoAppliedRef = useRef(false);
  useEffect(() => {
    if (promoAutoAppliedRef.current || items.length === 0) return;
    const saved = sessionStorage.getItem('atluf_promo_code');
    if (!saved) return;
    promoAutoAppliedRef.current = true;

    const cartItems = items.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    calculateDiscount(cartItems, saved, user?.id || undefined, user?.email || undefined).then(result => {
      if (result.valid && result.discount > 0) {
        setManualPromoCode(saved);
        setAppliedManualPromo(result);
        setManualPromoExpanded(true);
      } else {
        // Promo no longer valid — clean up
        try { sessionStorage.removeItem('atluf_promo_code'); } catch {}
      }
    });
  }, [items, calculateDiscount, user]);

  // Build shipping address for validation/rates
  const buildShippingAddress = useCallback((): ShippingAddress => ({
    name: `${formData.firstName} ${formData.lastName}`.trim(),
    company_name: formData.company || undefined,
    phone: formData.phone,
    address_line1: formData.address1,
    address_line2: formData.address2 || undefined,
    city_locality: formData.city,
    state_province: formData.state,
    postal_code: formData.zip,
    country_code: 'US'
  }), [formData]);

  // Validate address and fetch rates
  const handleValidateAddress = useCallback(async () => {
    if (!formData.address1 || !formData.city || !formData.state || !formData.zip) {
      return;
    }

    const address = buildShippingAddress();
    const result = await validateAddress(address);

    if (result) {
      setAddressValidated(result.status === 'verified' || result.status === 'warning');

      // Check if normalized address is different
      if (result.matched_address && result.status === 'verified') {
        const original = address;
        const normalized = result.matched_address;

        const isDifferent =
          normalized.address_line1?.toLowerCase() !== original.address_line1?.toLowerCase() ||
          normalized.city_locality?.toLowerCase() !== original.city_locality?.toLowerCase() ||
          normalized.state_province?.toLowerCase() !== original.state_province?.toLowerCase() ||
          normalized.postal_code !== original.postal_code;

        if (isDifferent) {
          setNormalizedAddress(normalized);
          setShowAddressSuggestion(true);
        } else {
          setNormalizedAddress(normalized);
          setShowAddressSuggestion(false);
        }
      }

      // Fetch shipping rates if address is valid
      if (result.status === 'verified' || result.status === 'warning') {
        const rateAddress = result.matched_address || address;
        // Convert cart items to order_items format for package calculation
        // seedlingsPerUnit accounts for bundles (e.g., "20 Seedling Variety Pack" = 20 physical seedlings)
        const orderItems = items.map(item => ({
          quantity: item.quantity * (item.seedlingsPerUnit || 1),
          weight_per_item: 0.5 // Default weight per seedling in pounds
        }));
        const totalQty = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        console.log('[Checkout] Fetching rates for', orderItems.length, 'line items, total seedlings:', totalQty, 'items:', orderItems);
        await fetchRates(rateAddress, orderItems);
      }
    }
  }, [formData, buildShippingAddress, validateAddress, fetchRates, items]);

  // Accept suggested address
  const handleAcceptSuggestedAddress = useCallback(() => {
    if (normalizedAddress) {
      setFormData(prev => ({
        ...prev,
        address1: normalizedAddress.address_line1 || prev.address1,
        address2: normalizedAddress.address_line2 || '',
        city: normalizedAddress.city_locality || prev.city,
        state: normalizedAddress.state_province || prev.state,
        zip: normalizedAddress.postal_code || prev.zip
      }));
      setShowAddressSuggestion(false);
    }
  }, [normalizedAddress]);

  // Clear validation when address changes
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear validation state when address fields change
    if (['address1', 'address2', 'city', 'state', 'zip'].includes(name)) {
      setAddressValidated(false);
      setAddressWarningAcknowledged(false);
      clearValidation();
      clearRates();
      setSelectedShippingRate(null);
      setShowAddressSuggestion(false);
    }

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [formErrors, clearValidation, clearRates]);

  // Auto-fetch shipping rates when ZIP field loses focus and all required fields are filled
  const handleZipBlur = useCallback(async () => {
    if (
      shipEngineEnabled &&
      !addressValidated &&
      formData.address1.trim() &&
      formData.city.trim() &&
      formData.state.trim() &&
      formData.zip.trim() &&
      /^\d{5}(-\d{4})?$/.test(formData.zip.trim())
    ) {
      const address: ShippingAddress = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        address_line1: formData.address1,
        address_line2: formData.address2 || undefined,
        city_locality: formData.city,
        state_province: formData.state,
        postal_code: formData.zip,
        country_code: 'US',
      };
      setAddressValidated(true);
      const orderItems = items.map(item => ({
        quantity: item.quantity * (item.seedlingsPerUnit || 1),
        weight_per_item: 0.5,
      }));
      await fetchRates(address, orderItems);
    }
  }, [shipEngineEnabled, addressValidated, formData, items, fetchRates]);

  // Handle address selected from autocomplete
  const handleAutocompleteSelect = useCallback(async (parsed: ParsedAddress) => {
    setFormData(prev => ({
      ...prev,
      address1: parsed.address_line1,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
    }));

    // Clear validation state
    setAddressValidated(false);
    setAddressWarningAcknowledged(false);
    clearValidation();
    clearRates();
    setSelectedShippingRate(null);
    setShowAddressSuggestion(false);

    // Clear address-related form errors
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.address1;
      delete newErrors.city;
      delete newErrors.state;
      delete newErrors.zip;
      return newErrors;
    });

    // Auto-fetch shipping rates if ShipEngine enabled and all fields present
    if (shipEngineEnabled && parsed.address_line1 && parsed.city && parsed.state && parsed.zip) {
      const address: ShippingAddress = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        address_line1: parsed.address_line1,
        address_line2: formData.address2 || undefined,
        city_locality: parsed.city,
        state_province: parsed.state,
        postal_code: parsed.zip,
        country_code: 'US',
      };

      // Mark as validated (autocomplete provides verified addresses)
      setAddressValidated(true);

      const orderItems = items.map(item => ({
        quantity: item.quantity * (item.seedlingsPerUnit || 1),
        weight_per_item: 0.5,
      }));
      await fetchRates(address, orderItems);
    }
  }, [formData.firstName, formData.lastName, formData.phone, formData.address2, shipEngineEnabled, items, clearValidation, clearRates, fetchRates]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;

    // Use address-specific handler for address fields
    if (['address1', 'address2', 'city', 'state', 'zip'].includes(name)) {
      handleAddressChange(e);
      return;
    }

    const { value } = e.target;
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

  const handleSelectSavedAddress = async (address: any) => {
    setSelectedAddressId(address.id);
    setFormData(prev => ({
      ...prev,
      firstName: address.first_name || prev.firstName,
      lastName: address.last_name || prev.lastName,
      company: address.company || '',
      address1: address.street || '',
      address2: address.unit || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.zip || '',
      shippingPhone: address.phone || profile?.phone || prev.shippingPhone,
    }));

    // Clear validation state for new address
    setAddressValidated(false);
    setAddressWarningAcknowledged(false);
    clearValidation();
    clearRates();
    setSelectedShippingRate(null);
    setShowAddressSuggestion(false);

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

    // Auto-fetch shipping rates for saved address
    if (shipEngineEnabled && address.street && address.city && address.state && address.zip) {
      const shippingAddress: ShippingAddress = {
        name: `${address.first_name || ''} ${address.last_name || ''}`.trim(),
        phone: address.phone,
        address_line1: address.street,
        address_line2: address.unit || undefined,
        city_locality: address.city,
        state_province: address.state,
        postal_code: address.zip,
        country_code: 'US'
      };

      setAddressValidated(true);
      const orderItems = items.map(item => ({
        quantity: item.quantity * (item.seedlingsPerUnit || 1),
        weight_per_item: 0.5,
      }));
      await fetchRates(shippingAddress, orderItems);
    }
  };

  // Parse "Insufficient stock for: Name (requested: X, available: Y), ..." from RPC error
  const parseStockError = (errorMsg: string): StockIssue[] => {
    const issues: StockIssue[] = [];
    const match = errorMsg.match(/Insufficient stock for:\s*(.+)/i);
    if (!match) return issues;

    // Split items by "), " pattern
    const itemParts = match[1].split(/\),\s*/);
    for (const part of itemParts) {
      const itemMatch = part.match(/(.+?)\s*\(requested:\s*(\d+),\s*available:\s*(\d+)/i);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        const cartItem = items.find(i => i.name === name);
        issues.push({
          productId: cartItem?.id || '',
          name,
          requested: parseInt(itemMatch[2], 10),
          available: parseInt(itemMatch[3], 10),
        });
      }
    }
    return issues;
  };

  // Check current stock levels for all cart items before order creation
  const validateStock = async (): Promise<StockIssue[]> => {
    const productIds = items.map(item => item.id);
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, quantity_available')
      .in('id', productIds);

    if (error || !products) {
      console.error('Stock validation query failed:', error);
      return [];
    }

    const issues: StockIssue[] = [];
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.id);
      const available = product?.quantity_available ?? 0;
      if (available < item.quantity) {
        issues.push({
          productId: item.id,
          name: product?.name || item.name,
          requested: item.quantity,
          available,
        });
      }
    }
    return issues;
  };

  // Handle "Remove Unavailable Items" from stock modal
  const handleRemoveUnavailable = () => {
    if (!onUpdateCart) {
      setShowStockModal(false);
      onBack();
      return;
    }

    const updatedItems = items
      .map(item => {
        const issue = stockIssues.find(i => i.productId === item.id);
        if (!issue) return item;
        if (issue.available === 0) return null;
        return { ...item, quantity: issue.available };
      })
      .filter((item): item is CartItem => item !== null);

    onUpdateCart(updatedItems);
    setShowStockModal(false);
    setStockIssues([]);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Base required fields for all orders
    const baseFields: (keyof CheckoutFormData)[] = ['email', 'phone', 'firstName', 'lastName'];

    // For shipping orders, also require address fields
    const requiredFields: (keyof CheckoutFormData)[] = deliveryMethod === 'shipping'
      ? [...baseFields, 'address1', 'city', 'state', 'zip']
      : baseFields;

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

    // ZIP validation (only if shipping)
    if (deliveryMethod === 'shipping' && formData.zip && !/^\d{5}(-\d{4})?$/.test(formData.zip)) {
      errors.zip = 'Please enter a valid ZIP code';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save cart snapshot to abandoned_carts for email recovery
  const saveAbandonedCart = useCallback(async () => {
    const email = formData.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || items.length === 0) {
      return;
    }
    try {
      const cartSnapshot = items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || null,
        category: item.category || null
      }));
      const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      await supabase
        .from('abandoned_carts')
        .upsert({
          session_id: abandonedCartSessionId,
          email,
          customer_id: user?.id || null,
          first_name: formData.firstName || null,
          cart_items: cartSnapshot,
          cart_total: cartTotal,
          item_count: itemCount
        }, { onConflict: 'session_id,email' });

      abandonedCartSavedRef.current = true;
    } catch (err) {
      // Non-critical — don't block checkout flow
      console.error('Failed to save abandoned cart:', err);
    }
  }, [formData.email, formData.firstName, items, abandonedCartSessionId, user?.id]);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions if order was already completed
    if (orderCompletedRef.current) {
      return;
    }

    try {
    setSubmitAttempted(true);
    setOrderError(null);

    if (hasPickupConflict) {
      setOrderError('Your cart contains items that must be picked up and items that cannot be picked up. Please remove one or the other to proceed.');
      return;
    }

    if (!validateForm()) {
      // Field-level errors are shown via submitAttempted flag, but they're at the
      // top of the form in the Contact section. If the user is scrolled down (e.g.,
      // after selecting pickup), they see nothing. Scroll to the form so errors
      // are visible.
      const formEl = document.querySelector('form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // Check stock levels before proceeding
    const issues = await validateStock();
    if (issues.length > 0) {
      setStockIssues(issues);
      setShowStockModal(true);
      return;
    }

    // For pickup orders, validate pickup selection
    if (deliveryMethod === 'pickup') {
      if (!selectedPickupLocationId || !selectedPickupSlot) {
        setOrderError('Please select a pickup location and time slot.');
        return;
      }
    } else {
      // For shipping orders, validate shipping requirements
      // Check if zone is blocked
      if (isZoneBlocked) {
        setOrderError('We cannot ship to this location. Please use a different shipping address.');
        return;
      }

      // Check if shipping method is selected (when rates are available)
      if (shipEngineEnabled && shippingRates.length > 0 && !selectedShippingRate) {
        setOrderError('Please select a shipping method.');
        return;
      }
    }

    // Validate growing system selection
    if (!growingSystem) {
      setOrderError('Please select your growing system.');
      return;
    }
    if (growingSystem === 'Other' && !growingSystemOther.trim()) {
      setOrderError('Please specify your growing system.');
      return;
    }

    // Ensure abandoned cart is captured before attempting order (covers autofill)
    if (!abandonedCartSavedRef.current) {
      await saveAbandonedCart();
    }

    // Build shipping details for order (only for shipping orders)
    const shippingDetails = (deliveryMethod === 'shipping' && selectedShippingRate) ? {
      shippingRateId: selectedShippingRate.rate_id,
      shippingCarrierId: selectedShippingRate.carrier_id,
      shippingServiceCode: selectedShippingRate.service_code,
      shippingMethodName: `${selectedShippingRate.carrier_friendly_name} ${selectedShippingRate.service_type}`,
      estimatedDeliveryDate: selectedShippingRate.estimated_delivery_date,
      addressValidated: addressValidated,
      addressOriginal: buildShippingAddress(),
      addressNormalized: normalizedAddress
    } : {};

    // Build pickup details for order (only for pickup orders)
    const pickupDetails = (deliveryMethod === 'pickup' && selectedPickupSlot && selectedPickupLocation) ? {
      isPickup: true,
      pickupLocationId: selectedPickupLocationId,
      pickupDate: selectedPickupSlot.slot_date,
      pickupTimeStart: selectedPickupSlot.start_time,
      pickupTimeEnd: selectedPickupSlot.end_time,
      pickupScheduleId: selectedPickupSlot.schedule_id
    } : { isPickup: false };

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
        shippingInfo: deliveryMethod === 'shipping' ? {
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          address1: formData.address1,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          country: formData.country,
          phone: formData.shippingPhone || formData.phone
        } : (deliveryMethod === 'pickup' && selectedPickupLocation) ? {
          // Pickup orders: shipping_address_line1 is NOT NULL in DB, use pickup location address
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          address1: selectedPickupLocation.address_line1,
          address2: selectedPickupLocation.address_line2 || '',
          city: selectedPickupLocation.city,
          state: selectedPickupLocation.state,
          zip: selectedPickupLocation.postal_code,
          country: 'US',
          phone: formData.phone
        } : null,
        shippingMethod: deliveryMethod === 'pickup' ? 'Local Pickup' : (selectedShippingRate?.service_type || 'Standard'),
        shippingCost: shippingCost,
        customerId: user?.id || null,
        paymentStatus: 'pending',
        saveAddress: deliveryMethod === 'shipping' && saveAddress,
        discountAmount: appliedCredit + bestDiscount,
        discountDescription: [
          bestDiscount > 0 ? activeDiscountLabel : '',
          appliedCredit > 0 ? 'Sproutify Seedling Credit' : ''
        ].filter(Boolean).join(', ') || undefined,
        promotionId: activePromo?.promotion_id || null,
        promotionCode: activePromo?.promotion_code || null,
        customerNotes: customerNotes.trim() || null,
        growingSystem: growingSystem === 'Other' ? growingSystemOther.trim() : growingSystem,
        tax,
        taxRateApplied: taxResult.taxRate,
        taxNote: taxResult.taxNote,
        ...shippingDetails,
        ...pickupDetails
      });

      if (!result.success || !result.order) {
        const errorMsg = result.error || 'Failed to create order. Please try again.';
        // If RPC caught insufficient stock (pre-check was bypassed), show the modal
        if (errorMsg.toLowerCase().includes('insufficient stock')) {
          const parsed = parseStockError(errorMsg);
          if (parsed.length > 0) {
            setStockIssues(parsed);
            setShowStockModal(true);
            return;
          }
        }
        setOrderError(errorMsg);
        return;
      }

      // Create payment intent with pre-discount total — the edge function
      // verifies the credit and discount server-side before charging Stripe
      const paymentResult = await createPaymentIntent({
        amount: subtotal + shippingCost + tax,
        customerEmail: formData.email,
        orderId: result.order.id,
        metadata: {
          orderNumber: result.order.order_number
        },
        discountAmount: appliedCredit > 0 ? appliedCredit : undefined,
        discountDescription: appliedCredit > 0 ? 'Sproutify Seedling Credit' : undefined,
        lifetimeDiscount: bestDiscount > 0 ? bestDiscount : undefined
      });

      if (!paymentResult) {
        setOrderError(paymentError || 'Failed to initialize payment. Please try again.');
        return;
      }

      setPendingOrderId(result.order.id);
      pendingOrderItemsRef.current = result.order.items || [];
      setClientSecret(paymentResult.clientSecret);
      setPaymentStep('payment');
    } else {
      // Test mode - create order without payment
      await completeOrder();
    }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setOrderError(err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const completeOrder = async () => {
    // Build shipping details for order (only for shipping orders)
    const shippingDetails = (deliveryMethod === 'shipping' && selectedShippingRate) ? {
      shippingRateId: selectedShippingRate.rate_id,
      shippingCarrierId: selectedShippingRate.carrier_id,
      shippingServiceCode: selectedShippingRate.service_code,
      shippingMethodName: `${selectedShippingRate.carrier_friendly_name} ${selectedShippingRate.service_type}`,
      estimatedDeliveryDate: selectedShippingRate.estimated_delivery_date,
      addressValidated: addressValidated,
      addressOriginal: buildShippingAddress(),
      addressNormalized: normalizedAddress
    } : {};

    // Build pickup details for order (only for pickup orders)
    const pickupDetails = (deliveryMethod === 'pickup' && selectedPickupSlot && selectedPickupLocation) ? {
      isPickup: true,
      pickupLocationId: selectedPickupLocationId,
      pickupDate: selectedPickupSlot.slot_date,
      pickupTimeStart: selectedPickupSlot.start_time,
      pickupTimeEnd: selectedPickupSlot.end_time,
      pickupScheduleId: selectedPickupSlot.schedule_id
    } : { isPickup: false };

    // Create the order in Supabase
    const result = await createOrder({
      cartItems: items,
      customerInfo: {
        email: formData.email,
        phone: formData.phone,
        firstName: formData.firstName,
        lastName: formData.lastName
      },
      shippingInfo: deliveryMethod === 'shipping' ? {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        address1: formData.address1,
        address2: formData.address2,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        country: formData.country,
        phone: formData.shippingPhone || formData.phone
      } : (deliveryMethod === 'pickup' && selectedPickupLocation) ? {
        // Pickup orders: shipping_address_line1 is NOT NULL in DB, use pickup location address
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        address1: selectedPickupLocation.address_line1,
        address2: selectedPickupLocation.address_line2 || '',
        city: selectedPickupLocation.city,
        state: selectedPickupLocation.state,
        zip: selectedPickupLocation.postal_code,
        country: 'US',
        phone: formData.phone
      } : null,
      shippingMethod: deliveryMethod === 'pickup' ? 'Local Pickup' : (selectedShippingRate?.service_type || 'Standard'),
      shippingCost: shippingCost,
      customerId: user?.id || null,
      saveAddress: deliveryMethod === 'shipping' && saveAddress,
      discountAmount: appliedCredit + bestDiscount,
      discountDescription: [
        bestDiscount > 0 ? activeDiscountLabel : '',
        appliedCredit > 0 ? 'Sproutify Seedling Credit' : ''
      ].filter(Boolean).join(', ') || undefined,
      promotionId: activePromo?.promotion_id || null,
      promotionCode: activePromo?.promotion_code || null,
      customerNotes: customerNotes.trim() || null,
      growingSystem: growingSystem === 'Other' ? growingSystemOther.trim() : growingSystem,
      tax,
      taxRateApplied: taxResult.taxRate,
      taxNote: taxResult.taxNote,
      ...shippingDetails,
      ...pickupDetails
    });

    if (result.success && result.order) {
      await handleOrderSuccess(result.order);
    } else {
      const errorMsg = result.error || 'Failed to create order. Please try again.';
      if (errorMsg.toLowerCase().includes('insufficient stock')) {
        const parsed = parseStockError(errorMsg);
        if (parsed.length > 0) {
          setStockIssues(parsed);
          setShowStockModal(true);
          return;
        }
      }
      setOrderError(errorMsg);
    }
  };

  const handleOrderSuccess = async (order: any) => {
    // IMMEDIATELY clear cart from localStorage to prevent duplicates on back navigation
    localStorage.removeItem('atl-urban-farms-cart');
    localStorage.removeItem('cart');
    try { sessionStorage.removeItem('atluf_promo_code'); } catch {}
    orderCompletedRef.current = true;

    // Mark abandoned cart as converted so no reminder is sent
    if (abandonedCartSavedRef.current) {
      try {
        await supabase
          .from('abandoned_carts')
          .update({ converted_at: new Date().toISOString() })
          .eq('session_id', abandonedCartSessionId)
          .eq('email', formData.email.trim());
      } catch (err) {
        console.error('Failed to mark abandoned cart as converted:', err);
      }
    }

    // Redeem seedling credit if applied
    if (appliedCredit > 0) {
      try {
        const redeemed = await redeemCredit(order.id || order.order_id || pendingOrderId);
        // Log redemption to seedling_credit_log for admin visibility
        await supabase.from('seedling_credit_log').insert({
          action: 'redeem',
          customer_email: formData.email,
          credit_amount: appliedCredit,
          order_id: order.id || order.order_id || pendingOrderId,
          order_number: order.order_number,
          status: redeemed ? 'success' : 'failed',
        });
      } catch (e) {
        console.error('Failed to redeem seedling credit:', e);
        // Don't block order flow
      }
    }

    // Promotion usage is recorded by createOrder when promotionId is passed

    // Prepare order data for confirmation page
    const orderData: OrderData = {
      order_number: order.order_number,
      items: order.items,
      customerFirstName: formData.firstName,
      customerEmail: formData.email,
      shippingAddress: deliveryMethod === 'shipping' ? {
        name: `${formData.firstName} ${formData.lastName}`,
        address: formData.address2
          ? `${formData.address1}, ${formData.address2}`
          : formData.address1,
        city: formData.city,
        state: formData.state,
        zip: formData.zip
      } : null,
      pickupInfo: (deliveryMethod === 'pickup' && selectedPickupLocation && selectedPickupSlot) ? {
        locationName: selectedPickupLocation.name,
        address: `${selectedPickupLocation.address_line1}, ${selectedPickupLocation.city}, ${selectedPickupLocation.state} ${selectedPickupLocation.postal_code}`,
        date: formatPickupDate(selectedPickupSlot.slot_date),
        timeRange: `${formatPickupTime(selectedPickupSlot.start_time)} - ${formatPickupTime(selectedPickupSlot.end_time)}`,
        instructions: selectedPickupLocation.instructions
      } : undefined,
      totals: {
        subtotal,
        shipping: shippingCost,
        tax,
        total
      },
      isGuest: !user,
      isPickup: deliveryMethod === 'pickup',
      shippingMethodName: selectedShippingRate
        ? `${selectedShippingRate.carrier_friendly_name} ${selectedShippingRate.service_type}`
        : undefined,
      estimatedDeliveryDate: selectedShippingRate?.estimated_delivery_date || null,
      packageBreakdown: packageBreakdown || null
    };

    // Send order confirmation email
    // NOTE: Admin order creation (OrderCreatePage.tsx) has a parallel email flow — keep both in sync
    try {
      await sendOrderConfirmation(formData.email, {
        orderNumber: order.order_number,
        customerName: formData.firstName,
        items: order.items,
        subtotal,
        shipping: shippingCost,
        tax,
        total,
        shippingAddress: orderData.shippingAddress,
        pickupInfo: orderData.pickupInfo,
        shippingMethodName: selectedShippingRate
          ? `${selectedShippingRate.carrier_friendly_name} ${selectedShippingRate.service_type}`
          : undefined,
        estimatedDeliveryDate: selectedShippingRate?.estimated_delivery_date
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't block the order flow if email fails
    }

    // Save newsletter preference (non-blocking)
    try {
      if (growingTipsOptIn) {
        await submitNewsletterPreference({
          email: formData.email,
          firstName: formData.firstName,
          customerId: user?.id || null,
          source: 'checkout',
          status: 'active',
          tags: ['checkout-optin'],
        });
      }
    } catch (err) {
      console.error('Newsletter preference save failed:', err);
      // Don't block the order flow
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
        // Attach items saved before payment (orders table doesn't have items)
        order.items = pendingOrderItemsRef.current;
        await handleOrderSuccess(order);
      }
    }
  };

  const handlePaymentError = (error: string) => {
    setOrderError(error);
  };

  const getInputClassName = (fieldName: string) => {
    const baseClass = "w-full px-6 py-4 bg-gray-50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-gray-300";
    const errorClass = formErrors[fieldName] && submitAttempted
      ? "border-red-300 bg-red-50/50"
      : "border-gray-100";
    return `${baseClass} ${errorClass}`;
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-site flex items-center justify-center">
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
    <div className="min-h-screen bg-site">
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
            <form onSubmit={handleSubmit} noValidate>

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

                {/* Name: read-only display for logged-in users, editable for guests */}
                {user && profile?.first_name ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl mb-4">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">{profile.first_name} {profile.last_name || ''}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={saveAbandonedCart}
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

              {/* Pickup conflict warning */}
              {hasPickupConflict && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <h3 className="text-xl font-heading font-extrabold text-gray-900">Delivery Method</h3>
                  </div>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="font-bold text-red-900 text-sm">Fulfillment Conflict</p>
                    <p className="text-red-700 text-sm mt-1">
                      Your cart contains items that must be picked up and items that cannot be picked up.
                      Please remove one or the other to proceed.
                    </p>
                  </div>
                  <hr className="my-10 border-gray-100" />
                </motion.section>
              )}

              {/* Must pickup notice */}
              {hasMustPickup && !hasPickupConflict && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <h3 className="text-xl font-heading font-extrabold text-gray-900">Delivery Method</h3>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <p className="font-bold text-amber-900 text-sm">Local Pickup Required</p>
                    <p className="text-amber-700 text-sm mt-1">
                      Your cart contains items that require local pickup. This order will be available for pickup only.
                    </p>
                  </div>
                  <hr className="my-10 border-gray-100" />
                </motion.section>
              )}

              {/* Shipping only notice (when pickup locations exist but all items cannot be picked up) */}
              {allCannotPickup && hasPickupLocations && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <h3 className="text-xl font-heading font-extrabold text-gray-900">Delivery Method</h3>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                    <p className="font-bold text-blue-900 text-sm">Shipping Only</p>
                    <p className="text-blue-700 text-sm mt-1">
                      All items in your cart require shipping and are not available for local pickup.
                    </p>
                  </div>
                  <hr className="my-10 border-gray-100" />
                </motion.section>
              )}

              {/* Delivery Method Selector - shown when both options are available */}
              {hasPickupLocations && !allCannotPickup && !hasMustPickup && !hasPickupConflict && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <h3 className="text-xl font-heading font-extrabold text-gray-900">Delivery Method</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMethod('shipping');
                        setSelectedPickupLocationId(null);
                        setSelectedPickupSlot(null);
                      }}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${
                        deliveryMethod === 'shipping'
                          ? 'border-emerald-600 bg-emerald-50/30'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          deliveryMethod === 'shipping'
                            ? 'border-emerald-600'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'shipping' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <span className="font-bold text-gray-900">Ship to Address</span>
                          </div>
                          <p className="text-sm text-gray-500">We'll ship your order to your address</p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMethod('pickup');
                        setSelectedShippingRate(null);
                        clearRates();
                        clearValidation();
                        setAddressValidated(false);
                      }}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${
                        deliveryMethod === 'pickup'
                          ? 'border-emerald-600 bg-emerald-50/30'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          deliveryMethod === 'pickup'
                            ? 'border-emerald-600'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'pickup' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-bold text-gray-900">Local Pickup</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">FREE</span>
                          </div>
                          <p className="text-sm text-gray-500">Pick up from one of our locations</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <hr className="my-10 border-gray-100" />
                </motion.section>
              )}

              {/* Local Pickup Selection (when pickup is selected) */}
              {deliveryMethod === 'pickup' && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">{hasPickupLocations ? '3' : '2'}</span>
                    <h3 className="text-xl font-heading font-extrabold text-gray-900">Pickup Location & Time</h3>
                  </div>

                  {/* Location Selection */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 block">
                      Select Location
                    </label>
                    {pickupLocationsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pickupLocations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => {
                              setSelectedPickupLocationId(location.id);
                              setSelectedPickupSlot(null);
                            }}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                              selectedPickupLocationId === location.id
                                ? 'border-emerald-600 bg-emerald-50/30'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                selectedPickupLocationId === location.id
                                  ? 'border-emerald-600'
                                  : 'border-gray-300'
                              }`}>
                                {selectedPickupLocationId === location.id && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900">{location.name}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                  {location.address_line1}
                                  {location.address_line2 && `, ${location.address_line2}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {location.city}, {location.state} {location.postal_code}
                                </p>
                                {location.phone && (
                                  <p className="text-sm text-gray-400 mt-1">{location.phone}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time Slot Selection */}
                  {selectedPickupLocationId && (
                    <div className="space-y-4 mt-6">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 block">
                        Select Pickup Time
                      </label>
                      {pickupSlotsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                        </div>
                      ) : pickupSlots.length === 0 ? (
                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                          <svg className="w-10 h-10 text-amber-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-amber-800 font-medium">No pickup times available</p>
                          <p className="text-amber-600 text-sm mt-1">Please check back later or try a different location</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Array.from(groupSlotsByDate(pickupSlots)).map(([date, slots]) => (
                            <div key={date}>
                              <p className="text-sm font-bold text-gray-700 mb-2">{formatPickupDate(date)}</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {slots.map((slot) => (
                                  <button
                                    key={`${slot.schedule_id}-${slot.slot_date}`}
                                    type="button"
                                    onClick={() => setSelectedPickupSlot(slot)}
                                    disabled={slot.slots_available <= 0}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                                      selectedPickupSlot?.schedule_id === slot.schedule_id &&
                                      selectedPickupSlot?.slot_date === slot.slot_date
                                        ? 'border-emerald-600 bg-emerald-50/30'
                                        : slot.slots_available <= 0
                                          ? 'border-gray-100 bg-gray-100 opacity-50 cursor-not-allowed'
                                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                    }`}
                                  >
                                    <p className="font-bold text-gray-900 text-sm">
                                      {formatPickupTime(slot.start_time)} - {formatPickupTime(slot.end_time)}
                                    </p>
                                    {slot.max_orders && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {slot.slots_available > 0
                                          ? `${slot.slots_available} spots left`
                                          : 'Full'}
                                      </p>
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

                  {/* Pickup Instructions */}
                  {selectedPickupLocation?.instructions && selectedPickupSlot && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 mt-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="font-bold text-blue-900 text-sm">Pickup Instructions</p>
                          <p className="text-blue-700 text-sm mt-1">{selectedPickupLocation.instructions}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <hr className="my-10 border-gray-100" />
                </motion.section>
              )}

              {/* Shipping Address (only for shipping delivery method) */}
              {deliveryMethod === 'shipping' && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">{hasPickupLocations ? '3' : '2'}</span>
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

                {/* Company (Optional) */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Company (Optional)
                  </label>
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    type="text"
                    placeholder="Business or school name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>

                {/* Address Line 1 - Autocomplete */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Address <span className="text-red-400">*</span>
                  </label>
                  <AddressAutocomplete
                    value={formData.address1}
                    onChange={(value) => {
                      handleAddressChange({ target: { name: 'address1', value } } as React.ChangeEvent<HTMLInputElement>);
                    }}
                    onAddressSelect={handleAutocompleteSelect}
                    placeholder="Start typing your address..."
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
                      onBlur={handleZipBlur}
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

                {/* Shipping Phone */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Recipient Phone <span className="text-gray-300">(optional)</span>
                  </label>
                  <input
                    name="shippingPhone"
                    value={formData.shippingPhone}
                    onChange={handleInputChange}
                    type="tel"
                    placeholder="(404) 555-0123"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                  <p className="text-xs text-gray-400">Phone number for shipping carrier delivery notifications</p>
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
                          : 'border-gray-800 hover:border-emerald-400'
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
              )}

              <hr className="my-10 border-gray-100" />

              {/* Shipping Method - only show for shipping delivery method */}
              {deliveryMethod === 'shipping' && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">{hasPickupLocations ? '4' : '3'}</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Shipping Method</h3>
                </div>

                {/* ShipEngine enabled - show dynamic rates */}
                {shipEngineEnabled ? (
                  <>
                    {/* Show message if address not validated yet */}
                    {!addressValidated && (
                      <div className="p-6 rounded-[2rem] border-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-4 text-gray-500">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-sm font-medium">
                            Please enter your shipping address above to see available shipping options.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Loading rates */}
                    {fetchingRates && (
                      <div className="p-6 rounded-[2rem] border-2 border-gray-100 bg-gray-50 text-center">
                        <p className="text-gray-500 font-medium text-sm">Calculating...</p>
                      </div>
                    )}

                    {/* Zone Blocked Error */}
                    {isZoneBlocked && zoneInfo && (
                      <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-200">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-bold text-red-800 mb-1">Unable to Ship to This Location</h4>
                            <p className="text-sm text-red-700">{zoneInfo.message}</p>
                            <p className="text-xs text-red-600 mt-2">
                              Please use a different shipping address or contact us for assistance.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Zone Conditional Warning */}
                    {!isZoneBlocked && zoneInfo && zoneInfo.status === 'conditional' && zoneInfo.message && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-amber-800">{zoneInfo.message}</p>
                            {zoneInfo.conditions?.max_transit_days && (
                              <p className="text-xs text-amber-600 mt-1">
                                Only shipping options with {zoneInfo.conditions.max_transit_days} day{zoneInfo.conditions.max_transit_days > 1 ? 's' : ''} or faster delivery are available.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rates error (non-zone related) */}
                    {ratesError && addressValidated && !isZoneBlocked && (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className="font-bold">Unable to fetch shipping rates</p>
                            <p>{ratesError}</p>
                            <button
                              type="button"
                              onClick={handleValidateAddress}
                              disabled={fetchingRates}
                              className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {fetchingRates ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show rates */}
                    {addressValidated && !fetchingRates && shippingRates.length > 0 && (() => {
                      // Determine cheapest and fastest rates for badges
                      const cheapestId = shippingRates[0]?.rate_id; // Already sorted cheapest-first
                      const fastestRate = shippingRates.reduce<ShippingRate | null>((fastest, rate) => {
                        if (rate.delivery_days == null) return fastest;
                        if (!fastest || fastest.delivery_days == null) return rate;
                        return rate.delivery_days < fastest.delivery_days ? rate : fastest;
                      }, null);
                      const fastestId = fastestRate?.rate_id;
                      // Only show "Fastest" badge if it's a different rate than cheapest
                      const showFastestBadge = fastestId && fastestId !== cheapestId;

                      return (
                      <div className="grid grid-cols-1 gap-3">
                        {shippingRates.map((rate) => {
                          const isCheapest = rate.rate_id === cheapestId;
                          const isFastest = showFastestBadge && rate.rate_id === fastestId;

                          return (
                          <button
                            key={rate.rate_id}
                            type="button"
                            onClick={() => setSelectedShippingRate({
                              rate_id: rate.rate_id,
                              carrier_id: rate.carrier_id,
                              carrier_code: rate.carrier_code,
                              carrier_friendly_name: rate.carrier_friendly_name,
                              service_code: rate.service_code,
                              service_type: rate.service_type,
                              shipping_amount: rate.shipping_amount,
                              delivery_days: rate.delivery_days,
                              estimated_delivery_date: rate.estimated_delivery_date
                            })}
                            className={`p-5 rounded-2xl border-2 text-left transition-all ${
                              selectedShippingRate?.rate_id === rate.rate_id
                                ? 'border-emerald-600 bg-emerald-50/30'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-start gap-3">
                                {shippingRates.length > 1 && (
                                <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedShippingRate?.rate_id === rate.rate_id
                                    ? 'border-emerald-600'
                                    : 'border-gray-300'
                                }`}>
                                  {selectedShippingRate?.rate_id === rate.rate_id && (
                                    <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></div>
                                  )}
                                </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-bold text-gray-900">{rate.carrier_friendly_name}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-700">{rate.service_type}</span>
                                    {shippingRates.length > 1 && isCheapest && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                                        Cheapest
                                      </span>
                                    )}
                                    {shippingRates.length > 1 && isFastest && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                                        Fastest
                                      </span>
                                    )}
                                  </div>
                                  {defaultShipDay != null && weeklyCutoffDay != null && weeklyCutoffTime && (
                                    <p className="mt-1.5">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Ships {getNextShipDate(
                                          Number(weeklyCutoffDay),
                                          String(weeklyCutoffTime),
                                          Number(defaultShipDay)
                                        ).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-emerald-600 font-black text-lg">
                                ${rate.shipping_amount.toFixed(2)}
                              </span>
                            </div>
                          </button>
                          );
                        })}

                        {/* Package breakdown info */}
                        {packageBreakdown && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              <span className="font-medium">{packageBreakdown.summary}</span>
                            </div>
                            {packageBreakdown.total_packages > 1 && (
                              <div className="mt-2 text-xs text-slate-500">
                                {packageBreakdown.packages.map((pkg, idx) => (
                                  <span key={idx}>
                                    {idx > 0 && ', '}
                                    {pkg.name} ({pkg.item_count} {pkg.item_count === 1 ? 'item' : 'items'})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* No rates available (not due to zone block) */}
                    {addressValidated && !fetchingRates && shippingRates.length === 0 && !ratesError && !isZoneBlocked && (
                      <div className="p-6 rounded-[2rem] border-2 border-amber-200 bg-amber-50/50">
                        <div className="flex items-center gap-4 text-amber-700">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-sm font-medium">
                            No shipping options available for this address. Please verify your address or contact support.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Fallback - static message when ShipEngine is not enabled */
                  <div className="p-6 rounded-[2rem] border-2 border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-4 text-gray-600">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                      <div>
                        <p className="font-bold text-gray-900">Standard Shipping</p>
                        <p className="text-sm">Shipping rates will be calculated at checkout completion.</p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {customerShippingMessage || SHIPPING_NOTICE}
                </p>
              </motion.section>
              )}

              {/* Growing System Section */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-10 space-y-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {deliveryMethod === 'pickup' ? (hasPickupLocations ? '4' : '3') : (hasPickupLocations ? '5' : '4')}
                  </span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Growing System</h3>
                </div>
                <p className="text-sm text-gray-500">To help us support you better, what growing system are you using?</p>
                <div className="relative">
                  <select
                    value={growingSystem}
                    onChange={(e) => {
                      setGrowingSystem(e.target.value);
                      if (e.target.value !== 'Other') setGrowingSystemOther('');
                    }}
                    className={`w-full bg-white border-2 rounded-2xl px-4 pr-10 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all appearance-none cursor-pointer ${
                      submitAttempted && !growingSystem ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select your growing system...</option>
                    {growingSystemOptions.map((system) => (
                      <option key={system} value={system}>{system}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                {submitAttempted && !growingSystem && (
                  <p className="text-sm text-red-500">Please select your growing system</p>
                )}
                {growingSystem === 'Other' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={growingSystemOther}
                      onChange={(e) => setGrowingSystemOther(e.target.value)}
                      placeholder="Please specify your growing system"
                      maxLength={100}
                      className={`w-full bg-white border-2 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all ${
                        submitAttempted && !growingSystemOther.trim() ? 'border-red-300' : 'border-gray-200'
                      }`}
                    />
                    {submitAttempted && !growingSystemOther.trim() && (
                      <p className="text-sm text-red-500 mt-1">Please specify your growing system</p>
                    )}
                  </div>
                )}
              </motion.section>

              {/* Order Notes Section */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-10"
              >
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <label htmlFor="customer-notes" className="text-base font-bold text-amber-900">
                      Order Notes
                    </label>
                    <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    Special delivery instructions, plant care requests, or anything we should know about your order.
                  </p>
                  <textarea
                    id="customer-notes"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    rows={3}
                    maxLength={500}
                    className="w-full bg-white border-2 border-amber-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 resize-none text-sm transition-all"
                  />
                  <p className="text-xs text-amber-500 mt-1.5 text-right">{customerNotes.length}/500</p>
                </div>
              </motion.section>

              {/* Growing Tips Opt-in */}
              <label className="flex items-center gap-3 mt-6 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={growingTipsOptIn}
                    onChange={(e) => setGrowingTipsOptIn(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-gray-200 rounded-md peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all group-hover:border-gray-300" />
                  <svg
                    className="absolute inset-0 m-auto w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                  Send me growing tips and seasonal updates
                </span>
              </label>

              <hr className="my-10 border-gray-100" />

              {/* Payment Section */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {deliveryMethod === 'pickup' ? (hasPickupLocations ? '5' : '4') : (hasPickupLocations ? '6' : '5')}
                  </span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Payment</h3>
                </div>

                {/* Show Stripe payment form if we have a client secret */}
                {paymentStep === 'payment' && clientSecret ? (
                  <div className="p-6 rounded-[2rem] border-2 border-emerald-200 bg-emerald-50/30">
                    <p className="text-xs text-gray-400 mb-4">We accept US credit and debit cards only.</p>
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
                        <p className="text-xs text-gray-400 mt-2">We accept US credit and debit cards only.</p>
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

              {/* Order Error (non-stock errors only; stock errors use the modal) */}
              {orderError && (
                <motion.div
                  ref={orderErrorRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{item.name} ({item.quantity})</h4>
                        <p className="text-xs text-gray-400 font-medium">{item.category || 'Plant'}</p>
                        {item.bundleItems && item.bundleItems.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.bundleItems.map((bi, idx) => (
                              <p key={idx} className="text-[11px] text-gray-400">
                                {bi.quantity > 1 ? `${bi.quantity}x ` : ''}{bi.name}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.compareAtPrice != null && item.compareAtPrice > item.price ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400 line-through">${(item.compareAtPrice * item.quantity).toFixed(2)}</span>
                            <span className="text-sm font-black text-red-500">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ) : (
                          <p className="text-sm font-black text-emerald-600 mt-0.5">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code Section */}
                <div className="py-4 border-t border-gray-100">
                  {appliedManualPromo?.valid ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>"{appliedManualPromo.promotion_code}" applied</span>
                      </div>
                      <button
                        onClick={handleRemoveManualPromo}
                        className="text-xs text-emerald-600 hover:text-red-500 font-bold transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => setManualPromoExpanded(!manualPromoExpanded)}
                        className="text-sm text-gray-500 hover:text-emerald-600 font-medium transition-colors flex items-center gap-1.5"
                      >
                        Have a promo code?
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-3 h-3 transition-transform ${manualPromoExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      {manualPromoExpanded && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualPromoCode}
                              onChange={(e) => setManualPromoCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyManualPromo(); } }}
                              placeholder="Enter code"
                              disabled={manualPromoLoading}
                              className="flex-1 px-4 py-3 text-sm bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-gray-300 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={handleApplyManualPromo}
                              disabled={manualPromoLoading || !manualPromoCode.trim()}
                              className="px-5 py-3 text-sm font-bold bg-emerald-600 text-white rounded-2xl transition-all hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {manualPromoLoading ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : 'Apply'}
                            </button>
                          </div>
                          {manualPromoError && (
                            <p className="text-xs text-red-500 font-medium">{manualPromoError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="space-y-3 pt-6 border-t border-gray-100">
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Subtotal</span>
                    <span className="font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>{deliveryMethod === 'pickup' ? 'Pickup' : 'Shipping'}</span>
                    <span className="font-bold">
                      {deliveryMethod === 'pickup' ? (
                        <span className="text-emerald-600">FREE</span>
                      ) : fetchingRates ? (
                        <span className="text-gray-400">Calculating...</span>
                      ) : promoFreeShipping ? (
                        <span className="text-emerald-600">FREE</span>
                      ) : shippingCost > 0 ? (
                        `$${shippingCost.toFixed(2)}`
                      ) : shipEngineEnabled && !addressValidated ? (
                        <span className="text-gray-400">Enter address</span>
                      ) : (
                        <span className="text-gray-400">Select method</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>{taxResult.taxLabel}</span>
                    <span className="font-bold">${tax.toFixed(2)}</span>
                  </div>
                  {bestDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 text-sm">
                      <span>{activeDiscountLabel}</span>
                      <span className="font-bold">-${bestDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {appliedCredit > 0 && (
                    <div className="flex justify-between text-emerald-600 text-sm">
                      <span>Sproutify Credit</span>
                      <span className="font-bold">-${appliedCredit.toFixed(2)}</span>
                    </div>
                  )}
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

      {/* Insufficient Stock Modal */}
      <InsufficientStockModal
        isOpen={showStockModal}
        stockIssues={stockIssues}
        onClose={() => setShowStockModal(false)}
        onUpdateCart={() => {
          setShowStockModal(false);
          onBack();
        }}
        onRemoveUnavailable={handleRemoveUnavailable}
      />
    </div>
  );
};

export default CheckoutPage;
