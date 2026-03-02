import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface UnsubscribePageProps {
  onNavigate?: (view: string) => void;
}

type Status = 'loading' | 'success' | 'error' | 'invalid';

const UnsubscribePage: React.FC<UnsubscribePageProps> = ({ onNavigate }) => {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    fetch(`https://n8n.sproutify.app/webhook/trellis-unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.success ? 'success' : 'error');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen bg-site flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-10 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md brand-bg">
              A
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-lg font-extrabold tracking-tight text-gray-900">
                ATL Urban Farms
              </span>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4"
            >
              <div className="w-10 h-10 mx-auto mb-6 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-gray-500">Processing your request...</p>
            </motion.div>
          )}

          {/* Success */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-3">
                Successfully Unsubscribed
              </h1>

              <p className="text-gray-500 leading-relaxed mb-4">
                You've been successfully unsubscribed from ATL Urban Farms emails. You won't receive any more marketing emails from us.
              </p>

              <p className="text-sm text-gray-400 leading-relaxed mb-8">
                Note: Transactional emails like order confirmations may still be sent for active orders.
              </p>

              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('home');
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Visit ATL Urban Farms
              </button>
            </motion.div>
          )}

          {/* Invalid token */}
          {status === 'invalid' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
                </svg>
              </div>

              <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-3">
                Invalid Link
              </h1>

              <p className="text-gray-500 leading-relaxed mb-8">
                This unsubscribe link is invalid or has expired.
              </p>
            </motion.div>
          )}

          {/* Error */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
                </svg>
              </div>

              <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-3">
                Something Went Wrong
              </h1>

              <p className="text-gray-500 leading-relaxed mb-8">
                We had trouble processing your unsubscribe request. Please try again or contact us at{' '}
                <a
                  href="mailto:hello@atlurbanfarms.com"
                  className="text-emerald-600 hover:text-emerald-700 underline"
                >
                  hello@atlurbanfarms.com
                </a>.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UnsubscribePage;
