import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAttributionOptions } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category?: string;
}

interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  discount?: number;
  discountDescription?: string;
}

interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface PickupInfo {
  locationName: string;
  address: string;
  date: string;
  timeRange: string;
  instructions?: string;
}

interface PackageBreakdown {
  total_packages: number;
  packages: Array<{ name: string; item_count: number }>;
  summary: string;
}

interface OrderConfirmationPageProps {
  items: OrderItem[];
  customerFirstName: string;
  customerEmail: string;
  shippingAddress: ShippingAddress | null;
  pickupInfo?: PickupInfo;
  totals: OrderTotals;
  orderId?: string;
  orderNumber?: string;
  isGuest?: boolean;
  isPickup?: boolean;
  shippingMethodName?: string;
  estimatedDeliveryDate?: string | null;
  packageBreakdown?: PackageBreakdown | null;
  onContinueShopping: () => void;
  onCreateAccount?: () => void;
  onViewOrders?: () => void;
}

const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  items,
  customerFirstName,
  customerEmail,
  shippingAddress,
  pickupInfo,
  totals,
  orderId,
  orderNumber: providedOrderNumber,
  isGuest = true,
  isPickup = false,
  shippingMethodName,
  estimatedDeliveryDate,
  packageBreakdown,
  onContinueShopping,
  onCreateAccount,
  onViewOrders
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [attributionValue, setAttributionValue] = useState('');
  const [attributionOtherText, setAttributionOtherText] = useState('');
  const [attributionSubmitted, setAttributionSubmitted] = useState(false);
  const [attributionSaving, setAttributionSaving] = useState(false);
  const { options: attributionOptions, loading: attributionLoading } = useAttributionOptions();

  // Generate order number once on mount
  const orderNumber = useMemo(() => {
    return providedOrderNumber || `ATL-${Math.floor(10000 + Math.random() * 90000)}`;
  }, [providedOrderNumber]);

  // Use real delivery estimate from ShipEngine when available, fallback to 5-7 business days
  const estimatedArrival = useMemo(() => {
    if (estimatedDeliveryDate) {
      const date = new Date(estimatedDeliveryDate);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Fallback: 5-7 business days
    const today = new Date();
    const startDate = new Date(today);
    const endDate = new Date(today);

    let daysAdded = 0;
    while (daysAdded < 5) {
      startDate.setDate(startDate.getDate() + 1);
      if (startDate.getDay() !== 0 && startDate.getDay() !== 6) {
        daysAdded++;
      }
    }

    daysAdded = 0;
    while (daysAdded < 7) {
      endDate.setDate(endDate.getDate() + 1);
      if (endDate.getDay() !== 0 && endDate.getDay() !== 6) {
        daysAdded++;
      }
    }

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }, [estimatedDeliveryDate]);

  // Stop confetti after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Generate confetti items
  const confettiItems = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 10 + 4,
      color: ['#10B981', '#34D399', '#8B5CF6', '#EC4899', '#FBBF24'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 2,
      duration: Math.random() * 2 + 3,
      rotation: Math.random() * 360
    }));
  }, []);

  const handleAttributionSubmit = async () => {
    if (!attributionValue) return;

    setAttributionSaving(true);
    try {
      // Find the selected option to get the label
      const selectedOption = attributionOptions.find(opt => opt.value === attributionValue);

      const { error } = await supabase
        .from('order_attributions')
        .insert({
          order_id: orderId || null,
          order_number: orderNumber,
          source: attributionValue,
          source_label: selectedOption?.label || attributionValue,
          other_text: attributionValue === 'other' ? attributionOtherText : null
        });

      if (error) {
        console.error('Attribution save error:', error);
      }
    } catch (err) {
      console.error('Attribution save error:', err);
    } finally {
      setAttributionSaving(false);
      setAttributionSubmitted(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <div className="min-h-screen bg-site relative overflow-hidden pb-24">
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[110]">
            {confettiItems.map((c) => (
              <motion.div
                key={c.id}
                initial={{
                  left: `${c.x}%`,
                  top: '-5%',
                  opacity: 1,
                  rotate: 0,
                  scale: 0
                }}
                animate={{
                  top: '110%',
                  rotate: c.rotation + 720,
                  opacity: [1, 1, 0],
                  scale: [0, 1, 0.5]
                }}
                transition={{
                  duration: c.duration,
                  delay: c.delay,
                  ease: 'linear'
                }}
                className="absolute"
                style={{
                  width: c.size,
                  height: c.size,
                  backgroundColor: c.color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px'
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 pt-16 md:pt-24 relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-10"
        >
          {/* Success Header */}
          <motion.div variants={itemVariants} className="text-center space-y-6">
            {/* Animated Success Icon */}
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  damping: 12,
                  stiffness: 200,
                  delay: 0.2
                }}
                className="w-28 h-28 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200/50"
              >
                <svg className="w-14 h-14 text-emerald-600" viewBox="0 0 24 24" fill="none">
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
              {/* Pulse ring */}
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 bg-emerald-400/30 rounded-full -z-10"
              />
            </div>

            {/* Heading */}
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-heading font-black text-gray-900">
                Order Confirmed!
              </h1>
              <p className="text-xl text-gray-500 font-medium">
                Thank you, {customerFirstName || 'Urban Farmer'}!
              </p>
            </div>

            {/* Order Number Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Order
              </span>
              <span className="text-sm font-black text-emerald-600">
                #{orderNumber}
              </span>
            </div>
          </motion.div>

          {/* Info Cards Row */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Card - Different for Pickup vs Shipping */}
            {isPickup && pickupInfo ? (
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-lg shadow-gray-100/50">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                    Pickup Scheduled
                  </p>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">
                    Ready for pickup!
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    We'll send a confirmation to
                    <br /><span className="font-bold text-gray-900 break-all">{customerEmail}</span>
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Pickup Location
                      </p>
                      <p className="text-sm font-bold text-gray-900">{pickupInfo.locationName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Pickup Time
                      </p>
                      <p className="text-sm font-bold text-gray-900">{pickupInfo.date}</p>
                      <p className="text-sm text-gray-600">{pickupInfo.timeRange}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-lg shadow-gray-100/50">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                    Shipping Update
                  </p>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">
                    We'll email you at
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    <span className="font-bold text-gray-900 break-all">{customerEmail}</span>
                    <br />when your order ships.
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {shippingMethodName && (
                    <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          Ships Via
                        </p>
                        <p className="text-sm font-bold text-gray-900">{shippingMethodName}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Ship Date
                      </p>
                      <p className="text-sm font-bold text-gray-900">{estimatedArrival}</p>
                    </div>
                  </div>
                  {packageBreakdown && packageBreakdown.total_packages > 0 && (
                    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Packages
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {packageBreakdown.total_packages === 1
                            ? `1 box (${packageBreakdown.packages[0]?.name})`
                            : `${packageBreakdown.total_packages} boxes`}
                        </p>
                        {packageBreakdown.total_packages > 1 && (
                          <p className="text-xs text-gray-500">
                            {packageBreakdown.packages.map((pkg, idx) => (
                              <span key={idx}>
                                {idx > 0 && ', '}
                                {pkg.name} ({pkg.item_count} {pkg.item_count === 1 ? 'item' : 'items'})
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attribution Survey Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-lg shadow-gray-100/50 relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-emerald-100 to-purple-100 rounded-full opacity-50" />

              <AnimatePresence mode="wait">
                {!attributionSubmitted ? (
                  <motion.div
                    key="survey"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative z-10 h-full flex flex-col"
                  >
                    <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">
                      Quick question
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      How did you find us?
                    </p>

                    <div className="relative mb-4">
                      <select
                        value={attributionValue}
                        onChange={(e) => setAttributionValue(e.target.value)}
                        disabled={attributionLoading || attributionSaving}
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all appearance-none cursor-pointer pr-12"
                      >
                        <option value="" disabled>Select an option</option>
                        {attributionOptions.map((option) => (
                          <option key={option.id} value={option.value || option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {/* Other text input - shown when "other" is selected */}
                    {attributionValue === 'other' && (
                      <input
                        type="text"
                        value={attributionOtherText}
                        onChange={(e) => setAttributionOtherText(e.target.value)}
                        placeholder="Please tell us more..."
                        disabled={attributionSaving}
                        className="w-full px-6 py-3 mb-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder-gray-400"
                      />
                    )}

                    <div className="flex gap-3 mt-auto">
                      <button
                        onClick={handleAttributionSubmit}
                        disabled={!attributionValue || attributionSaving}
                        className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {attributionSaving ? 'Saving...' : 'Submit'}
                      </button>
                      <button
                        onClick={() => setAttributionSubmitted(true)}
                        disabled={attributionSaving}
                        className="px-6 py-3.5 text-gray-400 font-bold hover:text-gray-700 transition-colors text-sm disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="thanks"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 h-full flex flex-col items-center justify-center text-center py-6"
                  >
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 9V9a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3v0a3 3 0 0 0 3-3v-4a3 3 0 0 0-3-3Z"/>
                        <path d="M12 4.5v1M8 5.5l.5 1M4.5 9l1 .5"/>
                        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                      </svg>
                    </div>
                    <h4 className="font-heading font-black text-gray-900 text-lg mb-1">
                      Thanks for the feedback!
                    </h4>
                    <p className="text-sm text-gray-500">
                      Every bit helps us grow better.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Account Creation (for guests) */}
          {isGuest && (
            <motion.div variants={itemVariants}>
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-[2.5rem] p-8 border-2 border-dashed border-gray-200">
                <div className="text-center">
                  <h3 className="text-lg font-heading font-extrabold text-gray-900 mb-2">
                    Want to track your order?
                  </h3>
                  <p className="text-xs text-gray-400 mb-6">
                    (just needs a password)
                  </p>
                  <button
                    onClick={onCreateAccount}
                    className="px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-gray-200"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Order Summary */}
          <motion.div variants={itemVariants} className="border-t border-gray-100 pt-10">
            <h3 className="text-2xl font-heading font-black text-gray-900 mb-8">
              Order Summary
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Items List */}
              <div className="lg:col-span-7 space-y-4">
                {(items || []).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-5 items-center bg-white p-4 rounded-2xl border border-gray-100"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-gray-400 font-medium">
                        {item.category && `${item.category} • `}Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="font-black text-gray-900 text-sm flex-shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Totals & Address */}
              <div className="lg:col-span-5 space-y-6">
                {/* Totals Card */}
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Subtotal</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discount && totals.discount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex justify-between items-center bg-emerald-50 -mx-2 px-4 py-2 rounded-xl border border-emerald-100"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                            {totals.discountDescription || 'Discount'}
                          </span>
                        </div>
                        <span className="text-sm font-black text-emerald-700">
                          -${totals.discount.toFixed(2)}
                        </span>
                      </motion.div>
                    )}
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Shipping</span>
                      <span>${totals.shipping.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Tax</span>
                      <span>${totals.tax.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <span className="font-heading font-black text-gray-900">Total</span>
                    <span className="text-2xl font-black text-emerald-600">
                      ${totals.total.toFixed(2)}
                    </span>
                  </div>
                  {totals.discount && totals.discount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mt-4 pt-4 border-t border-gray-200 text-center"
                    >
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
                        You Saved
                      </p>
                      <p className="text-2xl font-black text-emerald-600">
                        ${totals.discount.toFixed(2)}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Shipping Address or Pickup Location */}
                <div className="p-6">
                  {isPickup && pickupInfo ? (
                    <>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">
                        Pickup Location
                      </h4>
                      <p className="text-sm font-bold text-gray-700 leading-relaxed">
                        {pickupInfo.locationName}<br />
                        {pickupInfo.address}
                      </p>
                      {pickupInfo.instructions && (
                        <p className="text-xs text-gray-500 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="font-bold text-gray-600">Instructions: </span>
                          {pickupInfo.instructions}
                        </p>
                      )}
                    </>
                  ) : shippingAddress ? (
                    <>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">
                        Shipping Address
                      </h4>
                      <p className="text-sm font-bold text-gray-700 leading-relaxed">
                        {shippingAddress.name}<br />
                        {shippingAddress.address}<br />
                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div variants={itemVariants} className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onContinueShopping}
              className="px-12 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-600 hover:scale-[1.03] transition-all shadow-2xl shadow-gray-200 flex items-center gap-4"
            >
              Continue Shopping
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" x2="19" y1="12" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
            {onViewOrders && (
              <button
                onClick={onViewOrders}
                className="px-8 py-4 bg-white text-gray-700 rounded-[2rem] font-bold text-base hover:bg-gray-50 transition-all border-2 border-gray-200 flex items-center gap-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                View Order History
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
