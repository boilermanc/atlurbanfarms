
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHIPPING_NOTICE, SparkleIcon } from '../constants';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onNavigate: (view: 'home' | 'shop' | 'faq' | 'about', category?: string) => void;
}

const Header: React.FC<HeaderProps> = ({ cartCount, onOpenCart, onNavigate }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const SHOP_ITEMS = [
    { name: 'All Products', category: 'All' },
    { name: 'Herbs', category: 'Herbs' },
    { name: 'Vegetables', category: 'Vegetables' },
    { name: 'Flowers', category: 'Flowers' },
    { name: 'Tower Planner', category: 'All', featured: true },
  ];

  const logo = (
    <div onClick={handleLogoClick} className="flex items-center gap-2 group cursor-pointer">
      <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-200 group-hover:rotate-6 transition-transform">
        A
      </div>
      <span className="font-heading text-lg font-extrabold tracking-tight text-gray-900">
        ATL <span className="text-emerald-600">Urban Farms</span>
      </span>
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-emerald-600 text-white text-[10px] md:text-xs py-2 px-4 text-center font-bold uppercase tracking-widest">
        {SHIPPING_NOTICE}
      </div>

      <nav className={`transition-all duration-300 ${isScrolled ? 'glass py-3 shadow-lg shadow-emerald-900/5' : 'bg-white/80 backdrop-blur-sm py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-12 flex items-center justify-between">
          
          <div className="md:hidden flex-1">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
            </button>
          </div>

          <div className="hidden md:block">{logo}</div>
          <div className="md:hidden flex-1 flex justify-center">{logo}</div>

          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            <div 
              className="relative py-2"
              onMouseEnter={() => setIsShopDropdownOpen(true)}
              onMouseLeave={() => setIsShopDropdownOpen(false)}
            >
              <button 
                onClick={() => onNavigate('shop')}
                className="flex items-center gap-1.5 text-sm font-bold text-gray-700 hover:text-emerald-600 transition-colors"
              >
                Shop
                <svg className={`w-4 h-4 transition-transform duration-300 ${isShopDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <AnimatePresence>
                {isShopDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden mt-1 py-3"
                  >
                    {SHOP_ITEMS.map((item) => (
                      <button 
                        key={item.name}
                        onClick={() => {
                          onNavigate('shop', item.category);
                          setIsShopDropdownOpen(false);
                        }}
                        className={`w-full text-left block px-5 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between ${
                          item.featured 
                          ? 'sage-text-gradient bg-purple-50/50' 
                          : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        {item.name}
                        {item.featured && <SparkleIcon className="w-4 h-4 text-purple-500" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <button 
              onClick={() => onNavigate('faq')}
              className="text-sm font-bold text-gray-700 hover:text-emerald-600 transition-colors py-2"
            >
              FAQ
            </button>
            <button 
              onClick={() => onNavigate('about')}
              className="text-sm font-bold text-gray-700 hover:text-emerald-600 transition-colors py-2"
            >
              About
            </button>
          </div>

          <div className="flex-1 md:flex-none flex items-center justify-end gap-1 md:gap-4">
            <button 
              onClick={onOpenCart}
              className="relative p-2 text-gray-700 hover:text-emerald-600 transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span 
                    key={cartCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1.3, 1], opacity: 1 }}
                    className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-white z-[110] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div onClick={() => setIsMobileMenuOpen(false)}>{logo}</div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-gray-50 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-8 px-6 space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Shop Seedlings</h3>
                  <div className="space-y-4">
                    {SHOP_ITEMS.map((item) => (
                      <button 
                        key={item.name} 
                        onClick={() => {
                          onNavigate('shop', item.category);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full text-left flex items-center justify-between font-bold text-lg ${item.featured ? 'sage-text-gradient' : 'text-gray-800'}`}
                      >
                        {item.name}
                        {item.featured && <SparkleIcon className="w-5 h-5 text-purple-500" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-8 border-t border-gray-50 space-y-4">
                  <button 
                    onClick={() => {
                      onNavigate('faq');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left font-bold text-lg text-gray-800"
                  >
                    FAQ
                  </button>
                  <button 
                    onClick={() => {
                      onNavigate('about');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left font-bold text-lg text-gray-800"
                  >
                    About
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
