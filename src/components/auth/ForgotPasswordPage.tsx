import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useBrandingSettings } from '../../hooks/useSupabase';

interface ForgotPasswordPageProps {
  onNavigate: (view: string) => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { settings: brandingSettings } = useBrandingSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center justify-center gap-2 mb-6"
          >
            {brandingSettings.logo_url && !logoError ? (
              <img
                src={brandingSettings.logo_url}
                alt="ATL Urban Farms"
                className="h-12 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <>
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  A
                </div>
                <span className="font-heading font-extrabold text-xl text-gray-900">
                  ATL Urban Farms
                </span>
              </>
            )}
          </button>
          <h1 className="text-3xl font-heading font-extrabold text-gray-900 mb-2">
            Reset Password
          </h1>
          <p className="text-gray-500">
            Enter your email to receive a reset link
          </p>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100"
        >
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="text-xl font-heading font-extrabold text-gray-900 mb-3">
                Check Your Email
              </h2>
              <p className="text-gray-500 mb-6">
                We've sent a password reset link to{' '}
                <span className="font-semibold text-gray-700">{email}</span>
              </p>
              <p className="text-sm text-gray-400 mb-8">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                Send again
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-xl"
                >
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </motion.div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-3 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative flex items-center my-8">
            <div className="flex-grow border-t border-gray-100" />
            <span className="flex-shrink mx-4 text-xs font-bold text-gray-300 uppercase tracking-widest">
              Or
            </span>
            <div className="flex-grow border-t border-gray-100" />
          </div>

          {/* Back to Login Link */}
          <p className="text-center text-gray-500">
            Remember your password?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
            >
              Log in
            </button>
          </p>
        </motion.div>

        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center mt-8"
        >
          <button
            onClick={() => onNavigate('home')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2 mx-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" x2="5" y1="12" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to home
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
