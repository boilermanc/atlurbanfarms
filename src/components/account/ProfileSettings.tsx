import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCustomerProfile } from '../../hooks/useSupabase';
import { supabase } from '../../lib/supabase';
import { submitNewsletterPreference } from '../../services/newsletter';

interface ProfileSettingsProps {
  userId: string;
  userEmail: string;
}

const GROWING_ENVIRONMENTS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both Indoor & Outdoor' },
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', description: 'Some experience growing' },
  { value: 'advanced', label: 'Advanced', description: 'Several years of experience' },
  { value: 'expert', label: 'Expert', description: 'Professional or long-time grower' },
];

const GROWING_SYSTEMS = [
  { value: 'soil', label: 'Traditional Soil' },
  { value: 'raised_beds', label: 'Raised Beds' },
  { value: 'containers', label: 'Container Gardening' },
  { value: 'hydroponics', label: 'Hydroponics' },
  { value: 'aquaponics', label: 'Aquaponics' },
  { value: 'vertical', label: 'Vertical Growing' },
  { value: 'greenhouse', label: 'Greenhouse' },
];

const GROWING_INTERESTS = [
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'herbs', label: 'Herbs' },
  { value: 'fruits', label: 'Fruits' },
  { value: 'flowers', label: 'Flowers' },
  { value: 'microgreens', label: 'Microgreens' },
  { value: 'mushrooms', label: 'Mushrooms' },
  { value: 'native_plants', label: 'Native Plants' },
  { value: 'succulents', label: 'Succulents' },
];

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ userId, userEmail }) => {
  const { profile, loading, updateProfile } = useCustomerProfile(userId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    growing_environment: '',
    experience_level: '',
    growing_systems: [] as string[],
    growing_interests: [] as string[],
    newsletter_subscribed: true,
    sms_opt_in: false,
  });

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        growing_environment: profile.growing_environment || '',
        experience_level: profile.experience_level || '',
        growing_systems: profile.growing_systems || [],
        growing_interests: profile.growing_interests || [],
        newsletter_subscribed: profile.newsletter_subscribed ?? true,
        sms_opt_in: profile.sms_opt_in ?? false,
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleMultiSelectToggle = (field: 'growing_systems' | 'growing_interests', value: string) => {
    setFormData(prev => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Update auth user metadata for name
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        },
      });

      if (authError) throw authError;

      // Update customer profile
      const result = await updateProfile(formData);
      if (result.error) throw new Error(result.error);

      if (userEmail) {
        await submitNewsletterPreference({
          email: userEmail,
          firstName: formData.first_name || null,
          lastName: formData.last_name || null,
          customerId: userId,
          status: formData.newsletter_subscribed ? 'active' : 'unsubscribed',
          source: 'account_profile',
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-500">Loading your profile...</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          Profile Settings
        </h1>
        <p className="text-gray-500">
          Update your personal information and growing preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm text-emerald-600 font-medium">Profile updated successfully!</p>
          </motion.div>
        )}

        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 border border-red-100 rounded-xl"
          >
            <p className="text-sm text-red-600 font-medium">{saveError}</p>
          </motion.div>
        )}

        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-heading font-bold text-gray-900 mb-6">Personal Information</h2>

          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Email Address
              </label>
              <input
                type="email"
                value={userEmail}
                disabled
                className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">Email cannot be changed here.</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 555-5555"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* Growing Profile */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-heading font-bold text-gray-900 mb-2">Growing Profile</h2>
          <p className="text-sm text-gray-500 mb-6">
            Help us personalize your experience with information about your growing setup.
          </p>

          <div className="space-y-6">
            {/* Growing Environment */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Growing Environment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {GROWING_ENVIRONMENTS.map((env) => (
                  <button
                    key={env.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, growing_environment: env.value }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.growing_environment === env.value
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className={`font-medium ${
                      formData.growing_environment === env.value ? 'text-emerald-600' : 'text-gray-900'
                    }`}>
                      {env.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Experience Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, experience_level: level.value }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.experience_level === level.value
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className={`font-medium block ${
                      formData.experience_level === level.value ? 'text-emerald-600' : 'text-gray-900'
                    }`}>
                      {level.label}
                    </span>
                    <span className="text-sm text-gray-500">{level.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Growing Systems (Multi-select) */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Growing Systems (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {GROWING_SYSTEMS.map((system) => (
                  <button
                    key={system.value}
                    type="button"
                    onClick={() => handleMultiSelectToggle('growing_systems', system.value)}
                    className={`px-4 py-2 rounded-full border-2 font-medium text-sm transition-all ${
                      formData.growing_systems.includes(system.value)
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {formData.growing_systems.includes(system.value) && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {system.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Growing Interests (Multi-select) */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Growing Interests (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {GROWING_INTERESTS.map((interest) => (
                  <button
                    key={interest.value}
                    type="button"
                    onClick={() => handleMultiSelectToggle('growing_interests', interest.value)}
                    className={`px-4 py-2 rounded-full border-2 font-medium text-sm transition-all ${
                      formData.growing_interests.includes(interest.value)
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {formData.growing_interests.includes(interest.value) && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {interest.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Communication Preferences */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-heading font-bold text-gray-900 mb-4">Communication Preferences</h2>

          <div className="space-y-4">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  name="newsletter_subscribed"
                  checked={formData.newsletter_subscribed}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="font-medium text-gray-900 block">Subscribe to Newsletter</span>
                <span className="text-sm text-gray-500">
                  Receive updates about new products, growing tips, and exclusive offers.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-4 cursor-pointer">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  name="sms_opt_in"
                  checked={formData.sms_opt_in}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="font-medium text-gray-900 block">SMS Updates</span>
                <span className="text-sm text-gray-500">
                  Receive text messages about your orders and important updates.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className={`px-8 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
              isSaving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
