import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface LoginPageProps {
  onNavigate: (view: string) => void;
  onSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
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
            className="inline-flex items-center gap-2 mb-6"
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              A
            </div>
            <span className="font-heading font-extrabold text-xl text-gray-900">
              ATL Urban Farms
            </span>
          </button>
          <h1 className="text-3xl font-heading font-extrabold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-500">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100"
        >
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

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-6 py-4 pr-14 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" x2="23" y1="1" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                Forgot password?
              </button>
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
                  Signing in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center my-8">
            <div className="flex-grow border-t border-gray-100" />
            <span className="flex-shrink mx-4 text-xs font-bold text-gray-300 uppercase tracking-widest">
              Or
            </span>
            <div className="flex-grow border-t border-gray-100" />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-500">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
            >
              Sign up
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
            Return to Home Page
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
