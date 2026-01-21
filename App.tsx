
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
import ShopPage from './components/ShopPage';
import FAQPage from './components/FAQPage';
import AboutPage from './components/AboutPage';
import GrowersPage from './components/GrowersPage';
import LoginPage from './src/components/auth/LoginPage';
import RegisterPage from './src/components/auth/RegisterPage';
import ForgotPasswordPage from './src/components/auth/ForgotPasswordPage';
import { AccountPage } from './src/components/account';
import { WelcomePage } from './src/pages';
import { AuthProvider } from './src/context/AuthContext';
import { AdminLayout } from './src/admin';
import AdminLogin from './src/admin/pages/AdminLogin';
import { Product, CartItem } from './types';

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

type ViewType = 'home' | 'shop' | 'checkout' | 'order-confirmation' | 'faq' | 'about' | 'growers' | 'login' | 'register' | 'forgot-password' | 'account' | 'welcome' | 'admin' | 'admin-login';

// Get initial view based on URL path
const getViewFromPath = (pathname: string): ViewType => {
  if (pathname === '/admin/login') return 'admin-login';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/welcome') return 'welcome';
  return 'home';
};

// Get URL path for a given view
const getPathForView = (view: ViewType): string => {
  switch (view) {
    case 'admin-login': return '/admin/login';
    case 'admin': return '/admin';
    case 'welcome': return '/welcome';
    default: return '/';
  }
};

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [view, setView] = useState<ViewType>(() => getViewFromPath(window.location.pathname));
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [completedOrder, setCompletedOrder] = useState<OrderData | null>(null);

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

  const handleNavigate = useCallback((newView: ViewType, category: string = 'All') => {
    setView(newView);
    setSelectedCategory(category);

    // Update browser URL for admin views
    const newPath = getPathForView(newView);
    if (window.location.pathname !== newPath) {
      window.history.pushState({ view: newView }, '', newPath);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      case 'shop':
        return (
          <>
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} />
            <ShopPage onAddToCart={handleAddToCart} initialCategory={selectedCategory} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'faq':
        return (
          <>
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} />
            <FAQPage onBack={() => setView('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'about':
        return (
          <>
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} />
            <AboutPage onBack={() => setView('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'growers':
        return (
          <>
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} />
            <GrowersPage onBack={() => setView('home')} />
            <Footer onNavigate={handleNavigate} />
          </>
        );
      case 'login':
        return (
          <LoginPage
            onNavigate={handleNavigate}
            onSuccess={() => handleNavigate('account')}
          />
        );
      case 'register':
        return (
          <RegisterPage
            onNavigate={handleNavigate}
            onSuccess={() => handleNavigate('welcome')}
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
            <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onNavigate={handleNavigate} />
            
            <main>
              <Hero onShopClick={() => handleNavigate('shop')} onAboutClick={() => handleNavigate('about')} />
              
              <FeaturedSection onAddToCart={handleAddToCart} />
              
              <CategorySection onCategoryClick={(cat) => handleNavigate('shop', cat)} />
              
              <section id="shop" className="scroll-mt-32">
                <ProductGrid onAddToCart={handleAddToCart} onAboutClick={() => handleNavigate('about')} />
              </section>

              <section className="py-24 px-4 md:px-12 bg-white overflow-hidden relative border-t border-gray-50">
                <div className="absolute top-0 right-0 p-32 opacity-10 pointer-events-none">
                  <svg className="w-96 h-96 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </div>
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                  <div className="relative">
                    <img src="https://picsum.photos/seed/school/800/600" alt="School garden program" className="rounded-[3rem] shadow-2xl relative z-10" />
                    <div className="absolute -bottom-8 -right-8 w-48 h-48 sage-gradient rounded-full blur-3xl opacity-30"></div>
                  </div>
                  <div>
                    <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">Education First</span>
                    <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-tight">
                      Empowering the Next Generation of <span className="text-emerald-600">Urban Farmers.</span>
                    </h2>
                    <p className="text-lg text-gray-500 mb-10 leading-relaxed">
                      Our School Seedling Program provides discounted live plants and curriculum support to K-12 schools across Georgia. Let's grow together.
                    </p>
                    <button className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-3">
                      Partner with Schools
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </button>
                  </div>
                </div>
              </section>
            </main>

            <Footer onNavigate={handleNavigate} />
            <SageAssistant />
          </div>
        );
    }
  };

  return (
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
  );
};

export default App;
