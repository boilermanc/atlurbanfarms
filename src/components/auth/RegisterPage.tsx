import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface RegisterPageProps {
  onNavigate: (view: string) => void;
  onSuccess: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): string | null => {
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) {
        throw signUpError;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration. Please try again.');
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
            Create Account
          </h1>
          <p className="text-gray-500">
            Join our community of urban gardeners
          </p>
        </div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
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
                name="email"
                value={formData.email}
                onChange={handleInputChange}
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
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Min. 8 characters"
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Re-enter your password"
                  required
                  className="w-full px-6 py-4 pr-14 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
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
              {formData.password && formData.password.length < 8 && (
                <p className="text-xs text-amber-600 mt-1">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-3 mt-6 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
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

          {/* Login Link */}
          <p className="text-center text-gray-500">
            Already have an account?{' '}
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
            Return to Home Page
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
