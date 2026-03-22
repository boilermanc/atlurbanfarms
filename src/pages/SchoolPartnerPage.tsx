import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface SchoolPartnerPageProps {
  onNavigate: (view: string) => void;
}

const GRADE_LEVEL_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

const AEROPONIC_SYSTEM_OPTIONS = [
  'Tower Garden', 'Lettuce Grow', 'Aerospring', 'Other', 'Not sure yet',
];

const GROWING_JOURNEY_OPTIONS = [
  { value: 'just_starting', label: "Just getting started — we're new to aeroponics" },
  { value: 'learning', label: "We've grown a season or two — still learning" },
  { value: 'comfortable', label: "We're comfortable — just need better support and resources" },
  { value: 'experienced', label: "We're experienced growers — here for the community and the discount" },
];

// Fetched dynamically from attribution_options table

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.15 } },
};

const SchoolPartnerPage: React.FC<SchoolPartnerPageProps> = ({ onNavigate }) => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    schoolName: '',
    city: '',
    state: '',
    partnershipLevel: 'school_partner' as 'school_partner' | 'title1_partner',
    gradeLevels: [] as string[],
    aeroponicSystems: [] as string[],
    growingJourney: '',
    referralSource: '',
    programNotes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attributionOptions, setAttributionOptions] = useState<{ label: string; value: string }[]>([]);

  // Check if user is already logged in
  useEffect(() => {
    window.scrollTo(0, 0);

    // Fetch attribution options
    const loadAttributionOptions = async () => {
      const { data } = await supabase
        .from('attribution_options')
        .select('label, value')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setAttributionOptions(data);
    };
    loadAttributionOptions();

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser({ id: user.id, email: user.email || '' });
        // Fetch profile to pre-fill name
        const { data: customerData } = await supabase
          .from('customers')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();
        if (customerData) {
          setProfile(customerData);
          setFormData(prev => ({
            ...prev,
            firstName: customerData.first_name || '',
            lastName: customerData.last_name || '',
            email: user.email || '',
          }));
        }
      }
    };
    checkAuth();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setExistingAccount(false);
  };

  const handleChipToggle = (field: 'gradeLevels' | 'aeroponicSystems', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingAccount(false);

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!formData.schoolName.trim()) {
      setError('School or organization name is required.');
      return;
    }
    if (!formData.city.trim()) {
      setError('City is required.');
      return;
    }
    if (!formData.state.trim()) {
      setError('State is required.');
      return;
    }
    if (!currentUser) {
      if (!formData.email.trim()) {
        setError('Email is required.');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let userId = currentUser?.id;

      if (!currentUser) {
        // Create new account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName.trim(),
              last_name: formData.lastName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        // Check for duplicate email (Supabase anti-enumeration)
        if (data.user?.identities?.length === 0) {
          setExistingAccount(true);
          setIsLoading(false);
          return;
        }

        if (!data.user) {
          throw new Error('Account creation failed. Please try again.');
        }

        userId = data.user.id;

        // If we got a session (no email confirmation required), update customer record
        if (data.session) {
          await supabase
            .from('customers')
            .update({
              first_name: formData.firstName.trim(),
              last_name: formData.lastName.trim(),
              referral_source: formData.referralSource || null,
            })
            .eq('id', userId);
        }
      } else {
        // Existing user — update referral source if provided
        if (formData.referralSource) {
          await supabase
            .from('customers')
            .update({ referral_source: formData.referralSource })
            .eq('id', userId);
        }
      }

      // Create school_profiles row
      const { error: profileError } = await supabase
        .from('school_profiles')
        .upsert({
          customer_id: userId,
          school_name: formData.schoolName.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          grade_levels: formData.gradeLevels,
          growing_system: formData.aeroponicSystems.join(', '),
          experience_level: formData.growingJourney || null,
          program_notes: formData.programNotes.trim() || null,
          is_title1: formData.partnershipLevel === 'title1_partner',
          status: 'pending',
          imported_from_mailchimp: false,
        }, { onConflict: 'customer_id' });

      if (profileError) throw profileError;

      setIsSubmitted(true);
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── SUCCESS STATE ───
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-site py-16 px-4 md:px-12">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 md:p-12 border border-gray-100 shadow-sm text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-heading font-extrabold text-gray-900 mb-4">
              You're in!
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Your School Partner account has been created. Your discount and resource library will be active once we've reviewed your application — usually within 1 business day. Watch for an email from{' '}
              <a href="mailto:sheree@atlurbanfarms.com" className="text-emerald-600 font-medium hover:underline">
                sheree@atlurbanfarms.com
              </a>.
            </p>
            <button
              onClick={() => onNavigate('shop')}
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all"
            >
              Start Shopping
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── MAIN PAGE ───
  return (
    <div className="min-h-screen bg-site">
      {/* ─── HERO ─── */}
      <section className="py-16 md:py-24 px-4 md:px-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.h1
            variants={fadeIn}
            className="text-4xl md:text-6xl font-heading font-extrabold text-gray-900 tracking-tight mb-4"
          >
            School Partner Program
          </motion.h1>
          <motion.p
            variants={fadeIn}
            className="text-xl md:text-2xl text-emerald-600 font-heading font-bold mb-8"
          >
            Real Support for Real School Gardens
          </motion.p>
          <motion.p
            variants={fadeIn}
            className="text-lg text-gray-600 leading-relaxed mb-8 max-w-3xl mx-auto"
          >
            ATL Urban Farms has been growing premium aeroponic seedlings since 2013. We know what it takes to keep a school garden thriving — because we've been doing it ourselves. Our School Partner Program gives educators access to healthy, ready-to-grow seedlings, exclusive resources, and real support from people who actually grow.
          </motion.p>
          <motion.div
            variants={fadeIn}
            className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto"
          >
            <p className="text-emerald-800 text-lg italic leading-relaxed">
              "Whether you're setting up your first aeroponic garden or you've been growing with your students for years, you're in the right place!"
            </p>
            <p className="text-emerald-600 font-bold mt-3">— Sheree, ATL Urban Farms</p>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── TWO TIER CARDS ─── */}
      <section className="py-12 px-4 md:px-12 bg-site-secondary">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* School Partner Card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm"
            >
              <div className="text-3xl mb-4">🌱</div>
              <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">
                School Partner
              </h3>
              <p className="text-emerald-600 font-bold text-lg mb-6">
                15% off all orders, automatically applied at checkout
              </p>
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                Includes
              </h4>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  15% discount on every order — applied automatically at checkout
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Access to the School Resource Library (planting guides, lesson tie-ins, garden planning tools)
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Priority support from our team
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Purchase Order payment option (no credit card needed)
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Early access to seasonal availability
                </li>
              </ul>
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Who Qualifies
              </h4>
              <p className="text-gray-500 text-sm">
                K-12 schools, charter schools, homeschool co-ops, and educational nonprofits
              </p>
            </motion.div>

            {/* Title I Partner Card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="bg-white rounded-2xl p-8 border-2 border-emerald-200 shadow-sm relative"
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                Enhanced
              </div>
              <div className="text-3xl mb-4">🌱</div>
              <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">
                Title I Partner
              </h3>
              <p className="text-emerald-600 font-bold text-lg mb-6">
                20% off all orders, automatically applied at checkout
              </p>
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                Everything in School Partner, plus
              </h4>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  20% discount (instead of 15%)
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Additional grant and funding resources
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  Dedicated program support
                </li>
              </ul>
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Who Qualifies
              </h4>
              <p className="text-gray-500 text-sm">
                Title I designated schools
              </p>
            </motion.div>
          </div>

          <div className="text-center mt-8">
            <a
              href="#signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all"
            >
              Sign Up Now
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ─── RESOURCE LIBRARY ─── */}
      <section className="py-16 px-4 md:px-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="max-w-3xl mx-auto"
        >
          <motion.h2
            variants={fadeIn}
            className="text-3xl font-heading font-extrabold text-gray-900 mb-4"
          >
            What's in the Resource Library
          </motion.h2>
          <motion.p
            variants={fadeIn}
            className="text-gray-600 leading-relaxed mb-6"
          >
            When your account is approved, you'll get instant access to our growing library of resources designed specifically for school garden programs. Everything is practical, classroom-tested, and built for aeroponic growing.
          </motion.p>
          <motion.ul variants={fadeIn} className="space-y-3 text-gray-600 mb-6">
            {[
              'Planting guides and seed-to-harvest timelines for Tower Garden and other aeroponic systems',
              'Printable classroom activities tied to STEM and agricultural standards',
              'Garden planning templates and seasonal planting calendars',
              'Tips for maintaining aeroponic systems in a school setting',
              'Grant writing resources and funding ideas for school garden programs',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                {item}
              </li>
            ))}
          </motion.ul>
          <motion.p variants={fadeIn} className="text-gray-500 text-sm italic">
            Resources are added regularly based on what our partner schools tell us they need.
          </motion.p>
        </motion.div>
      </section>

      {/* ─── TOWER GARDEN NOTE ─── */}
      <section className="py-12 px-4 md:px-12 bg-site-secondary">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="max-w-3xl mx-auto bg-white rounded-2xl p-8 border border-gray-100 shadow-sm"
        >
          <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-4">
            A Note for Schools with Tower Garden Systems
          </h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            If your school uses Tower Garden by Juice Plus+, you already know how powerful aeroponic growing can be in the classroom. Our seedlings are specifically grown to thrive in Tower Garden systems — we've been growing in them since 2013.
          </p>
          <p className="text-gray-600 leading-relaxed">
            If you're not sure what system you have, or if you'd like recommendations for getting started, reach out to{' '}
            <a href="mailto:sheree@atlurbanfarms.com" className="text-emerald-600 font-medium hover:underline">
              sheree@atlurbanfarms.com
            </a>
            . We're happy to help.
          </p>
        </motion.div>
      </section>

      {/* ─── SIGNUP FORM ─── */}
      <section id="signup" className="py-16 md:py-24 px-4 md:px-12">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl font-heading font-extrabold text-gray-900 mb-2">
              Sign Up
            </h2>
            <p className="text-gray-500 mb-8">
              Create your free School Partner account below. Your discount will be active and your resource library will be ready the next time you log in.
            </p>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              {/* Error / Existing Account */}
              {existingAccount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6"
                >
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    An account with this email already exists.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors underline"
                  >
                    Log in to your account
                  </button>
                </motion.div>
              )}
              {error && !existingAccount && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-xl mb-6"
                >
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </motion.div>
              )}

              {currentUser && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
                  <p className="text-sm text-emerald-700">
                    Signed in as <strong>{currentUser.email}</strong>. Your School Partner profile will be linked to this account.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1-2. Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* 3. Email (skip if logged in) */}
                {!currentUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      School or Organization Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@school.edu"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>
                )}

                {/* 4. Password (skip if logged in) */}
                {!currentUser && (
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
                    {formData.password && formData.password.length < 8 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Password must be at least 8 characters
                      </p>
                    )}
                  </div>
                )}

                {/* 5. School Name */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    School or Organization Name
                  </label>
                  <input
                    type="text"
                    name="schoolName"
                    value={formData.schoolName}
                    onChange={handleInputChange}
                    placeholder="e.g., Riverside Elementary"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>

                {/* 6. City and State */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="e.g., Atlanta"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="e.g., GA"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* 7. Partnership Level */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Partnership Level
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group p-4 bg-gray-50 border border-gray-100 rounded-xl hover:border-emerald-200 transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
                      <input
                        type="radio"
                        name="partnershipLevel"
                        value="school_partner"
                        checked={formData.partnershipLevel === 'school_partner'}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500/20"
                      />
                      <div>
                        <span className="font-medium text-gray-900">School Partner</span>
                        <span className="text-gray-500 text-sm block">Schools, educational programs, nonprofits — 15% off</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group p-4 bg-gray-50 border border-gray-100 rounded-xl hover:border-emerald-200 transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
                      <input
                        type="radio"
                        name="partnershipLevel"
                        value="title1_partner"
                        checked={formData.partnershipLevel === 'title1_partner'}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500/20"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Title I Partner</span>
                        <span className="text-gray-500 text-sm block">Title I designated schools — 20% off</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 8. Grade Levels (multi-select chips) */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Grade Levels
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_LEVEL_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleChipToggle('gradeLevels', option)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          formData.gradeLevels.includes(option)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 9. Aeroponic Systems (multi-select chips) */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Aeroponic System(s) You Use
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AEROPONIC_SYSTEM_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleChipToggle('aeroponicSystems', option)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          formData.aeroponicSystems.includes(option)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 10. Growing Journey */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Where Are You on Your Growing Journey?
                  </label>
                  <div className="space-y-2">
                    {GROWING_JOURNEY_OPTIONS.map(option => (
                      <label
                        key={option.value}
                        className="flex items-start gap-3 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-emerald-200 transition-all has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300"
                      >
                        <input
                          type="radio"
                          name="growingJourney"
                          value={option.value}
                          checked={formData.growingJourney === option.value}
                          onChange={handleInputChange}
                          className="mt-0.5 w-4 h-4 text-emerald-600 focus:ring-emerald-500/20"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 11. Referral Source */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    How Did You Hear About ATL Urban Farms?
                  </label>
                  <select
                    name="referralSource"
                    value={formData.referralSource}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  >
                    <option value="">Select one</option>
                    {attributionOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* 12. Program Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Anything You Want Us to Know About Your Program?
                  </label>
                  <textarea
                    name="programNotes"
                    value={formData.programNotes}
                    onChange={handleInputChange}
                    placeholder="Optional — tell us about your garden, your goals, or anything else..."
                    rows={3}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all resize-none"
                  />
                </div>

                {/* Submit */}
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
                      Creating account...
                    </>
                  ) : (
                    <>Create My School Partner Account →</>
                  )}
                </button>

                {/* Fine Print */}
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  Your School Partner discount applies automatically every time you shop while logged in. By signing up, you agree to use your discount for educational purposes. We'll never sell your information or fill your inbox with things you don't need.
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER NOTE ─── */}
      <section className="py-16 px-4 md:px-12 bg-site-secondary">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="max-w-3xl mx-auto text-center"
        >
          <h3 className="text-2xl font-heading font-extrabold text-gray-900 mb-4">
            We're Real People. Reach Out Anytime.
          </h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Whether you have questions about the program, need help choosing plants for your classroom, or want to talk through your garden setup — we're here. No chatbots, no runaround.
          </p>
          <a
            href="mailto:sheree@atlurbanfarms.com"
            className="text-emerald-600 font-bold text-lg hover:underline"
          >
            sheree@atlurbanfarms.com
          </a>
          <p className="text-gray-400 mt-6 text-sm">
            Plant People Helping Plant People 🌱
          </p>
        </motion.div>
      </section>
    </div>
  );
};

export default SchoolPartnerPage;
