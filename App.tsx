
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import CategorySection from './components/CategorySection';
import FeaturedSection from './components/FeaturedSection';
import SageAssistant from './components/SageAssistant';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import CheckoutPage from './src/components/CheckoutPage';
import OrderConfirmationPage from './src/components/OrderConfirmationPage';
import TrackingPage from './src/components/TrackingPage';
import ShopPage from './components/ShopPage';
import CustomerReviews from './components/CustomerReviews';
import MissionSection from './components/MissionSection';
import SproutifySection from './components/SproutifySection';
import PromotionalBanner from './components/PromotionalBanner';
import OutageBanner from './components/OutageBanner';
import FAQPage from './components/FAQPage';
import AboutPage from './components/AboutPage';
import SchoolsPage from './components/SchoolsPage';
import LeadMagnetPopup from './components/LeadMagnetPopup';
import ContentPage from './components/ContentPage';
import CalendarPage from './components/CalendarPage';
import ToolsPage from './components/ToolsPage';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';
import { safeDecodeURIComponent } from './src/utils/url';
import LoginPage from './src/components/auth/LoginPage';
import RegisterPage from './src/components/auth/RegisterPage';
import ForgotPasswordPage from './src/components/auth/ForgotPasswordPage';
import { AccountPage } from './src/components/account';
import { WelcomePage } from './src/pages';
import GiftCardsPage from './src/pages/GiftCardsPage';
import { AuthProvider } from './src/context/AuthContext';
import { SiteContentProvider, usePageContent } from './src/hooks/useSiteContent';
import { AdminLayout } from './src/admin';
import AdminLogin from './src/admin/pages/AdminLogin';
import NewsletterStatusPage from './src/components/NewsletterStatusPage';
import { useBrandingSettings } from './src/hooks/useSupabase';
import { Product, CartItem } from './types';
import { useCartSync } from './src/hooks/useCartSync';

// Helper function to convert hex color to RGB values
function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Return as comma-separated RGB string
  return `${r}, ${g}, ${b}`;
}

interface OrderData {
  order_number: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    category?: string;
    bundleItems?: Array<{ name: string; quantity: number }>;
  }>;
  customerFirstName: string;
  customerEmail: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  pickupInfo?: {
    locationName: string;
    address: string;
    date: string;
    timeRange: string;
    instructions?: string;
  };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  isGuest: boolean;
  isPickup: boolean;
  shippingMethodName?: string;
  estimatedDeliveryDate?: string | null;
  packageBreakdown?: {
    total_packages: number;
    packages: Array<{ name: string; item_count: number }>;
    summary: string;
  } | null;
}

type ViewType = 'home' | 'shop' | 'checkout' | 'order-confirmation' | 'tracking' | 'faq' | 'about' | 'schools' | 'calendar' | 'tools' | 'blog' | 'gift-cards' | 'login' | 'register' | 'forgot-password' | 'account' | 'welcome' | 'admin' | 'admin-login' | 'privacy' | 'terms' | 'newsletter-confirmed' | 'newsletter-unsubscribed';

// Get initial view based on URL path
const getViewFromPath = (pathname: string): ViewType => {
  if (pathname === '/admin/login') return 'admin-login';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/welcome') return 'welcome';
  if (pathname === '/tracking' || pathname.startsWith('/tracking/')) return 'tracking';
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/terms') return 'terms';
  if (pathname === '/schools') return 'schools';
  if (pathname === '/calendar') return 'calendar';
  if (pathname === '/tools') return 'tools';
  if (pathname === '/blog' || pathname.startsWith('/blog/')) return 'blog';
  if (pathname === '/gift-cards') return 'gift-cards';
  if (pathname === '/newsletter/confirmed') return 'newsletter-confirmed';
  if (pathname === '/newsletter/unsubscribed') return 'newsletter-unsubscribed';
  return 'home';
};

// Get URL path for a given view
const getPathForView = (view: ViewType): string => {
  switch (view) {
    case 'admin-login': return '/admin/login';
    case 'admin': return '/admin';
    case 'welcome': return '/welcome';
    case 'tracking': return '/tracking';
    case 'privacy': return '/privacy';
    case 'terms': return '/terms';
    case 'schools': return '/schools';
    case 'calendar': return '/calendar';
    case 'tools': return '/tools';
    case 'blog': return '/blog';
    case 'gift-cards': return '/gift-cards';
    case 'newsletter-confirmed': return '/newsletter/confirmed';
    case 'newsletter-unsubscribed': return '/newsletter/unsubscribed';
    default: return '/';
  }
};

