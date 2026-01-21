import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface WelcomePageProps {
  onNavigate: (view: string, category?: string) => void;
}

type GrowingPreference = 'tower-garden' | 'soil' | 'starter';

// ============ SVG DOODLE COMPONENTS ============

const LeafDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path
      d="M20 5C20 5 8 12 8 24C8 32 14 36 20 36C26 36 32 32 32 24C32 12 20 5 20 5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M20 12V32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M20 18L14 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M20 24L26 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const VineDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 30" fill="none" className={className}>
    <path
      d="M5 15Q20 5 35 15T65 15T95 15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="20" cy="10" r="3" stroke="currentColor" strokeWidth="1" fill="none" />
    <circle cx="50" cy="20" r="2.5" stroke="currentColor" strokeWidth="1" fill="none" />
    <circle cx="80" cy="8" r="3" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const SquiggleUnderline: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 12" fill="none" className={className}>
    <path
      d="M2 6Q15 2 30 6T60 6T90 6T120 6T150 6T180 6T198 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const TowerDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 50" fill="none" className={className}>
    <rect x="12" y="5" width="16" height="40" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="12" y1="15" x2="28" y2="15" stroke="currentColor" strokeWidth="1" />
    <line x1="12" y1="25" x2="28" y2="25" stroke="currentColor" strokeWidth="1" />
    <line x1="12" y1="35" x2="28" y2="35" stroke="currentColor" strokeWidth="1" />
    <path d="M16 10L20 6L24 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
    <path d="M16 20L20 16L24 20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
    <path d="M16 30L20 26L24 30" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
  </svg>
);

const SunDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="20" y1="4" x2="20" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="31" x2="20" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="4" y1="20" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="31" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8.8" y1="8.8" x2="12.3" y2="12.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="27.7" y1="27.7" x2="31.2" y2="31.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8.8" y1="31.2" x2="12.3" y2="27.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="27.7" y1="12.3" x2="31.2" y2="8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SeedlingDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 50" fill="none" className={className}>
    <path d="M20 45V25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M20 25C20 25 10 22 10 14C10 8 15 5 20 8C25 5 30 8 30 14C30 22 20 25 20 25Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path d="M20 18L15 14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M20 18L25 14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <ellipse cx="20" cy="47" rx="8" ry="2" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const FlowerDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 50 50" fill="none" className={className}>
    <circle cx="25" cy="25" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <ellipse cx="25" cy="12" rx="4" ry="7" stroke="currentColor" strokeWidth="1" fill="none" />
    <ellipse cx="25" cy="38" rx="4" ry="7" stroke="currentColor" strokeWidth="1" fill="none" />
    <ellipse cx="12" cy="25" rx="7" ry="4" stroke="currentColor" strokeWidth="1" fill="none" />
    <ellipse cx="38" cy="25" rx="7" ry="4" stroke="currentColor" strokeWidth="1" fill="none" />
    <ellipse cx="15.8" cy="15.8" rx="4" ry="6" transform="rotate(-45 15.8 15.8)" stroke="currentColor" strokeWidth="1" fill="none" />
    <ellipse cx="34.2" cy="34.2" rx="4" ry="6" transform="rotate(-45 34.2 34.2)" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const ArrowDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 60 30" fill="none" className={className}>
    <path
      d="M5 15Q20 20 35 15T55 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M48 10L55 15L48 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const CheckboxDoodle: React.FC<{ checked?: boolean; className?: string }> = ({ checked, className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {checked && (
      <path d="M6 12L10 16L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </svg>
);

// ============ WASHI TAPE COMPONENT ============
const WashiTape: React.FC<{ rotation?: number; color?: string; className?: string }> = ({
  rotation = 0,
  color = 'emerald',
  className
}) => {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-300/80 to-emerald-400/80',
    amber: 'from-amber-300/80 to-amber-400/80',
    rose: 'from-rose-300/80 to-rose-400/80',
    blue: 'from-blue-300/80 to-blue-400/80',
  };

  return (
    <div
      className={`h-6 w-20 bg-gradient-to-r ${colors[color]} rounded-sm shadow-sm ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)`
      }}
    />
  );
};

