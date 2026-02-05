
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import CategorySection from './components/CategorySection';
import FeaturedSection from './components/FeaturedSection';
import ProductGrid from './components/ProductGrid';
import SageAssistant from './components/SageAssistant';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import CheckoutPage from './src/components/CheckoutPage';
import OrderConfirmationPage from './src/components/OrderConfirmationPage';
import TrackingPage from './src/components/TrackingPage';
import ShopPage from './components/ShopPage';
import PromotionalBanner from './components/PromotionalBanner';
import FAQPage from './components/FAQPage';
import AboutPage from './components/AboutPage';
import SchoolsPage from './components/SchoolsPage';
import ContentPage from './components/ContentPage';
import CalendarPage from './components/CalendarPage';
import LoginPage from './src/components/auth/LoginPage';
import RegisterPage from './src/components/auth/RegisterPage';
import ForgotPasswordPage from './src/components/auth/ForgotPasswordPage';
import { AccountPage } from './src/components/account';
import { WelcomePage } from './src/pages';
import { AuthProvider } from './src/context/AuthContext';
import { SiteContentProvider, usePageContent } from './src/hooks/useSiteContent';
import { AdminLayout } from './src/admin';
import AdminLogin from './src/admin/pages/AdminLogin';
import { useBrandingSettings } from './src/hooks/useSupabase';
import { Product, CartItem } from './types';

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
  }>;
  customerFirstName: string;
  customerEmail: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  isGuest: boolean;
}

type ViewType = 'home' | 'shop' | 'checkout' | 'order-confirmation' | 'tracking' | 'faq' | 'about' | 'schools' | 'calendar' | 'login' | 'register' | 'forgot-password' | 'account' | 'welcome' | 'admin' | 'admin-login' | 'privacy' | 'terms';

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
    default: return '/';
  }
};

const CART_STORAGE_KEY = 'atl-urban-farms-cart';

// Schools Promo Section Component - uses CMS content
interface SchoolsPromoSectionProps {
  onNavigate: (view: string) => void;
}

const SchoolsPromoSection: React.FC<SchoolsPromoSectionProps> = ({ onNavigate }) => {
  const { getSection } = usePageContent('home');
  const content = getSection('schools_promo');

  return (
    <section className="py-16 px-4 md:px-12 bg-white overflow-hidden relative border-b border-gray-200">
      <div className="absolute top-0 right-0 p-16 opacity-[0.04] pointer-events-none">
        <svg className="w-64 h-64 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
      </div>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <img src={content.image_url || 'https://picsum.photos/seed/school/800/600'} alt="School garden program" className="rounded-[3rem] shadow-2xl relative z-10" />
          <div className="absolute -bottom-8 -right-8 w-48 h-48 sage-gradient rounded-full blur-3xl opacity-30"></div>
        </div>
        <div>
          <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
            {content.label || 'Education First'}
          </span>
          <h2
            className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-tight"
            dangerouslySetInnerHTML={{ __html: content.headline || 'Empowering the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>' }}
          />
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            {content.description || "Our School Seedling Program provides discounted live plants and curriculum support to K-12 schools across Georgia. Let's grow together."}
          </p>
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    // Initialize cart from localStorage
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [view, setView] = useState<ViewType>(() => getViewFromPath(window.location.pathname));
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarFilter, setCalendarFilter] = useState<string | undefined>(undefined);
  const [completedOrder, setCompletedOrder] = useState<OrderData | null>(null);

  // Fetch branding settings and apply primary brand color
  const { settings: brandingSettings } = useBrandingSettings();

  // Apply brand colors as CSS custom properties
  useEffect(() => {
    if (brandingSettings?.primary_brand_color) {
      const color = brandingSettings.primary_brand_color;
      document.documentElement.style.setProperty('--brand-primary', color);
      document.documentElement.style.setProperty('--brand-primary-rgb', hexToRgb(color));
    }
    // Apply secondary brand color
    const secondaryColor = brandingSettings?.secondary_brand_color || '#047857';
    document.documentElement.style.setProperty('--brand-secondary', secondaryColor);
    document.documentElement.style.setProperty('--brand-secondary-rgb', hexToRgb(secondaryColor));
  }, [brandingSettings?.primary_brand_color, brandingSettings?.secondary_brand_color]);

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

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // localStorage might be full or disabled
    }
  }, [cart]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setView(getViewFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAddToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setIsCartOpen(true);
  }, []);

  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  }, []);

  const handleRemoveFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

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
    // Clear search when navigating to a new view (except when navigating to shop with search)
    if (newView !== 'shop') {
      setSearchQuery('');
    }

    // Set calendar filter if navigating to calendar with a filter
    if (newView === 'calendar' && options?.calendarFilter) {
      setCalendarFilter(options.calendarFilter);
    } else if (newView !== 'calendar') {
      // Reset filter when navigating away from calendar
      setCalendarFilter(undefined);
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
    setCart([]);
    setView('home');
    window.scrollTo(0, 0);
  }, []);

  const handleOrderComplete = useCallback((orderData: OrderData) => {
    setCompletedOrder(orderData);
    setCart([]);
    setView('order-confirmation');
    window.scrollTo(0, 0);
  }, []);

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
            totals={completedOrder.totals}
            orderNumber={completedOrder.order_number}
            isGuest={completedOrder.isGuest}
            onContinueShopping={() => handleNavigate('shop')}
            onCreateAccount={() => handleNavigate('register')}
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
            <ShopPage onAddToCart={handleAddToCart} initialCategory={selectedCategory} initialSearchQuery={searchQuery} onNavigate={handleNavigate} />
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
            <AboutPage onBack={() => setView('home')} />
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
              // Check if user has seen welcome page before
              const hasSeenWelcome = localStorage.getItem('atluf_welcome_seen') === 'true';
              handleNavigate(hasSeenWelcome ? 'shop' : 'welcome');
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
          <div className="min-h-screen bg-[#fafafa] selection:bg-emerald-100 selection:text-emerald-900">
            <PromotionalBanner />
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} currentView={view} onSearch={handleSearch} />
            
            <main>
              <Hero onShopClick={() => handleNavigate('shop')} onAboutClick={() => handleNavigate('about')} />
              
              <FeaturedSection onAddToCart={handleAddToCart} onNavigate={handleNavigate} />
              
              <CategorySection onCategoryClick={(cat) => handleNavigate('shop', cat)} />
              
              <section id="shop" className="scroll-mt-32">
                <ProductGrid onAddToCart={handleAddToCart} onAboutClick={() => handleNavigate('about')} onShopClick={() => handleNavigate('shop')} onNavigate={handleNavigate} />
              </section>

              <SchoolsPromoSection onNavigate={handleNavigate} />
            </main>

            <Footer onNavigate={handleNavigate} />
            <SageAssistant />
          </div>
        );
    }
  };

  return (
    <SiteContentProvider>
      <AuthProvider>
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
