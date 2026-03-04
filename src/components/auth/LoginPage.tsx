import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useBrandingSettings } from '../../hooks/useSupabase';
import TurnstileWidget from './TurnstileWidget';
import { verifyTurnstileToken, isTurnstileEnabled } from '../../lib/turnstile';

interface LoginPageProps {
  onNavigate: (view: string) => void;
  onSuccess: () => void;
}

const EyeOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" x2="23" y1="1" y2="23" />
  </svg>
);

const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onSuccess }) => {
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Register form state
  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Turnstile state
  const [loginTurnstileToken, setLoginTurnstileToken] = useState<string | null>(null);
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState<string | null>(null);

  // Shared state
  const [logoError, setLogoError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { settings: brandingSettings, loading: brandingLoading } = useBrandingSettings();

  // --- Login handler ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (isTurnstileEnabled() && !loginTurnstileToken) {
      setLoginError('Please complete the CAPTCHA verification.');
      return;
    }

    setIsLoginLoading(true);

    try {
      if (isTurnstileEnabled()) {
        await verifyTurnstileToken(loginTurnstileToken!);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      setLoginError(typeof err === 'string' ? err : (err.message || 'Invalid email or password. Please try again.'));
      setLoginTurnstileToken(null);
    } finally {
      setIsLoginLoading(false);
    }
  };

  // --- Register handlers ---
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  };

  const validateRegister = (): string | null => {
    if (!registerData.firstName.trim()) return 'First name is required.';
    if (!registerData.lastName.trim()) return 'Last name is required.';
    if (registerData.password.length < 8) return 'Password must be at least 8 characters long.';
    if (registerData.password !== registerData.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setExistingAccount(false);

    const validationError = validateRegister();
    if (validationError) {
      setRegisterError(validationError);
      return;
    }

    if (isTurnstileEnabled() && !registerTurnstileToken) {
      setRegisterError('Please complete the CAPTCHA verification.');
      return;
    }

    setIsRegisterLoading(true);

    try {
      if (isTurnstileEnabled()) {
        await verifyTurnstileToken(registerTurnstileToken!);
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          data: {
            first_name: registerData.firstName.trim(),
            last_name: registerData.lastName.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      // Supabase doesn't error on duplicate emails (to prevent enumeration).
      // Instead it returns a user with an empty identities array.
      if (data.user?.identities?.length === 0) {
        setRegisterError(null);
        setExistingAccount(true);
        return;
      }

      // If we got a session back (email confirmation disabled), redirect immediately.
      // Otherwise show the "check your email" confirmation message.
      if (data.session) {
        // Update the customer record with name fields (trigger may have already done this,
        // but this ensures it's set even if metadata parsing changes)
        if (data.user) {
          await supabase
            .from('customers')
            .update({
              first_name: registerData.firstName.trim(),
              last_name: registerData.lastName.trim(),
            })
            .eq('id', data.user.id);
        }
        onSuccess();
        return;
      }

      // Email confirmation is required — show confirmation message, don't redirect
      setRegistrationSuccess(true);
    } catch (err: any) {
      setRegisterError(typeof err === 'string' ? err : (err.message || 'An error occurred during registration. Please try again.'));
      setRegisterTurnstileToken(null);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const inputClass = 'w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all';
  const labelClass = 'text-xs font-black uppercase tracking-widest text-gray-400';
  const cardClass = 'bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100 flex flex-col';

  return (
    <div className="min-h-screen bg-site flex flex-col items-center px-4 py-12">
      {/* Logo / Brand */}
      <div className="text-center mb-10">
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center justify-center gap-2 mb-4 min-h-[6rem]"
        >
          {brandingSettings.logo_url && !logoError ? (
            <img
              src={brandingSettings.logo_url}
              alt="ATL Urban Farms"
              className={`h-24 w-auto object-contain transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoError(true)}
            />
          ) : !brandingLoading ? (
            <>
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                A
              </div>
              <span className="font-heading font-extrabold text-xl text-gray-900">
                ATL Urban Farms
              </span>
            </>
          ) : null}
        </button>
        <h1 className="text-4xl font-heading font-extrabold text-gray-900">My Account</h1>
      </div>

      {/* Two-card layout */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── CARD 1: Returning Customer ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={cardClass}
        >
          <h2 className="text-2xl font-heading font-extrabold text-gray-900 mb-6">
            Returning Customer
          </h2>

          <form onSubmit={handleLogin} className="space-y-5 flex-1 flex flex-col">
            {loginError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl"
              >
                <p className="text-sm text-red-600 font-medium">{loginError}</p>
              </motion.div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={`${inputClass} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Spacer to push button to bottom */}
            <div className="flex-1" />

            {/* Turnstile CAPTCHA */}
            <TurnstileWidget
              onSuccess={(token) => setLoginTurnstileToken(token)}
              onError={() => setLoginTurnstileToken(null)}
              onExpire={() => setLoginTurnstileToken(null)}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoginLoading || (isTurnstileEnabled() && !loginTurnstileToken)}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-3 ${
                isLoginLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isLoginLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>
        </motion.div>

        {/* ── CARD 2: New Customer ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={cardClass}
        >
          <h2 className="text-2xl font-heading font-extrabold text-gray-900 mb-6">
            New Customer
          </h2>

          {registrationSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center flex-1 flex flex-col items-center justify-center"
            >
              <svg
                className="w-12 h-12 text-emerald-600 mb-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3 className="text-lg font-bold text-emerald-800 mb-2">Check Your Email</h3>
              <p className="text-sm text-emerald-700">
                We've sent a verification link to <strong>{registerData.email}</strong>. Please check your inbox to complete registration.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5 flex-1 flex flex-col">
              {/* Existing Account Notice */}
              {existingAccount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    An account with this email already exists.
                  </p>
                  <p className="text-sm text-gray-600">
                    Please use the Returning Customer form to log in.
                  </p>
                </motion.div>
              )}

              {/* Error Message */}
              {registerError && !existingAccount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-xl"
                >
                  <p className="text-sm text-red-600 font-medium">{registerError}</p>
                </motion.div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelClass}>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={registerData.firstName}
                    onChange={handleRegisterChange}
                    placeholder="First name"
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={registerData.lastName}
                    onChange={handleRegisterChange}
                    placeholder="Last name"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    name="password"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    placeholder="Min. 8 characters"
                    required
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>
                {registerData.password && registerData.password.length < 8 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={registerData.confirmPassword}
                    onChange={handleRegisterChange}
                    placeholder="Re-enter your password"
                    required
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>
              </div>

              {/* Spacer to push button to bottom */}
              <div className="flex-1" />

              {/* Turnstile CAPTCHA */}
              <TurnstileWidget
                onSuccess={(token) => setRegisterTurnstileToken(token)}
                onError={() => setRegisterTurnstileToken(null)}
                onExpire={() => setRegisterTurnstileToken(null)}
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={isRegisterLoading || (isTurnstileEnabled() && !registerTurnstileToken)}
                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-3 ${
                  isRegisterLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isRegisterLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>

      {/* Back to Home */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
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
    </div>
  );
};

export default LoginPage;