// ============ MAIN COMPONENT ============
const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate }) => {
  const [isLoading, setIsLoading] = useState(true);

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

  const handlePathClick = (preference: GrowingPreference, filterParam: string) => {
    localStorage.setItem('atluf_welcome_seen', 'true');
    localStorage.setItem('atluf_growing_preference', preference);
    onNavigate('shop', filterParam);
  };

  const handleBrowseAll = () => {
    localStorage.setItem('atluf_welcome_seen', 'true');
    onNavigate('shop');
  };

  const currentDate = new Date();
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const growingPaths = [
    {
      id: 'tower-garden' as GrowingPreference,
      title: 'Tower Garden Grower',
      description: 'Hydroponic seedlings for your Tower Garden',
      icon: TowerDoodle,
      filter: 'tower-garden',
      rotation: -2,
      tapeColor: 'emerald',
    },
    {
      id: 'soil' as GrowingPreference,
      title: 'Traditional Gardener',
      description: 'For raised beds & backyard gardens',
      icon: SunDoodle,
      filter: 'soil',
      rotation: 1,
      tapeColor: 'amber',
    },
    {
      id: 'starter' as GrowingPreference,
      title: 'Just Getting Started',
      description: 'Beginner-friendly starter bundles',
      icon: SeedlingDoodle,
      filter: 'starter-bundles',
      rotation: -1,
      tapeColor: 'blue',
    },
  ];

  const seasonalPlants = [
    { name: 'Lettuce Mix', emoji: '🥬', note: 'Perfect for salads!' },
    { name: 'Sweet Basil', emoji: '🌿', note: 'Smells amazing' },
    { name: 'Cherry Tomatoes', emoji: '🍅', note: 'Kids love these' },
    { name: 'Bell Peppers', emoji: '🫑', note: 'So colorful!' },
  ];

  // Show nothing while checking localStorage (prevents flash)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-emerald-600 font-handwriting text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Paper texture background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundColor: '#faf8f3',
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(139, 90, 43, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(139, 90, 43, 0.02) 0%, transparent 50%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")
          `
        }}
      />

      {/* Soft vignette/shadow around edges */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 100px rgba(139, 90, 43, 0.08)'
        }}
      />

      {/* Decorative vine in top left */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="absolute top-20 left-4 text-emerald-600/30 hidden md:block"
      >
        <VineDoodle className="w-32 h-10" />
      </motion.div>

      {/* Pressed flower decoration - top right */}
      <motion.div
        initial={{ opacity: 0, rotate: -10 }}
        animate={{ opacity: 0.2, rotate: 15 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="absolute top-40 right-8 text-rose-400 hidden lg:block"
      >
        <FlowerDoodle className="w-16 h-16" />
      </motion.div>

      {/* Coffee ring stain - subtle */}
      <div
        className="absolute bottom-32 right-20 w-24 h-24 rounded-full hidden lg:block"
        style={{
          background: 'radial-gradient(circle, transparent 40%, rgba(139, 90, 43, 0.04) 45%, rgba(139, 90, 43, 0.06) 50%, transparent 55%)'
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto px-4 py-8 md:py-12"
      >
        {/* ============ SHEREE'S WELCOME NOTE ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <div
            className="relative bg-white/80 rounded-lg shadow-lg p-6 md:p-10"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  transparent,
                  transparent 31px,
                  rgba(16, 185, 129, 0.1) 31px,
                  rgba(16, 185, 129, 0.1) 32px
                )
              `,
              backgroundPosition: '0 20px'
            }}
          >
            {/* Polaroid photo - top right */}
            <motion.div
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 4 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="absolute -top-4 right-4 md:right-8 z-10"
            >
              <div className="bg-white p-2 pb-8 shadow-lg" style={{ transform: 'rotate(4deg)' }}>
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                  <div className="text-center text-emerald-600">
                    <LeafDoodle className="w-8 h-8 mx-auto mb-1" />
                    <span className="text-xs font-handwriting">Photo Soon!</span>
                  </div>
                </div>
                <p className="text-center text-xs mt-2 font-handwriting text-gray-500">Sheree 💚</p>
              </div>
              {/* Washi tape on polaroid */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <WashiTape rotation={-8} color="emerald" className="w-16 h-4" />
              </div>
            </motion.div>

            {/* Welcome content */}
            <div className="pr-24 md:pr-36">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="font-handwriting text-4xl md:text-5xl text-gray-800 mb-6"
              >
                Welcome to ATL Urban Farms!
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="font-handwriting-alt text-xl md:text-2xl text-gray-700 leading-relaxed space-y-4"
              >
                <p>
                  Welcome to the ATL Urban Farms family! I'm Sheree, and I'm so thrilled you're here.
                </p>
                <p>
                  Whether you're growing in a Tower Garden or getting your hands dirty in the backyard — we're here to help you grow something amazing.
                </p>
                <p>
                  Every seedling is raised with love right here in Atlanta. I can't wait to be part of your growing journey!
                </p>
              </motion.div>

              {/* Signature */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 flex items-end gap-3"
              >
                <span className="font-handwriting text-3xl text-gray-700 italic">xo, Sheree</span>
                <span className="text-2xl">🌱</span>
                <LeafDoodle className="w-8 h-8 text-emerald-500 ml-2" />
              </motion.div>
            </div>

            {/* Decorative leaf in corner */}
            <div className="absolute bottom-4 left-4 text-emerald-400/20">
              <LeafDoodle className="w-12 h-12" />
            </div>
          </div>
        </motion.section>

        {/* ============ GROWING PATHS SECTION ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <div className="text-center mb-8">
            <h2 className="font-handwriting text-3xl md:text-4xl text-gray-800 mb-2">
              So, how do you like to grow?
            </h2>
            <SquiggleUnderline className="w-48 h-4 mx-auto text-emerald-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {growingPaths.map((path, index) => {
              const IconComponent = path.icon;
              return (
                <motion.button
                  key={path.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => handlePathClick(path.id, path.filter)}
                  className="relative text-left group"
                  style={{ transform: `rotate(${path.rotation}deg)` }}
                >
                  {/* Sticky note card */}
                  <div
                    className="bg-amber-50/90 p-6 shadow-md hover:shadow-lg transition-shadow"
                    style={{
                      backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, transparent 5%)'
                    }}
                  >
                    {/* Tape at top */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <WashiTape rotation={0} color={path.tapeColor} className="w-14 h-4" />
                    </div>

                    <div className="flex flex-col items-center text-center pt-2">
                      <IconComponent className="w-12 h-12 text-gray-600 mb-4 group-hover:text-emerald-600 transition-colors" />
                      <h3 className="font-handwriting text-2xl text-gray-800 mb-2">
                        {path.title}
                      </h3>
                      <p className="font-handwriting-alt text-gray-600 text-lg">
                        {path.description}
                      </p>

                      {/* Click here annotation */}
                      <div className="mt-4 flex items-center text-emerald-600 font-handwriting text-xl">
                        <span>click here!</span>
                        <ArrowDoodle className="w-12 h-6 ml-1" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ============ SEASONAL PICKS SECTION ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-12"
        >
          <div className="mb-8">
            <h2 className="font-handwriting text-3xl md:text-4xl text-gray-800 inline-block">
              What's growing good right now
            </h2>
            <SquiggleUnderline className="w-64 h-4 text-amber-500 -mt-1" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {seasonalPlants.map((plant, index) => (
              <motion.div
                key={plant.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ y: -4, rotate: 0 }}
                onClick={handleBrowseAll}
                className="cursor-pointer"
                style={{ transform: `rotate(${(index % 2 === 0 ? -2 : 2)}deg)` }}
              >
                {/* Seed packet / botanical card style */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-all">
                  <div className="text-center">
                    <span className="text-4xl md:text-5xl block mb-2">{plant.emoji}</span>
                    <h3 className="font-handwriting text-xl text-gray-800">{plant.name}</h3>
                    <p className="font-handwriting-alt text-sm text-gray-500 mt-1 italic">"{plant.note}"</p>
                  </div>
                  {/* Decorative corner */}
                  <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-300/50 rounded-tr" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ============ TRUST SECTION (Sticky Note Style) ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mb-12"
        >
          <div
            className="bg-yellow-100/80 p-6 shadow-lg max-w-md mx-auto"
            style={{ transform: 'rotate(-1deg)' }}
          >
            {/* Pin/tape at top */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <div className="w-6 h-6 bg-red-400 rounded-full shadow-md border-2 border-red-300" />
            </div>

            <h3 className="font-handwriting text-2xl text-gray-800 mb-4 underline decoration-wavy decoration-emerald-400">
              Remember:
            </h3>

            <div className="space-y-3 font-handwriting-alt text-xl text-gray-700">
              <div className="flex items-center gap-3">
                <CheckboxDoodle checked className="w-6 h-6 text-emerald-600" />
                <span>Grown local in Atlanta</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckboxDoodle checked className="w-6 h-6 text-emerald-600" />
                <span>Live plants, not seeds</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckboxDoodle checked className="w-6 h-6 text-emerald-600" />
                <span>We're here to help!</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ============ CTA BUTTON (Bookmark/Ribbon Style) ============ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBrowseAll}
            className="relative inline-block"
          >
            {/* Circled annotation style */}
            <div className="relative px-10 py-4">
              {/* Hand-drawn circle around text */}
              <svg
                className="absolute inset-0 w-full h-full text-emerald-500"
                viewBox="0 0 200 80"
                fill="none"
                preserveAspectRatio="none"
              >
                <ellipse
                  cx="100" cy="40" rx="95" ry="35"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                  fill="none"
                />
              </svg>

              <span className="font-handwriting text-3xl text-gray-800 relative z-10">
                Let's go shopping!
              </span>
            </div>
            <ArrowDoodle className="w-16 h-8 text-emerald-600 mx-auto mt-2" />
          </motion.button>
        </motion.section>

        {/* ============ PAGE FOOTER ============ */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-between items-end text-gray-400 font-handwriting-alt text-sm px-4"
        >
          <span>{monthYear}</span>
          <span>pg. 1</span>
        </motion.footer>

      </motion.div>

      {/* Bottom decorative vine */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="absolute bottom-20 right-4 text-emerald-600/20 hidden md:block"
      >
        <VineDoodle className="w-40 h-12" />
      </motion.div>
    </div>
  );
};

export default WelcomePage;
