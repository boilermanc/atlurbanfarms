
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem } from '../types';
import { useAutoApplyPromotion, useCartDiscount } from '../src/hooks/usePromotions';
import { CartDiscountResult } from '../src/admin/types/promotions';
import { useSetting } from '../src/admin/hooks/useSettings';
import { supabase } from '../src/lib/supabase';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, items, onRemove, onUpdateQuantity, onCheckout }) => {
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const { value: customerShippingMessage } = useSetting('shipping', 'customer_shipping_message');

  // Check for automatic promotions
  const { discount: autoDiscount } = useAutoApplyPromotion(items);

  // Manual promo code
  const { calculateDiscount, loading: promoLoading } = useCartDiscount();
  const [promoCode, setPromoCode] = useState('');
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<CartDiscountResult | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoError(null);

    const cartItems = items.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    const result = await calculateDiscount(cartItems, promoCode.trim());

    if (result.valid && result.discount > 0) {
      setAppliedPromo(result);
      setPromoError(null);
    } else {
      setAppliedPromo(null);
      setPromoError(result.message || 'Invalid promo code');
    }
  }, [promoCode, items, calculateDiscount]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
  }, []);

  // Clear manual promo when cart empties
  useEffect(() => {
    if (items.length === 0) {
      handleRemovePromo();
      setPromoExpanded(false);
    }
  }, [items.length, handleRemovePromo]);

  // Free shipping config from admin settings
  const [freeShippingConfig, setFreeShippingConfig] = useState<{ enabled: boolean; threshold: number } | null>(null);

  useEffect(() => {
    supabase
      .from('config_settings')
      .select('key, value')
      .eq('category', 'shipping')
      .in('key', ['free_shipping_enabled', 'free_shipping_threshold'])
      .then(({ data }) => {
        if (data) {
          const enabled = data.find(r => r.key === 'free_shipping_enabled')?.value === 'true';
          const threshold = parseFloat(data.find(r => r.key === 'free_shipping_threshold')?.value ?? '0');
          setFreeShippingConfig({ enabled, threshold });
        }
      });
  }, []);

  const autoDiscountAmount = autoDiscount?.valid ? autoDiscount.discount : 0;
  const manualDiscountAmount = appliedPromo?.valid ? appliedPromo.discount : 0;
  // Best discount wins — no stacking
  const useManual = manualDiscountAmount > 0 && manualDiscountAmount >= autoDiscountAmount;
  const discountAmount = Math.max(autoDiscountAmount, manualDiscountAmount);
  const activePromo = useManual ? appliedPromo : (autoDiscountAmount > 0 ? autoDiscount : null);
  const isFreeShipping = freeShippingConfig?.enabled && subtotal >= freeShippingConfig.threshold;
  const total = subtotal - discountAmount;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[80] shadow-2xl flex flex-col"
          >
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-heading font-extrabold text-gray-900">Your Basket</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-300 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Basket is empty</h3>
                  <p className="text-gray-500 text-sm mb-6">Looks like you haven't added any seedlings yet.</p>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold transition-all btn-brand-hover"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 leading-tight">{item.name}</h4>
                          <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </button>
                        </div>
                        <p className="brand-text font-bold">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                          <button 
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-8 bg-gray-50 border-t border-gray-100 space-y-4">
                {/* Promo Code Section */}
                <div className="space-y-2">
                  {appliedPromo?.valid ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>"{appliedPromo.promotion_code}" applied</span>
                      </div>
                      <button
                        onClick={handleRemovePromo}
                        className="text-xs text-green-600 hover:text-red-500 font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setPromoExpanded(!promoExpanded)}
                        className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                          <line x1="7" x2="7.01" y1="7" y2="7"/>
                        </svg>
                        Have a promo code?
                      </button>
                      {promoExpanded && (
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                              placeholder="Enter code"
                              disabled={promoLoading}
                              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
                            />
                            <button
                              onClick={handleApplyPromo}
                              disabled={promoLoading || !promoCode.trim()}
                              className="px-4 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl transition-all hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {promoLoading ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : 'Apply'}
                            </button>
                          </div>
                          {promoError && (
                            <p className="text-xs text-red-500 font-medium">{promoError}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && activePromo && (
                    <div className="flex justify-between text-sm brand-text font-medium">
                      <span>{activePromo.description || activePromo.promotion_name || 'Discount'}</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Shipping</span>
                    <span className={isFreeShipping ? 'brand-text font-medium' : 'text-gray-400 italic'}>
                      {isFreeShipping ? 'FREE' : 'Calculated at checkout'}
                    </span>
                  </div>
                  {freeShippingConfig?.enabled && !isFreeShipping && (
                    <p className="text-[10px] brand-text font-bold uppercase tracking-wider">
                      Add ${(freeShippingConfig.threshold - subtotal).toFixed(2)} more for free shipping
                    </p>
                  )}
                  <div className="flex justify-between text-xl font-heading font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
                
                <button
                  onClick={onCheckout}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 btn-brand-hover"
                >
                  Checkout Now
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" x2="15" y1="12" y2="12"/><polyline points="12 19 19 12 12 5"/></svg>
                </button>
                <p className="text-[10px] text-gray-400 text-center font-medium">
                  {customerShippingMessage || 'We only ship Mon-Wed to keep plants fresh 🌿'}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
