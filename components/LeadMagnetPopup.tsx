import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { submitNewsletterPreference } from '../src/services/newsletter';

const STORAGE_KEY = 'atluf_lead_magnet_dismissed';
const SUPPRESSION_DAYS = 30;
const POPUP_DELAY_MS = 8000;

const LeadMagnetPopup: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable — popup may reappear next session
    }
  }, []);

  // Timer + suppression check
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const dismissedAt = parseInt(stored, 10);
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (daysSince < SUPPRESSION_DAYS) {
          return;
        }
      }
    } catch {
      // localStorage unavailable — proceed to show popup
    }

    const timer = setTimeout(() => setIsVisible(true), POPUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setSubmitStatus('error');
      setErrorMessage('Please enter your email address.');
      return;
    }

    try {
      setSubmitStatus('loading');
      setErrorMessage(null);
      await submitNewsletterPreference({
        email: trimmed,
        source: 'lead_magnet',
        tags: ['tower_garden_guide_2026'],
      });
      setSubmitStatus('success');
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      setTimeout(() => dismiss(), 3000);
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            {submitStatus === 'success' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
                  Check Your Email!
                </h3>
                <p className="text-gray-500">
                  Confirm your email to receive your free 2026 Tower Garden Cost Comparison.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="bg-emerald-50 px-8 pt-8 pb-6">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2 block">
                    Free Download
                  </span>
                  <h3 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
                    2026 Tower Garden Cost Comparison
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    See exactly how much you can save growing at home vs. buying from the grocery store — plus get a free seedlings bonus!
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5 block">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (submitStatus === 'error') {
                          setSubmitStatus('idle');
                          setErrorMessage(null);
                        }
                      }}
                      placeholder="you@example.com"
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  {errorMessage && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-sm text-rose-500"
                      role="alert"
                    >
                      {errorMessage}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={submitStatus === 'loading'}
                    className="w-full py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {submitStatus === 'loading' ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      'Get My Free Guide'
                    )}
                  </button>

                  <p className="text-xs text-center text-gray-400">
                    By subscribing, you agree to receive newsletters and promotional content. Unsubscribe anytime.
                  </p>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LeadMagnetPopup;
