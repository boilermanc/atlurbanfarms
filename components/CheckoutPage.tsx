
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem } from '../types';
import { SHIPPING_NOTICE, SparkleIcon } from '../constants';
import OrderConfirmation from './OrderConfirmation';

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onComplete: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ items, onBack, onComplete }) => {
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: ''
  });

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingCost = shippingMethod === 'standard' ? 8.99 : 14.99;
  const isGeorgia = formData.state.toUpperCase().trim() === 'GA';
  const tax = isGeorgia ? Math.round(subtotal * 0.07 * 100) / 100 : 0;
  const total = subtotal + shippingCost + tax;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsProcessing(false);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <OrderConfirmation 
        items={items}
        customerName={formData.name}
        customerEmail={formData.email}
        customerAddress={`${formData.address}, ${formData.city}, ${formData.state} ${formData.zip}`}
        totals={{ subtotal, shipping: shippingCost, tax, total }}
        onContinue={onComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white z-[90] relative">
      {/* Checkout Header */}
      <div className="border-b border-gray-100 py-6 px-4 md:px-12 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Shop
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">A</div>
          <span className="font-heading font-extrabold text-gray-900">Checkout</span>
        </div>
        <div className="w-20 md:block hidden" /> {/* Spacer */}
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-7 space-y-12">
            <form onSubmit={handleCompleteOrder}>
              {/* Contact Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Contact Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Email Address</label>
                    <input required name="email" value={formData.email} onChange={handleInputChange} type="email" placeholder="jane@example.com" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                    <input required name="phone" value={formData.phone} onChange={handleInputChange} type="tel" placeholder="(404) 000-0000" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                  </div>
                </div>
              </section>

              <hr className="my-12 border-gray-100" />

              {/* Shipping Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Shipping Address</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Full Name</label>
                    <input required name="name" value={formData.name} onChange={handleInputChange} type="text" placeholder="Jane Doe" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Street Address</label>
                    <input required name="address" value={formData.address} onChange={handleInputChange} type="text" placeholder="Start typing address..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2 md:col-span-1 space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">City</label>
                      <input required name="city" value={formData.city} onChange={handleInputChange} type="text" placeholder="Atlanta" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">State</label>
                      <input required name="state" value={formData.state} onChange={handleInputChange} type="text" placeholder="GA" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">Zip Code</label>
                      <input required name="zip" value={formData.zip} onChange={handleInputChange} type="text" placeholder="30318" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all" />
                    </div>
                  </div>
                </div>
              </section>

              <hr className="my-12 border-gray-100" />

              {/* Shipping Method */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Shipping Method</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('standard')}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all ${shippingMethod === 'standard' ? 'border-emerald-600 bg-emerald-50/30' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">Standard Ground</span>
                      <span className="text-emerald-600 font-black">$8.99</span>
                    </div>
                    <p className="text-xs text-gray-500">3-5 Business Days. Recommended for hardy vegetables.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingMethod('express')}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all ${shippingMethod === 'express' ? 'border-emerald-600 bg-emerald-50/30' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">2-Day Express</span>
                      <span className="text-emerald-600 font-black">$14.99</span>
                    </div>
                    <p className="text-xs text-gray-500">Fastest delivery. Best for sensitive flowers and herbs.</p>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {SHIPPING_NOTICE}
                </p>
              </section>

              <hr className="my-12 border-gray-100" />

              {/* Payment Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <h3 className="text-xl font-heading font-extrabold text-gray-900">Payment</h3>
                </div>
                
                {/* Express Payment */}
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" className="py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-80 transition-all">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.96.95-2.26 1.51-3.71 1.51-3.26 0-5.91-2.65-5.91-5.91s2.65-5.91 5.91-5.91c1.45 0 2.75.56 3.71 1.51l2.42-2.42C17.7 7.21 15.65 6.13 13.34 6.13c-5.36 0-9.71 4.35-9.71 9.71s4.35 9.71 9.71 9.71c2.31 0 4.36-1.08 6.13-2.83l-2.42-2.44z"/></svg>
                    Pay
                  </button>
                  <button type="button" className="py-4 bg-white border border-gray-200 text-gray-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all">
                    Google Pay
                  </button>
                </div>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-gray-100"></div>
                  <span className="flex-shrink mx-4 text-xs font-bold text-gray-300 uppercase tracking-widest">Or pay with card</span>
                  <div className="flex-grow border-t border-gray-100"></div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Card Details</label>
                    <div className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-500">
                      Card Number • MM/YY • CVC (Stripe Secure Component)
                    </div>
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={isProcessing}
                className={`mt-12 w-full py-6 rounded-[2rem] font-black text-xl text-white shadow-2xl shadow-emerald-200 transition-all flex items-center justify-center gap-4 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-98'}`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Order • ${total.toFixed(2)}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5 sticky top-32">
            <div className="bg-gray-50 rounded-[3rem] p-10 border border-gray-100">
              <h3 className="text-2xl font-heading font-extrabold text-gray-900 mb-8">Order Summary</h3>
              
              <div className="space-y-6 max-h-[400px] overflow-y-auto mb-8 pr-2">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-gray-200 flex-shrink-0 relative">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      <span className="absolute -top-2 -right-2 bg-gray-900 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-gray-50">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 py-1">
                      <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                      <p className="text-xs text-gray-400 font-medium">{item.category}</p>
                      <p className="text-sm font-black text-emerald-600 mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-200/60">
                <div className="flex justify-between text-gray-500 font-bold text-sm uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-bold text-sm uppercase tracking-widest">
                  <span>Shipping</span>
                  <span>${shippingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-bold text-sm uppercase tracking-widest">
                  <span>{isGeorgia ? 'Tax (7%)' : 'Tax'}</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-900 pt-6 border-t border-gray-900/10">
                  <span className="text-xl font-heading font-extrabold">Total</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-emerald-600">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
