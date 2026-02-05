import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useBrandingSettings } from '../hooks/useSupabase';

interface WelcomePageProps {
  onNavigate: (view: string, category?: string) => void;
}

type GrowingPreference = 'tower-garden' | 'soil' | 'starter';

// ============ ICON COMPONENTS ============
const TowerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <rect x="6" y="2" width="12" height="20" rx="1" />
    <line x1="6" y1="7" x2="18" y2="7" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="6" y1="17" x2="18" y2="17" />
    <path d="M10 4.5L12 3L14 4.5" strokeLinecap="round" />
    <path d="M10 9.5L12 8L14 9.5" strokeLinecap="round" />
    <path d="M10 14.5L12 13L14 14.5" strokeLinecap="round" />
  </svg>
);

const GardenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" strokeLinecap="round" />
    <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" />
    <line x1="2" y1="12" x2="5" y2="12" strokeLinecap="round" />
    <line x1="19" y1="12" x2="22" y2="12" strokeLinecap="round" />
    <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" strokeLinecap="round" />
    <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" strokeLinecap="round" />
    <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" strokeLinecap="round" />
    <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" strokeLinecap="round" />
  </svg>
);

const SeedlingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 22V12" strokeLinecap="round" />
    <path d="M12 12C12 12 7 10 7 6C7 3 9 1 12 3C15 1 17 3 17 6C17 10 12 12 12 12Z" />
    <path d="M12 8L9 5" strokeLinecap="round" />
    <path d="M12 8L15 5" strokeLinecap="round" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <path d="M5 12L10 17L19 8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============ MAIN COMPONENT ============
const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { settings: brandingSettings } = useBrandingSettings();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    // Check if user has already seen the welcome page
    const welcomeSeen = localStorage.getItem('atluf_welcome_seen');
    if (welcomeSeen === 'true') {
      // Redirect returning users to shop
      onNavigate('shop');
      return;
    }
    // Show welcome page for new users
    setIsLoading(false);
  }, [onNavigate]);

  // Reset logo error when logo URL changes
  useEffect(() => {
    setLogoError(false);
  }, [brandingSettings.logo_url]);

  const handlePathClick = (preference: GrowingPreference, filterParam: string) => {
    localStorage.setItem('atluf_welcome_seen', 'true');
    localStorage.setItem('atluf_growing_preference', preference);
    onNavigate('shop', filterParam);
  };

  const handleBrowseAll = () => {
    localStorage.setItem('atluf_welcome_seen', 'true');
    onNavigate('shop');
  };

  const growingPaths = [
    {
      id: 'tower-garden' as GrowingPreference,
      title: 'Tower Garden Grower',
      description: 'Hydroponic seedlings optimized for vertical growing systems',
      icon: TowerIcon,
      filter: 'tower-garden',
    },
    {
      id: 'soil' as GrowingPreference,
      title: 'Traditional Gardener',
      description: 'Perfect for raised beds, containers, and backyard gardens',
      icon: GardenIcon,
      filter: 'soil',
    },
    {
      id: 'starter' as GrowingPreference,
      title: 'Just Getting Started',
      description: 'Beginner-friendly bundles with everything you need',
      icon: SeedlingIcon,
      filter: 'starter-bundles',
    },
  ];

  const trustPoints = [
    'Grown locally in Atlanta',
    'Live plants, not seeds',
    'Expert support included',
  ];

  // Show nothing while checking localStorage (prevents flash)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-site">
        <div className="brand-text text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-site">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-[rgba(var(--brand-primary-rgb),0.05)] rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] bg-[rgba(var(--brand-primary-rgb),0.03)] rounded-full blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        {/* ============ HEADER WITH LOGO ============ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          {brandingSettings.logo_url && !logoError ? (
            <img
              src={brandingSettings.logo_url}
              alt="ATL Urban Farms"
              className="h-16 md:h-20 w-auto mx-auto mb-6"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl brand-bg">
                A
              </div>
              <span className="font-heading text-2xl md:text-3xl font-extrabold text-gray-900">
                ATL Urban Farms
              </span>
            </div>
          )}
        </motion.div>

        {/* ============ WELCOME MESSAGE ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-16"
        >
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Welcome to the <span className="brand-text">Family!</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            I'm Sheree, and I'm so thrilled you're here. Whether you're growing in a Tower Garden
            or getting your hands dirty in the backyard — we're here to help you grow something amazing.
          </p>
        </motion.section>

        {/* ============ HOW DO YOU GROW SECTION ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            How do you like to grow?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {growingPaths.map((path, index) => {
              const IconComponent = path.icon;
              return (
                <motion.button
                  key={path.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handlePathClick(path.id, path.filter)}
                  className="group text-left bg-white border-2 border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-xl hover:border-[var(--brand-primary)] transition-all duration-300"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 brand-bg-light brand-text group-hover:brand-bg group-hover:text-white transition-all duration-300">
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-gray-900 mb-2 group-hover:brand-text transition-colors">
                    {path.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed mb-4">
                    {path.description}
                  </p>
                  <div className="flex items-center gap-2 brand-text font-semibold text-sm">
                    <span>Browse plants</span>
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ============ TRUST BADGES ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
              {trustPoints.map((point, index) => (
                <motion.div
                  key={point}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center brand-bg">
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-gray-700">{point}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ============ CTA BUTTON ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center"
        >
          <p className="text-gray-500 mb-6">Not sure where to start?</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBrowseAll}
            className="px-10 py-4 btn-brand rounded-2xl font-bold text-lg transition-all brand-shadow inline-flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
          >
            Browse All Plants
            <ArrowRightIcon className="w-5 h-5" />
          </motion.button>
          <p className="text-sm text-gray-400 mt-4">
            Every seedling is raised with love right here in Atlanta
          </p>
        </motion.section>

        {/* ============ BACK TO HOME ============ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="text-center mt-12"
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
    </div>
  );
};

export default WelcomePage;
