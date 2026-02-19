
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem } from '../types';
import { SparkleIcon } from '../constants';

interface OrderConfirmationProps {
  items: CartItem[];
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  onContinue: () => void;
}

const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  items,
  customerName,
  customerEmail,
  customerAddress,
  totals,
  onContinue
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const orderNumber = "ATL-" + Math.floor(10000 + Math.random() * 90000);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const confettiItems = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10,
    size: Math.random() * 8 + 4,
    color: ['#10B981', '#34D399', '#8B5CF6', '#EC4899'][Math.floor(Math.random() * 4)],
    delay: Math.random() * 2,
    duration: Math.random() * 2 + 3
  }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden pb-24">
      {/* Simple Confetti Implementation */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[110]">
            {confettiItems.map((c) => (
              <motion.div
                key={c.id}
                initial={{ left: `${c.x}%`, top: '-5%', opacity: 1, rotate: 0 }}
                animate={{ 
                  top: '105%', 
                  rotate: 360,
                  opacity: 0 
                }}
                transition={{ duration: c.duration, delay: c.delay, ease: "linear" }}
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

      <div className="max-w-4xl mx-auto px-4 pt-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-12"
        >
          {/* Header Section */}
          <motion.div variants={itemVariants} className="text-center space-y-4">
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
              >
                <svg className="w-12 h-12 text-emerald-600" viewBox="0 0 24 24" fill="none">
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeInOut" }}
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-400/20 rounded-full -z-10"
              />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900">Order Confirmed!</h1>
            <p className="text-xl text-gray-500 font-medium">Thank you, {customerName || 'Urban Farmer'}! ✨</p>
            <div className="inline-block px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">Order ID:</span>
              <span className="text-sm font-black text-emerald-600">{orderNumber}</span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Shipping Info Card */}
            <div className="bg-gray-50 rounded-[2.5rem] p-8 border border-gray-100 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Shipping Status</p>
                <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-4">We'll email you soon</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  We'll send a confirmation to <span className="font-bold text-gray-900">{customerEmail}</span> as soon as your seedlings leave our nursery.
                </p>
              </div>
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400">Estimated Arrival</p>
                  <p className="text-sm font-bold text-gray-900">May 15-17, 2025</p>
                </div>
              </div>
            </div>

            {/* Attribution Survey */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 shadow-xl shadow-emerald-900/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <SparkleIcon className="w-24 h-24 text-emerald-600" />
              </div>
              
              <AnimatePresence mode="wait">
                {!surveySubmitted ? (
                  <motion.div 
                    key="survey"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col"
                  >
                    <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">One quick thing...</h3>
                    <p className="text-sm text-gray-500 mb-6">How did you find us today?</p>
                    <select className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 mb-6 appearance-none cursor-pointer">
                      <option disabled selected>Select an option</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>TikTok</option>
                      <option>Google Search</option>
                      <option>Friend / Referral</option>
                      <option>School Program</option>
                      <option>Farmers Market</option>
                      <option>Other</option>
                    </select>
                    <div className="flex gap-4 mt-auto">
                      <button 
                        onClick={() => setSurveySubmitted(true)}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                      >
                        Submit
                      </button>
                      <button 
                        onClick={() => setSurveySubmitted(true)}
                        className="px-6 py-3 text-gray-400 font-bold hover:text-gray-900 transition-colors text-sm"
                      >
                        Skip
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="thanks"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a10 10 0 1 1-14.42 0"/></svg>
                    </div>
                    <h4 className="font-heading font-black text-gray-900 text-lg mb-2">Thanks for the feedback!</h4>
                    <p className="text-sm text-gray-500">Every bit helps us grow better.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Marketing Section */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Account Creation */}
            <div className="p-8 rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center text-center">
              <h3 className="text-lg font-heading font-extrabold text-gray-900 mb-2">Want to track your order?</h3>
              <p className="text-xs text-gray-400 mb-6">Create an account in one click (just needs a password).</p>
              <button className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all">
                Create Account
              </button>
            </div>

            {/* Newsletter */}
            <div className="p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center text-center">
              <label className="flex flex-col items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-6 h-6 border-2 border-gray-200 rounded-lg peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all"></div>
                  <svg className="absolute inset-0 m-auto w-4 h-4 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-heading font-extrabold text-gray-900 mb-1">Send me growing tips</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                    We email ~2x/month. No spam, ever.
                  </p>
                </div>
              </label>
            </div>
          </motion.div>

          {/* Order Details Accordion-like Section */}
          <motion.div variants={itemVariants} className="border-t border-gray-100 pt-12">
            <h3 className="text-2xl font-heading font-black text-gray-900 mb-8">Order Details</h3>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-6 items-center">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{item.category} • Qty: {item.quantity}</p>
                    </div>
                    <p className="font-black text-gray-900 text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Subtotal</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Shipping</span>
                      <span>${totals.shipping.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span>Tax</span>
                      <span>${totals.tax.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-gray-900 pt-4 border-t border-gray-200">
                    <span className="font-heading font-black">Total</span>
                    <span className="text-2xl font-black text-emerald-600">${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Shipping Address</h4>
                  <p className="text-sm font-bold text-gray-700 leading-relaxed">
                    {customerName}<br />
                    {customerAddress || '123 High-Tech Way, Atlanta, GA 30318'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="pt-12 flex justify-center">
            <button 
              onClick={onContinue}
              className="px-12 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-emerald-600 hover:scale-[1.05] transition-all shadow-2xl shadow-emerald-900/10 flex items-center gap-4"
            >
              Continue Shopping
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
