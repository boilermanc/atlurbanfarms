
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparkleIcon } from '../constants';
import { useCategories, useProducts, useBrandingSettings, useCustomerProfile } from '../src/hooks/useSupabase';
import { useAuth } from '../src/hooks/useAuth';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onNavigate: (view: 'home' | 'shop' | 'faq' | 'about' | 'schools' | 'calendar' | 'tools' | 'blog' | 'gift-cards' | 'login' | 'account', category?: string) => void;
  currentView?: string;
  onSearch?: (query: string) => void;
}

const ANNOUNCEMENT_DISMISSED_KEY = 'announcement_bar_dismissed';

const Header: React.FC<HeaderProps> = ({ cartCount, onOpenCart, onNavigate, currentView, onSearch }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isAboutDropdownOpen, setIsAboutDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navBarRef = useRef<HTMLElement>(null);
  const shopDropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { categories: rawCategories } = useCategories();
  const { products: rawProducts } = useProducts();
  const { user, loading: authLoading, signOut } = useAuth();
  const { settings: brandingSettings, loading: brandingLoading } = useBrandingSettings();
  const { profile: customerProfile } = useCustomerProfile(user?.id);

  // Derive the avatar initial from the customer's first_name, falling back to email
  const avatarInitial = (customerProfile?.first_name?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase();

  // Check if announcement was previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
    if (dismissed === brandingSettings.announcement_bar_text) {
      setIsAnnouncementDismissed(true);
    }
  }, [brandingSettings.announcement_bar_text]);

  // Reset logo error when logo URL changes
  useEffect(() => {
    setLogoError(false);
  }, [brandingSettings.logo_url]);

  const handleDismissAnnouncement = () => {
    setIsAnnouncementDismissed(true);
    localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, brandingSettings.announcement_bar_text);
  };

  // Show announcement bar if enabled, has text, and not dismissed
  const showAnnouncementBar = !brandingLoading &&
    brandingSettings.announcement_bar_enabled &&
    brandingSettings.announcement_bar_text &&
    !isAnnouncementDismissed;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Timeout-based hover for Shop mega-menu: the fixed-position dropdown
  // sits outside the wrapper's layout bounds, so a brief grace period
  // prevents the dropdown from closing while the mouse traverses the gap.
  const handleShopMouseEnter = () => {
    if (shopDropdownTimeout.current) {
      clearTimeout(shopDropdownTimeout.current);
      shopDropdownTimeout.current = null;
    }
    setIsShopDropdownOpen(true);
  };
  const handleShopMouseLeave = () => {
    shopDropdownTimeout.current = setTimeout(() => {
      setIsShopDropdownOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (shopDropdownTimeout.current) clearTimeout(shopDropdownTimeout.current);
    };
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  // Build set of category IDs that have at least one active product
  const categoryIdsWithProducts = useMemo(() => {
    const ids = new Set<string>();
    rawProducts.forEach((rp: any) => {
      const assignments = rp.category_assignments || [];
      assignments.forEach((a: any) => {
        if (a.category_id) ids.add(a.category_id);
        if (a.category?.parent_id) ids.add(a.category.parent_id);
      });
      if (assignments.length === 0 && rp.category) {
        ids.add(rp.category.id);
        if (rp.category.parent_id) ids.add(rp.category.parent_id);
      }
    });
    return ids;
  }, [rawProducts]);

  // Grouped categories for mega-menu (desktop)
  const shopGroups = useMemo(() => {
    const allCategories = rawCategories as any[];
    const parents = allCategories
      .filter((c) => !c.parent_id && categoryIdsWithProducts.has(c.id));
    const children = allCategories.filter((c) => c.parent_id);

    return parents.map((p) => ({
      name: p.name,
      category: p.name,
      children: children
        .filter((c) => c.parent_id === p.id && categoryIdsWithProducts.has(c.id))
        .map((c) => ({ name: c.name, category: c.name })),
    }));
  }, [rawCategories, categoryIdsWithProducts]);

  // Flat list for mobile menu
  const SHOP_ITEMS = useMemo(() => {
    const items: { name: string; category: string; featured?: boolean; isChild?: boolean }[] = [
      { name: 'All Products', category: 'All' },
    ];
    shopGroups.forEach((group) => {
      items.push({ name: group.name, category: group.category });
      group.children.forEach((child) => {
        items.push({ name: child.name, category: child.category, isChild: true });
      });
    });
    items.push({ name: 'Tower Planner', category: 'All', featured: true });
    return items;
  }, [shopGroups]);

  // Get the bottom edge of the nav bar for mega-menu positioning
  const getNavBottom = () => {
    if (navBarRef.current) {
      const rect = navBarRef.current.getBoundingClientRect();
      return rect.bottom;
    }
    return isScrolled ? 52 : 68;
  };

  // About dropdown sections — must match id attributes in AboutPage.tsx
  const ABOUT_SECTIONS = [
    { label: 'About Us', hash: '' },
    { label: 'Our Story', hash: 'our-story' },
    { label: 'Our Approach', hash: 'our-approach' },
    { label: 'Technology', hash: 'technology' },
    { label: 'Our Team', hash: 'our-team' },
  ];

  const handleAboutNavigate = (hash: string) => {
    onNavigate('about');
    setIsAboutDropdownOpen(false);
    setIsMobileMenuOpen(false);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    }
  };

  // Default text logo fallback - cleaner, more prominent
  const defaultLogo = (
    <>
      <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg md:text-xl lg:text-2xl shadow-md group-hover:scale-105 transition-all duration-300 brand-bg">
        A
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-heading text-lg md:text-xl lg:text-2xl font-extrabold tracking-tight text-gray-900">
          ATL Urban Farms
        </span>
        <span className="text-[10px] md:text-xs font-medium text-gray-500 tracking-wide hidden sm:block">
          Fresh Local Produce
        </span>
      </div>
    </>
  );

  const logo = (
    <div onClick={handleLogoClick} className="flex items-center gap-2.5 group cursor-pointer select-none">
      {brandingSettings.logo_url && !logoError ? (
        <img
          src={brandingSettings.logo_url}
          alt="ATL Urban Farms"
          className="h-10 md:h-12 lg:h-16 w-auto object-contain group-hover:scale-[1.02] transition-transform duration-300"
          onError={() => setLogoError(true)}
        />
      ) : (
        defaultLogo
      )}
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Announcement Bar */}
      <AnimatePresence>
        {showAnnouncementBar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="brand-bg text-white text-[10px] md:text-xs py-2.5 px-8 md:px-12 lg:px-16 text-center font-semibold tracking-wide relative overflow-hidden"
          >
            <span className="pr-6">{brandingSettings.announcement_bar_text}</span>
            <button
              onClick={handleDismissAnnouncement}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss announcement"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="10" x2="2" y1="2" y2="10"/>
                <line x1="2" x2="10" y1="2" y2="10"/>
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Navigation */}
      <nav
        ref={navBarRef}
        className={`transition-all duration-300 ease-out lg:bg-emerald-900 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-lg py-2.5 shadow-sm border-b border-gray-100/50 lg:shadow-none lg:border-transparent'
            : 'bg-white py-3'
        }`}
      >
        <div className="max-w-7xl mx-auto px-8 md:px-10 lg:px-16">
          <div className="flex items-center justify-between gap-4">

            {/* Mobile: Hamburger (left) */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" x2="21" y1="6" y2="6"/>
                  <line x1="3" x2="21" y1="12" y2="12"/>
                  <line x1="3" x2="21" y1="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Mobile: Center logo */}
            <div className="lg:hidden flex-1 flex justify-center">{logo}</div>

            {/* Desktop: White rounded pill with logo + nav links */}
            <div className="hidden lg:flex items-center bg-white rounded-full pl-3 pr-1.5 py-1.5 shadow-lg">
              <div className="flex-shrink-0">{logo}</div>
              <div className="w-px h-8 bg-gray-200 mx-3" />
              <nav className="flex items-center gap-0.5 font-heading">
                {/* Shop Mega-Menu */}
                <div
                  onMouseEnter={handleShopMouseEnter}
                  onMouseLeave={handleShopMouseLeave}
                >
                  <button
                    onClick={() => onNavigate('shop')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-base font-semibold rounded-full transition-all duration-200 ${
                      currentView === 'shop'
                        ? 'brand-text brand-bg-light'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Shop
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isShopDropdownOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>

                  <AnimatePresence>
                    {isShopDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onMouseEnter={handleShopMouseEnter}
                        onMouseLeave={handleShopMouseLeave}
                        className="fixed left-1/2 -translate-x-1/2 pt-4 z-50"
                        style={{ top: `${getNavBottom()}px`, width: 'min(92vw, 820px)' }}
                      >
                        <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
                          {/* Top bar: All Products + Tower Planner */}
                          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100">
                            <button
                              onClick={() => {
                                onNavigate('shop', 'All');
                                setIsShopDropdownOpen(false);
                              }}
                              className="text-sm font-bold text-gray-900 hover:brand-text transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                              </svg>
                              Browse All Products
                            </button>
                            <button
                              onClick={() => {
                                onNavigate('shop', 'All');
                                setIsShopDropdownOpen(false);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 text-sm font-semibold hover:from-purple-100 hover:to-pink-100 transition-all"
                            >
                              <SparkleIcon className="w-4 h-4 text-purple-400" />
                              Tower Planner
                            </button>
                          </div>

                          {/* Category columns */}
                          <div className="px-6 py-5">
                            <div
                              className="grid gap-x-8 gap-y-2"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(shopGroups.length || 1, 4)}, minmax(0, 1fr))`,
                              }}
                            >
                              {shopGroups.map((group) => (
                                <div key={group.name} className="min-w-0">
                                  {/* Parent category header */}
                                  <button
                                    onClick={() => {
                                      onNavigate('shop', group.category);
                                      setIsShopDropdownOpen(false);
                                    }}
                                    className="w-full text-left text-[13px] font-bold text-gray-900 uppercase tracking-wide pb-2 mb-1 border-b-2 border-gray-100 hover:brand-text transition-colors"
                                  >
                                    {group.name}
                                  </button>
                                  {/* Child categories */}
                                  <div className="space-y-0.5 mt-1">
                                    {group.children.map((child) => (
                                      <button
                                        key={child.name}
                                        onClick={() => {
                                          onNavigate('shop', child.category);
                                          setIsShopDropdownOpen(false);
                                        }}
                                        className="w-full text-left py-1.5 px-2 text-sm text-gray-500 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-all font-medium"
                                      >
                                        {child.name}
                                      </button>
                                    ))}
                                    {group.children.length === 0 && (
                                      <button
                                        onClick={() => {
                                          onNavigate('shop', group.category);
                                          setIsShopDropdownOpen(false);
                                        }}
                                        className="w-full text-left py-1.5 px-2 text-sm text-gray-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all font-medium"
                                      >
                                        View all
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Other Nav Items */}
                {[
                  { key: 'gift-cards', label: 'Gift Cards' },
                  { key: 'faq', label: 'FAQ' },
                  { key: 'schools', label: 'Schools' },
                  { key: 'calendar', label: 'Calendar' },
                  { key: 'blog', label: 'Blog' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key as any)}
                    className={`px-4 py-2 text-base font-semibold rounded-full transition-all duration-200 ${
                      currentView === item.key
                        ? 'brand-text brand-bg-light'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                {/* About Dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => setIsAboutDropdownOpen(true)}
                  onMouseLeave={() => setIsAboutDropdownOpen(false)}
                >
                  <button
                    onClick={() => handleAboutNavigate('')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-base font-semibold rounded-full transition-all duration-200 ${
                      currentView === 'about'
                        ? 'brand-text brand-bg-light'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    About
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isAboutDropdownOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>

                  <AnimatePresence>
                    {isAboutDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50"
                      >
                        <div className="bg-white rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden py-1 w-48">
                          {ABOUT_SECTIONS.map((section) => (
                            <button
                              key={section.label}
                              onClick={() => handleAboutNavigate(section.hash)}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                              {section.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tools */}
                <button
                  onClick={() => onNavigate('tools')}
                  className={`px-4 py-2 text-base font-semibold rounded-full transition-all duration-200 ${
                    currentView === 'tools'
                      ? 'brand-text brand-bg-light'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Tools
                </button>
              </nav>
            </div>

            {/* Right Actions: Search, Account, Cart */}
            <div className="flex items-center gap-1 lg:gap-1.5 lg:bg-white lg:rounded-full lg:pl-1.5 lg:pr-3 lg:py-1.5 lg:shadow-lg overflow-visible">
              {/* Search Icon / Expanded Search */}
              <div className="relative hidden sm:block">
                <AnimatePresence mode="wait">
                  {isSearchOpen ? (
                    <motion.form
                      key="search-form"
                      initial={{ width: 40, opacity: 0 }}
                      animate={{ width: 220, opacity: 1 }}
                      exit={{ width: 40, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      onSubmit={handleSearch}
                      className="flex items-center"
                    >
                      <div className="relative flex items-center w-full">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search products..."
                          className="w-full pl-4 pr-10 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-emerald-500/20 bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="absolute right-2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="14" x2="2" y1="2" y2="14"/>
                            <line x1="2" x2="14" y1="2" y2="14"/>
                          </svg>
                        </button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.button
                      key="search-icon"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsSearchOpen(true)}
                      className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                      aria-label="Search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                      </svg>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Account/Login */}
              {!authLoading && (
                <>
                  {user ? (
                    <div
                      className="relative"
                      onMouseEnter={() => setIsUserDropdownOpen(true)}
                      onMouseLeave={() => setIsUserDropdownOpen(false)}
                    >
                      <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center brand-bg">
                          <span className="text-sm font-bold text-white">
                            {avatarInitial}
                          </span>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isUserDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute top-full right-0 w-56 bg-white rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mt-2 py-1"
                          >
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                              <p className="text-xs text-gray-400 font-medium">Signed in as</p>
                              <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
                            </div>
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  onNavigate('account');
                                  setIsUserDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-3"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                My Account
                              </button>
                              <button
                                onClick={() => {
                                  onNavigate('account');
                                  setIsUserDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-3"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                  <line x1="16" y1="2" x2="16" y2="6"/>
                                  <line x1="8" y1="2" x2="8" y2="6"/>
                                  <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                Order History
                              </button>
                            </div>
                            <div className="border-t border-gray-100">
                              <button
                                onClick={async () => {
                                  await signOut();
                                  setIsUserDropdownOpen(false);
                                  onNavigate('home');
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                  <polyline points="16 17 21 12 16 7" />
                                  <line x1="21" x2="9" y1="12" y2="12" />
                                </svg>
                                Sign Out
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Sign In Button */}
                      <button
                        onClick={() => onNavigate('login')}
                        className="hidden lg:flex items-center gap-2 px-4 py-2 text-base font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                      >
                        Sign In
                      </button>
                      {/* Mobile/Tablet login icon */}
                      <button
                        onClick={() => onNavigate('login')}
                        className="lg:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                        aria-label="Sign in"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Cart Button - only visible when cart has items */}
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onOpenCart}
                    className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors duration-200 overflow-visible"
                    aria-label="Shopping cart"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                      <path d="M3 6h18"/>
                      <path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [1.2, 1], opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="absolute -top-1 -right-1 brand-bg text-white text-[11px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1.5"
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </motion.span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[85%] max-w-[340px] bg-white z-[110] shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div onClick={() => setIsMobileMenuOpen(false)}>{logo}</div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" x2="6" y1="6" y2="18"/>
                    <line x1="6" x2="18" y1="6" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Search Bar (Mobile) */}
              <div className="px-5 py-3 border-b border-gray-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim() && onSearch) {
                      onSearch(searchQuery.trim());
                      setIsMobileMenuOpen(false);
                      setSearchQuery('');
                    }
                  }}
                  className="relative"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </form>
              </div>

              {/* Navigation */}
              <div className="flex-1 overflow-y-auto font-heading">
                {/* Shop Section */}
                <div className="px-5 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Shop</h3>
                  <div className="space-y-1">
                    {SHOP_ITEMS.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => {
                          onNavigate('shop', item.category);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full text-left flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
                          item.featured
                            ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 font-semibold'
                            : item.isChild
                            ? 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium pl-6'
                            : 'text-gray-700 hover:bg-gray-50 font-semibold'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.isChild && <span className="text-gray-300 text-sm">›</span>}
                          {item.name}
                        </span>
                        {item.featured && <SparkleIcon className="w-4 h-4 text-purple-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other Links */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Menu</h3>
                  <div className="space-y-1">
                    {/* Gift Cards */}
                    <button
                      onClick={() => {
                        onNavigate('gift-cards');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'gift-cards'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      Gift Cards
                    </button>

                    {/* FAQs */}
                    <button
                      onClick={() => {
                        onNavigate('faq');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'faq'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      FAQ
                    </button>

                    {/* Schools */}
                    <button
                      onClick={() => {
                        onNavigate('schools');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'schools'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                      </svg>
                      Schools
                    </button>

                    {/* Calendar */}
                    <button
                      onClick={() => {
                        onNavigate('calendar');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'calendar'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Calendar
                    </button>

                    {/* Blog */}
                    <button
                      onClick={() => {
                        onNavigate('blog');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'blog'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                      </svg>
                      Blog
                    </button>

                    {/* About Us + sub-items */}
                    <button
                      onClick={() => handleAboutNavigate('')}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'about'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-semibold'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      About Us
                    </button>
                    {ABOUT_SECTIONS.filter((s) => s.hash).map((item) => (
                      <button
                        key={item.hash}
                        onClick={() => handleAboutNavigate(item.hash)}
                        className="w-full text-left flex items-center gap-2 py-2.5 px-3 pl-11 rounded-lg transition-colors text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium"
                      >
                        <span className="text-gray-300 text-sm">›</span>
                        {item.label}
                      </button>
                    ))}

                    {/* Tools */}
                    <button
                      onClick={() => {
                        onNavigate('tools');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        currentView === 'tools'
                          ? 'brand-bg-light brand-text font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                    >
                      <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                      </svg>
                      Tools
                    </button>
                  </div>
                </div>
              </div>

              {/* Account Footer */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                {!authLoading && (
                  user ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 py-2">
                        <div className="w-10 h-10 brand-bg rounded-full flex items-center justify-center">
                          <span className="text-base font-bold text-white">
                            {avatarInitial}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">My Account</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onNavigate('account');
                            setIsMobileMenuOpen(false);
                          }}
                          className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Account
                        </button>
                        <button
                          onClick={async () => {
                            await signOut();
                            setIsMobileMenuOpen(false);
                            onNavigate('home');
                          }}
                          className="py-2 px-3 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onNavigate('login');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 font-semibold text-white rounded-lg btn-brand transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Sign In / Create Account
                    </button>
                  )
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
