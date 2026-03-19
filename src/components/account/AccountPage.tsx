import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useBrandingSettings, useCustomerProfile } from '../../hooks/useSupabase';
import OrderHistory from './OrderHistory';
import AddressBook from './AddressBook';
import ProfileSettings from './ProfileSettings';
import SchoolPortal from './SchoolPortal';
import DashboardHome from './DashboardHome';

interface AccountPageProps {
  onNavigate: (view: string) => void;
}

type AccountTab = 'dashboard' | 'profile' | 'orders' | 'addresses' | 'settings' | 'school-portal' | 'wholesale-portal';

const VALID_TABS: AccountTab[] = ['dashboard', 'profile', 'orders', 'addresses', 'settings', 'school-portal', 'wholesale-portal'];

// Parse initial tab from URL path (e.g. /account/orders → 'orders')
const getTabFromPath = (): AccountTab => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  // segments: ['account'] or ['account', 'profile'] etc.
  if (segments.length >= 2) {
    const tab = segments[1] as AccountTab;
    if (VALID_TABS.includes(tab)) return tab;
  }
  return 'dashboard';
};

const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>(getTabFromPath);
  const [logoError, setLogoError] = useState(false);
  const { settings: brandingSettings } = useBrandingSettings();
  const { profile: customerProfile } = useCustomerProfile(user?.id);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Sync URL when tab changes
  const handleTabChange = (tab: AccountTab) => {
    setActiveTab(tab);
    const path = `/account/${tab}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ view: 'account', tab }, '', path);
    }
  };

  // Set URL to /account/profile on first load if on bare /account
  useEffect(() => {
    if (window.location.pathname === '/account') {
      window.history.replaceState({ view: 'account', tab: 'dashboard' }, '', '/account/dashboard');
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('home');
  };

  // Derive display name from customer profile
  const fullName = [customerProfile?.first_name, customerProfile?.last_name]
    .filter(Boolean)
    .join(' ') || 'Welcome!';

  const accountType = customerProfile?.account_type as string | undefined;

  const tabs = useMemo(() => {
    const baseTabs: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
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
        id: 'orders',
        label: 'Order History',
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

    if (accountType === 'school_partner' || accountType === 'title1_partner') {
      baseTabs.push({
        id: 'school-portal',
        label: 'School Portal',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ),
      });
    }

    if (accountType === 'wholesale') {
      baseTabs.push({
        id: 'wholesale-portal',
        label: 'Wholesale Portal',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      });
    }

    return baseTabs;
  }, [accountType]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-site flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardHome userId={user.id} customerProfile={customerProfile} onNavigate={onNavigate} onTabChange={handleTabChange} />;
      case 'orders':
        return <OrderHistory userId={user.id} onNavigate={onNavigate} />;
      case 'addresses':
        return <AddressBook userId={user.id} />;
      case 'settings':
        return <SettingsTab userId={user.id} userEmail={user.email || ''} onNavigate={onNavigate} />;
      case 'school-portal':
        return <SchoolPortal userId={user.id} isTitle1={accountType === 'title1_partner'} />;
      case 'wholesale-portal':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">Wholesale Portal</h1>
              <p className="text-gray-500">Access wholesale pricing and bulk ordering tools.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">Coming Soon</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Your wholesale portal is being prepared. You'll be able to access wholesale pricing, place bulk orders, and manage your account here.
              </p>
            </div>
          </div>
        );
      case 'profile':
        return <ProfileSettings userId={user.id} userEmail={user.email || ''} onNavigateToSettings={() => handleTabChange('settings')} />;
      default:
        return <DashboardHome userId={user.id} customerProfile={customerProfile} onNavigate={onNavigate} onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-site">
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

            {/* Navigation */}
            <div className="flex items-center gap-4">
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
          </div>
        </div>
      </header>

      {/* Mobile Tabs — horizontal scrollable tabs on small screens */}
      <div className="md:hidden bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex min-w-max px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar — hidden on mobile (tabs shown above instead) */}
          <aside className="hidden md:block md:w-64 shrink-0">
            {/* User Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6"
            >
              <div className="flex items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-gray-900 truncate">
                    {fullName}
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
                  onClick={() => handleTabChange(tab.id)}
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

// Settings Tab Component
interface SettingsTabProps {
  userId: string;
  userEmail: string;
  onNavigate: (view: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ userId, userEmail, onNavigate }) => {
  const { profile, loading: profileLoading } = useCustomerProfile(userId);
  const [newsletterEnabled, setNewsletterEnabled] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [commPrefsSaving, setCommPrefsSaving] = useState(false);
  const [commPrefsSuccess, setCommPrefsSuccess] = useState(false);
  const [commPrefsError, setCommPrefsError] = useState<string | null>(null);
  const [commPrefsDirty, setCommPrefsDirty] = useState(false);

  // Load comm prefs from profile
  useEffect(() => {
    if (profile) {
      setNewsletterEnabled(profile.newsletter_subscribed ?? true);
      setSmsOptIn(profile.sms_opt_in ?? false);
      setCommPrefsDirty(false);
    }
  }, [profile]);

  const handleCommPrefsSave = async () => {
    setCommPrefsSaving(true);
    setCommPrefsError(null);
    setCommPrefsSuccess(false);

    try {
      // Update customers table
      const { error: custError } = await supabase
        .from('customers')
        .update({
          newsletter_subscribed: newsletterEnabled,
          sms_opt_in: smsOptIn,
        })
        .eq('id', userId);

      if (custError) throw custError;

      // Sync to customer_preferences table
      const { error: prefError } = await supabase
        .from('customer_preferences')
        .upsert({
          customer_id: userId,
          newsletter_subscribed: newsletterEnabled,
          sms_notifications: smsOptIn,
        }, { onConflict: 'customer_id' });

      if (prefError) throw prefError;

      setCommPrefsSuccess(true);
      setCommPrefsDirty(false);
      setTimeout(() => setCommPrefsSuccess(false), 3000);
    } catch (err: any) {
      setCommPrefsError(err.message || 'Failed to save preferences');
    } finally {
      setCommPrefsSaving(false);
    }
  };

  // Password change state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const { signOut } = useAuth();

  // Sign out and redirect after successful password change
  useEffect(() => {
    if (passwordChangeSuccess) {
      const timer = setTimeout(async () => {
        await signOut();
        onNavigate('login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [passwordChangeSuccess, signOut, onNavigate]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      setPasswordChangeError('Please enter your current password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }

    setPasswordChangeLoading(true);
    setPasswordChangeError(null);

    try {
      // Verify current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordChangeError('Current password is incorrect');
        setPasswordChangeLoading(false);
        return;
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setPasswordChangeSuccess(true);
      setCurrentPassword('');
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
    setCurrentPassword('');
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

        {commPrefsSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl"
          >
            <p className="text-sm text-emerald-600 font-medium">Preferences saved!</p>
          </motion.div>
        )}

        {commPrefsError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl"
          >
            <p className="text-sm text-red-600 font-medium">{commPrefsError}</p>
          </motion.div>
        )}

        <div className="flex items-center justify-between py-3 border-b border-gray-50">
          <div>
            <p className="font-medium text-gray-900">Newsletter</p>
            <p className="text-sm text-gray-500">Receive updates about new products and promotions</p>
          </div>
          <button
            onClick={() => { setNewsletterEnabled(!newsletterEnabled); setCommPrefsDirty(true); }}
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
            onClick={() => { setSmsOptIn(!smsOptIn); setCommPrefsDirty(true); }}
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

        {commPrefsDirty && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCommPrefsSave}
              disabled={commPrefsSaving}
              className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
                commPrefsSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {commPrefsSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        )}
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
                          Your password has been changed successfully. You will be signed out momentarily.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Verify your current password, then enter a new one (at least 8 characters).
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>

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
                      disabled={passwordChangeLoading || !currentPassword || !newPassword || !confirmPassword}
                      className={`flex-1 px-4 py-3 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        passwordChangeLoading || !currentPassword || !newPassword || !confirmPassword
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
