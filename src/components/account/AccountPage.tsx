import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useBrandingSettings } from '../../hooks/useSupabase';
import OrderHistory from './OrderHistory';
import AddressBook from './AddressBook';
import ProfileSettings from './ProfileSettings';

interface AccountPageProps {
  onNavigate: (view: string) => void;
}

type AccountTab = 'overview' | 'orders' | 'addresses' | 'profile' | 'settings';

const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { settings: brandingSettings } = useBrandingSettings();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('home');
  };

  const tabs: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      id: 'addresses',
      label: 'Addresses',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrderHistory userId={user.id} onNavigate={onNavigate} />;
      case 'addresses':
        return <AddressBook userId={user.id} />;
      case 'profile':
        return <ProfileSettings userId={user.id} userEmail={user.email || ''} />;
      case 'settings':
        return <SettingsTab userEmail={user.email || ''} />;
      case 'overview':
      default:
        return <OverviewTab user={user} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2"
            >
              {brandingSettings.logo_url && !logoError ? (
                <img
                  src={brandingSettings.logo_url}
                  alt="ATL Urban Farms"
                  className="h-10 w-auto object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <>
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    A
                  </div>
                  <span className="font-heading font-extrabold text-xl text-gray-900 hidden sm:block">
                    ATL Urban Farms
                  </span>
                </>
              )}
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => onNavigate('shop')}
                className="text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                Shop
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isMobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="md:w-64 shrink-0">
            {/* User Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-emerald-600">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-gray-900 truncate">
                    {user.user_metadata?.full_name || 'Welcome!'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </motion.div>

            {/* Navigation */}
            <motion.nav
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-600 border-l-4 border-emerald-600'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </motion.nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  user: any;
  onTabChange: (tab: AccountTab) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ user, onTabChange }) => {
  const quickActions = [
    { label: 'View Orders', tab: 'orders' as AccountTab, icon: '📦' },
    { label: 'Manage Addresses', tab: 'addresses' as AccountTab, icon: '📍' },
    { label: 'Edit Profile', tab: 'profile' as AccountTab, icon: '👤' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          Welcome back!
        </h1>
        <p className="text-gray-500">
          Here's an overview of your account activity.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <motion.button
            key={action.tab}
            onClick={() => onTabChange(action.tab)}
            whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:border-emerald-200 hover:shadow-md transition-all"
          >
            <span className="text-3xl mb-3 block">{action.icon}</span>
            <span className="font-heading font-bold text-gray-900">{action.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Account Stats */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-heading font-bold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-3 border-b border-gray-50">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-gray-50">
            <span className="text-gray-500">Member Since</span>
            <span className="font-medium text-gray-900">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-gray-500">Account Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Tab Component
interface SettingsTabProps {
  userEmail: string;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ userEmail }) => {
  const [newsletterEnabled, setNewsletterEnabled] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Password change state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setPasswordChangeError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }

    setPasswordChangeLoading(true);
    setPasswordChangeError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setPasswordChangeSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);
  };

  // Email change state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || newEmail === userEmail) {
      setEmailChangeError('Please enter a different email address');
      return;
    }

    setEmailChangeLoading(true);
    setEmailChangeError(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) throw error;

      setEmailChangeSuccess(true);
      setNewEmail('');
    } catch (err: any) {
      setEmailChangeError(err.message || 'Failed to update email');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const closeEmailModal = () => {
    setIsEmailModalOpen(false);
    setNewEmail('');
    setEmailChangeError(null);
    setEmailChangeSuccess(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          Account Settings
        </h1>
        <p className="text-gray-500">
          Manage your account preferences and security.
        </p>
      </div>

      {/* Communication Preferences */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-heading font-bold text-gray-900 mb-4">Communication Preferences</h2>
        <div className="flex items-center justify-between py-3 border-b border-gray-50">
          <div>
            <p className="font-medium text-gray-900">Newsletter</p>
            <p className="text-sm text-gray-500">Receive updates about new products and promotions</p>
          </div>
          <button
            onClick={() => setNewsletterEnabled(!newsletterEnabled)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              newsletterEnabled ? 'bg-emerald-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                newsletterEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-gray-900">SMS Updates</p>
            <p className="text-sm text-gray-500">Receive text messages about your orders</p>
          </div>
          <button
            onClick={() => setSmsOptIn(!smsOptIn)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              smsOptIn ? 'bg-emerald-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                smsOptIn ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-heading font-bold text-gray-900 mb-4">Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div>
              <p className="font-medium text-gray-900">Password</p>
              <p className="text-sm text-gray-500">Update your account password</p>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-4 py-2 text-emerald-600 font-medium hover:bg-emerald-50 rounded-xl transition-colors"
            >
              Change
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Connected Email</p>
              <p className="text-sm text-gray-500">{userEmail}</p>
            </div>
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="px-4 py-2 text-emerald-600 font-medium hover:bg-emerald-50 rounded-xl transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      {/* Email Change Modal */}
      <AnimatePresence>
        {isEmailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeEmailModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="font-heading font-bold text-xl text-gray-900 mb-2">
                Change Email Address
              </h3>

              {emailChangeSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 mt-0.5 shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <div>
                        <p className="font-medium text-emerald-600">Verification emails sent!</p>
                        <p className="text-sm text-emerald-600 mt-1">
                          We've sent verification emails to both your current email ({userEmail}) and your new email address. Please check both inboxes and click the confirmation links to complete the change.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeEmailModal}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailChange} className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter your new email address. We'll send verification emails to both your current and new email addresses to confirm the change.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Current Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      disabled
                      className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      New Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter your new email address"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  {emailChangeError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                      <p className="text-sm text-red-600">{emailChangeError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeEmailModal}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={emailChangeLoading || !newEmail}
                      className={`flex-1 px-4 py-3 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        emailChangeLoading || !newEmail
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {emailChangeLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Verification'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closePasswordModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="font-heading font-bold text-xl text-gray-900 mb-2">
                Change Password
              </h3>

              {passwordChangeSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 mt-0.5 shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <div>
                        <p className="font-medium text-emerald-600">Password updated!</p>
                        <p className="text-sm text-emerald-600 mt-1">
                          Your password has been changed successfully.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closePasswordModal}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter your new password. It must be at least 8 characters long.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      minLength={8}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      minLength={8}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  {passwordChangeError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                      <p className="text-sm text-red-600">{passwordChangeError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closePasswordModal}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordChangeLoading || !newPassword || !confirmPassword}
                      className={`flex-1 px-4 py-3 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        passwordChangeLoading || !newPassword || !confirmPassword
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {passwordChangeLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountPage;