// Schools Promo Section Component - uses CMS content
interface SchoolsPromoSectionProps {
  onNavigate: (view: string) => void;
}

const SchoolsPromoSection: React.FC<SchoolsPromoSectionProps> = ({ onNavigate }) => {
  const { getSection } = usePageContent('home');
  const content = getSection('schools_promo');

  return (
    <section className="py-16 px-4 md:px-12 bg-site-secondary overflow-hidden relative border-b border-gray-200">
      <div className="absolute top-0 right-0 p-16 opacity-[0.04] pointer-events-none">
        <svg className="w-64 h-64 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
      </div>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <img src={content.image_url || 'https://picsum.photos/seed/school/800/600'} alt="School garden program" className="rounded-[3rem] shadow-2xl relative z-10" />
          <div className="absolute -bottom-8 -right-8 w-48 h-48 sage-gradient rounded-full blur-3xl opacity-30"></div>
        </div>
        <div>
          <span className="brand-text font-black uppercase tracking-[0.2em] text-[20px] mb-4 block">
            {content.label || 'Education First'}
          </span>
          <h2
            className="text-5xl md:text-7xl font-heading font-extrabold text-gray-900 tracking-tight mb-8 leading-tight"
            dangerouslySetInnerHTML={{ __html: content.headline || 'Empowering the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>' }}
          />
          <p className="text-lg text-gray-500 mb-10 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content.description || "Our School Seedling Program provides discounted live plants and curriculum support to K-12 schools across Georgia. Let's grow together." }}
          />
          <button
            onClick={() => onNavigate('schools')}
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-3"
          >
            {content.cta_text || 'Partner with Schools'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
};

const App: React.FC = () => {
  const { cart, setCart, addToCart, updateQuantity, removeFromCart, clearCart } = useCartSync();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [view, setView] = useState<ViewType>(() => getViewFromPath(window.location.pathname));
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryNavKey, setCategoryNavKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarFilter, setCalendarFilter] = useState<string | undefined>(undefined);
  const [blogSlug, setBlogSlug] = useState<string | null>(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/blog/') && pathname.length > 6) {
      return safeDecodeURIComponent(pathname.split('/')[2]);
    }
    return null;
  });
  const [completedOrder, setCompletedOrder] = useState<OrderData | null>(null);

  // Fetch branding settings and apply primary brand color
  const { settings: brandingSettings, loading: brandingLoading } = useBrandingSettings();

  // Apply all design tokens as CSS custom properties
  useEffect(() => {
    const s = brandingSettings;
    const doc = document.documentElement.style;

    // Brand colors
    const primary = s?.primary_brand_color || '#10b981';
    const secondary = s?.secondary_brand_color || '#047857';
    doc.setProperty('--brand-primary', primary);
    doc.setProperty('--brand-primary-rgb', hexToRgb(primary));
    doc.setProperty('--brand-secondary', secondary);
    doc.setProperty('--brand-secondary-rgb', hexToRgb(secondary));
    doc.setProperty('--color-brand-light', s?.color_brand_light || '#ecfdf5');

    // Text colors
    doc.setProperty('--color-text-primary', s?.color_text_primary || '#111827');
    doc.setProperty('--color-text-secondary', s?.color_text_secondary || '#6b7280');
    doc.setProperty('--color-text-muted', s?.color_text_muted || '#9ca3af');

    // Background colors
    const bgColor = s?.background_color || '#fafafa';
    const bgSecondary = s?.secondary_background_color || '#ffffff';
    doc.setProperty('--bg-color', bgColor);
    document.body.style.backgroundColor = bgColor;
    doc.setProperty('--bg-secondary', bgSecondary);
    doc.setProperty('--color-bg-muted', s?.color_bg_muted || '#f9fafb');
    doc.setProperty('--color-bg-dark', s?.color_bg_dark || '#111827');

    // Border colors
    doc.setProperty('--color-border-default', s?.color_border_default || '#e5e7eb');
    doc.setProperty('--color-border-light', s?.color_border_light || '#f3f4f6');

    // Status colors
    doc.setProperty('--color-success', s?.color_success || '#10b981');
    doc.setProperty('--color-success-light', s?.color_success_light || '#ecfdf5');
    doc.setProperty('--color-error', s?.color_error || '#ef4444');
    doc.setProperty('--color-error-light', s?.color_error_light || '#fef2f2');
    doc.setProperty('--color-warning', s?.color_warning || '#f59e0b');
    doc.setProperty('--color-warning-light', s?.color_warning_light || '#fffbeb');
    doc.setProperty('--color-info', s?.color_info || '#3b82f6');
    doc.setProperty('--color-info-light', s?.color_info_light || '#eff6ff');

    // Accent colors
    doc.setProperty('--color-sale', s?.color_sale || '#ef4444');
    doc.setProperty('--color-link', s?.color_link || '#10b981');

    // Font sizes
    const headingFontSize = s?.heading_font_size || 28;
    const bodyFontSize = s?.body_font_size || 16;
    doc.setProperty('--heading-font-size', `${headingFontSize}px`);
    doc.setProperty('--body-font-size', `${bodyFontSize}px`);

    // Component shapes
    doc.setProperty('--radius-button', `${s?.radius_button ?? 16}px`);
    doc.setProperty('--radius-card', `${s?.radius_card ?? 24}px`);
    doc.setProperty('--radius-input', `${s?.radius_input ?? 12}px`);

    // Cache all design tokens in localStorage for FOUC prevention
    try {
      localStorage.setItem('atluf_brand_colors', JSON.stringify({
        primary, primaryRgb: hexToRgb(primary),
        secondary, secondaryRgb: hexToRgb(secondary),
        brandLight: s?.color_brand_light || '#ecfdf5',
        textPrimary: s?.color_text_primary || '#111827',
        textSecondary: s?.color_text_secondary || '#6b7280',
        textMuted: s?.color_text_muted || '#9ca3af',
        headingFont: s?.heading_font || 'Plus Jakarta Sans',
        headingFontSize, bodyFont: s?.body_font || 'Inter', bodyFontSize,
        backgroundColor: bgColor, secondaryBackgroundColor: bgSecondary,
        bgMuted: s?.color_bg_muted || '#f9fafb',
        bgDark: s?.color_bg_dark || '#111827',
        borderDefault: s?.color_border_default || '#e5e7eb',
        borderLight: s?.color_border_light || '#f3f4f6',
        success: s?.color_success || '#10b981',
        successLight: s?.color_success_light || '#ecfdf5',
        error: s?.color_error || '#ef4444',
        errorLight: s?.color_error_light || '#fef2f2',
        warning: s?.color_warning || '#f59e0b',
        warningLight: s?.color_warning_light || '#fffbeb',
        info: s?.color_info || '#3b82f6',
        infoLight: s?.color_info_light || '#eff6ff',
        sale: s?.color_sale || '#ef4444',
        link: s?.color_link || '#10b981',
        radiusButton: s?.radius_button ?? 16,
        radiusCard: s?.radius_card ?? 24,
        radiusInput: s?.radius_input ?? 12,
      }));
    } catch {}
  }, [brandingSettings]);

  // Dynamically load Google Fonts and apply font CSS variables
  useEffect(() => {
    const headingFont = brandingSettings?.heading_font || 'Plus Jakarta Sans';
    const bodyFont = brandingSettings?.body_font || 'Inter';

    // Build Google Fonts URL for the selected fonts
    const fontsToLoad = new Set([headingFont, bodyFont]);
    // These fonts are already loaded in index.html; skip them
    const preloadedFonts = new Set(['Inter', 'Plus Jakarta Sans', 'DM Sans', 'Space Grotesk', 'Caveat', 'Patrick Hand']);

    const fontsNeedingLoad = [...fontsToLoad].filter(f => !preloadedFonts.has(f));

    if (fontsNeedingLoad.length > 0) {
      // Remove any previously injected dynamic font link
      const existingLink = document.getElementById('dynamic-google-fonts');
      if (existingLink) existingLink.remove();

      const families = fontsNeedingLoad.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800`).join('&');
      const link = document.createElement('link');
      link.id = 'dynamic-google-fonts';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      document.head.appendChild(link);
    }

    // Apply font CSS variables
    document.documentElement.style.setProperty('--font-heading', `'${headingFont}', sans-serif`);
    document.documentElement.style.setProperty('--font-body', `'${bodyFont}', sans-serif`);
    // Also apply directly so existing CSS rules pick them up
    document.body.style.fontFamily = `'${bodyFont}', sans-serif`;

    // Apply heading font to heading elements via a style tag
    let headingStyle = document.getElementById('dynamic-heading-font-style') as HTMLStyleElement | null;
    if (!headingStyle) {
      headingStyle = document.createElement('style');
      headingStyle.id = 'dynamic-heading-font-style';
      document.head.appendChild(headingStyle);
    }
    headingStyle.textContent = `h1, h2, h3, h4, .font-heading { font-family: '${headingFont}', sans-serif !important; }`;
  }, [brandingSettings?.heading_font, brandingSettings?.body_font]);

  // Reveal page once brand settings have loaded (prevents FOUC)
  useEffect(() => {
    if (!brandingLoading) {
      requestAnimationFrame(() => {
        document.documentElement.classList.add('app-ready');
        // Clear the failsafe timeout from index.html
        if ((window as any).__fouc_timeout) {
          clearTimeout((window as any).__fouc_timeout);
        }
      });
    }
  }, [brandingLoading]);

  const [trackingParams, setTrackingParams] = useState<{ trackingNumber?: string; carrierCode?: string }>(() => {
    // Parse tracking params from URL on load
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    let trackingNumber = urlParams.get('number') || undefined;
    let carrierCode = urlParams.get('carrier') || undefined;

    // Also support /tracking/:trackingNumber format
    if (pathname.startsWith('/tracking/') && pathname.length > 10) {
      trackingNumber = pathname.split('/')[2];
    }

    return { trackingNumber, carrierCode };
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      setView(getViewFromPath(pathname));
      // Update blog slug on popstate
      if (pathname.startsWith('/blog/') && pathname.length > 6) {
        setBlogSlug(safeDecodeURIComponent(pathname.split('/')[2]));
      } else {
        setBlogSlug(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAddToCart = useCallback((product: Product, quantity: number = 1) => {
    addToCart(product, quantity);
    setIsCartOpen(true);
  }, [addToCart]);

  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    updateQuantity(id, delta);
  }, [updateQuantity]);

  const handleRemoveFromCart = useCallback((id: string) => {
    removeFromCart(id);
  }, [removeFromCart]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedCategory('All');
    setView('shop');
    window.scrollTo(0, 0);
    // Update URL to reflect search
    window.history.pushState({ view: 'shop', search: query }, '', '/');
  }, []);

  const handleNavigate = useCallback((newView: ViewType, category: string = 'All', options?: { calendarFilter?: string }) => {
    // Scroll to top immediately before view change for reliable behavior
    window.scrollTo(0, 0);

    setView(newView);
    setSelectedCategory(category);
    setCategoryNavKey(prev => prev + 1);
    // Clear search when navigating away from shop, or when navigating to shop with a specific category
    if (newView !== 'shop' || category !== 'All') {
      setSearchQuery('');
    }

    // Set calendar filter if navigating to calendar with a filter
    if (newView === 'calendar' && options?.calendarFilter) {
      setCalendarFilter(options.calendarFilter);
    } else if (newView !== 'calendar') {
      // Reset filter when navigating away from calendar
      setCalendarFilter(undefined);
    }

    // Clear blog slug when navigating away from blog
    if (newView !== 'blog') {
      setBlogSlug(null);
    }

    // Update browser URL for admin views
    const newPath = getPathForView(newView);
    if (window.location.pathname !== newPath) {
      window.history.pushState({ view: newView }, '', newPath);
    }
  }, []);

  const handleProceedToCheckout = useCallback(() => {
    setIsCartOpen(false);
    setView('checkout');
    window.scrollTo(0, 0);
  }, []);

  const handleCompleteOrder = useCallback(() => {
    clearCart();
    setView('home');
    window.scrollTo(0, 0);
  }, [clearCart]);

  const handleOrderComplete = useCallback((orderData: OrderData) => {
    setCompletedOrder(orderData);
    clearCart();
    setView('order-confirmation');
    window.scrollTo(0, 0);
  }, [clearCart]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Router-like logic
  const renderContent = () => {
    switch (view) {
      case 'checkout':
        return (
          <CheckoutPage
            items={cart}
            onBack={() => {
              setView('shop');
              setIsCartOpen(true);
            }}
            onNavigate={(newView: string) => handleNavigate(newView as any)}
            onOrderComplete={handleOrderComplete}
            onUpdateCart={setCart}
          />
        );
      case 'order-confirmation':
        if (!completedOrder) {
          handleNavigate('home');
          return null;
        }
        return (
          <OrderConfirmationPage
            items={completedOrder.items}
            customerFirstName={completedOrder.customerFirstName}
            customerEmail={completedOrder.customerEmail}
            shippingAddress={completedOrder.shippingAddress}
            pickupInfo={completedOrder.pickupInfo}
            totals={completedOrder.totals}
            orderNumber={completedOrder.order_number}
            isGuest={completedOrder.isGuest}
            isPickup={completedOrder.isPickup}
            shippingMethodName={completedOrder.shippingMethodName}
            estimatedDeliveryDate={completedOrder.estimatedDeliveryDate}
            packageBreakdown={completedOrder.packageBreakdown}
            onContinueShopping={() => handleNavigate('shop')}
            onCreateAccount={() => handleNavigate('register')}
            onViewOrders={!completedOrder.isGuest ? () => handleNavigate('account') : undefined}
          />
        );
      case 'tracking':
        return (
          <TrackingPage
            initialTrackingNumber={trackingParams.trackingNumber}
            initialCarrierCode={trackingParams.carrierCode}
            onBack={() => handleNavigate('home')}
            onNavigate={(newView: string) => handleNavigate(newView as any)}
          />
        );
      case 'shop':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <ShopPage onAddToCart={handleAddToCart} initialCategory={selectedCategory} initialSearchQuery={searchQuery} onNavigate={handleNavigate} categoryNavKey={categoryNavKey} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'faq':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <FAQPage onBack={() => setView('home')} />
            <Footer onNavigate={handleNavigate} />
            <SageAssistant />
          </>
        );
      case 'about':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <AboutPage />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'schools':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <SchoolsPage onBack={() => setView('home')} onNavigate={(newView: string) => handleNavigate(newView as ViewType)} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'calendar':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <CalendarPage onBack={() => setView('home')} initialFilter={calendarFilter} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'tools':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <ToolsPage onBack={() => setView('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'blog':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            {blogSlug ? (
              <BlogPostPage
                slug={blogSlug}
                onBack={() => {
                  setBlogSlug(null);
                  window.history.pushState({ view: 'blog' }, '', '/blog');
                }}
              />
            ) : (
              <BlogPage
                onViewPost={(slug: string) => {
                  setBlogSlug(slug);
                  window.history.pushState({ view: 'blog', slug }, '', `/blog/${slug}`);
                  window.scrollTo(0, 0);
                }}
              />
            )}
            <Footer onNavigate={handleNavigate} />
            <SageAssistant />
          </>
        );
      case 'gift-cards':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <GiftCardsPage />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'privacy':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <ContentPage slug="privacy" onBack={() => handleNavigate('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'terms':
        return (
          <>
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            <ContentPage slug="terms" onBack={() => handleNavigate('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'newsletter-confirmed':
        return (
          <NewsletterStatusPage type="confirmed" onNavigate={(v) => handleNavigate(v as ViewType)} />
        );
      case 'newsletter-unsubscribed':
        return (
          <NewsletterStatusPage type="unsubscribed" onNavigate={(v) => handleNavigate(v as ViewType)} />
        );
      case 'login':
        return (
          <LoginPage
            onNavigate={handleNavigate}
            onSuccess={() => {
              // Check if user has seen welcome page before
              const hasSeenWelcome = localStorage.getItem('atluf_welcome_seen') === 'true';
              handleNavigate(hasSeenWelcome ? 'shop' : 'welcome');
            }}
          />
        );
      case 'register':
        return (
          <RegisterPage
            onNavigate={handleNavigate}
            onSuccess={() => {
              // Always show welcome page after new signup
              handleNavigate('welcome');
            }}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordPage
            onNavigate={handleNavigate}
          />
        );
      case 'account':
        return (
          <AccountPage onNavigate={handleNavigate} />
        );
      case 'welcome':
        return (
          <WelcomePage onNavigate={handleNavigate} />
        );
      case 'admin-login':
        return (
          <AdminLogin
            onNavigate={handleNavigate}
            onSuccess={() => handleNavigate('admin')}
          />
        );
      case 'admin':
        return <AdminLayout />;
      case 'home':
      default:
        return (
          <div className="min-h-screen bg-site selection:bg-emerald-100 selection:text-emerald-900">
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            
            <main>
              <Hero onShopClick={() => handleNavigate('shop')} onAboutClick={() => handleNavigate('about')} />
              
              <FeaturedSection onAddToCart={handleAddToCart} onNavigate={handleNavigate} />
              
              <CategorySection onCategoryClick={(cat) => handleNavigate('shop', cat)} />

              <MissionSection onNavigate={handleNavigate} />

              <CustomerReviews />

              <SproutifySection onNavigate={handleNavigate} />

              <SchoolsPromoSection onNavigate={handleNavigate} />
            </main>

            <Footer onNavigate={handleNavigate} />
            <SageAssistant />
            <LeadMagnetPopup />
          </div>
        );
    }
  };

  return (
    <SiteContentProvider>
      <AuthProvider>
        <OutageBanner />
        {renderContent()}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cart}
          onRemove={handleRemoveFromCart}
          onUpdateQuantity={handleUpdateQuantity}
          onCheckout={handleProceedToCheckout}
        />
      </AuthProvider>
    </SiteContentProvider>
  );
};

export default App;
