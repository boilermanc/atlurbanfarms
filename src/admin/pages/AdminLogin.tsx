import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Leaf, LogIn, ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface AdminLoginProps {
  onNavigate: (view: string) => void;
  onSuccess: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigate, onSuccess }) => {
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      // Verify session is established before redirecting
      if (data.session) {
        // Small delay to ensure session is fully propagated
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify we can get the session back
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData.session) {
          // Redirect directly to avoid React state race conditions
          window.location.href = '/admin';
          return;
        }
      }

      // Fallback if session check fails
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen brand-gradient-subtle flex items-center justify-center px-4 py-12 font-admin-body">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <span className="p-3 brand-bg-light rounded-xl">
              <Leaf className="brand-text" size={28} />
            </span>
            <span className="font-bold text-2xl text-slate-800 font-admin-display">
              ATL <span className="brand-text">Urban Farms</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 font-admin-display">
            Admin Portal
          </h1>
          <p className="text-slate-500">
            Sign in to access the admin dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@atlurbanfarms.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 brand-focus transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 brand-focus transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-3 ${
                isLoading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'btn-brand shadow-lg brand-shadow'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Main Site */}
        <div className="text-center mt-8">
          <button
            onClick={() => onNavigate('home')}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-2 mx-auto font-medium"
          >
            <ArrowLeft size={16} />
            Back to main site
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
