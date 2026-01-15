
import React from 'react';
import { motion } from 'framer-motion';
import { SparkleIcon } from '../constants';

interface FooterProps {
  onNavigate?: (view: 'home' | 'shop' | 'faq' | 'about' | 'growers', category?: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (e: React.MouseEvent, view: 'home' | 'shop' | 'faq' | 'about' | 'growers', category?: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(view, category);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const shopLinks = [
    { label: 'All Products', cat: 'All' },
    { label: 'Herbs', cat: 'Herbs' },
    { label: 'Vegetables', cat: 'Vegetables' },
    { label: 'Flowers', cat: 'Flowers' },
  ];

  return (
    <footer className="bg-gray-950 text-white pt-24 pb-12 px-4 md:px-12 overflow-hidden relative border-t border-white/5">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] -z-0 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Section: Brand & Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-20">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={(e) => handleNav(e, 'home')} className="flex items-center gap-3 group text-left">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-900/20 group-hover:rotate-6 transition-transform">
                  A
                </div>
                <span className="font-heading text-2xl font-black tracking-tight">
                  ATL <span className="text-emerald-500">Urban Farms</span>
                </span>
              </button>
            </div>
            <p className="text-gray-400 text-lg leading-relaxed max-w-md mb-10">
              Transforming urban spaces with premium, nursery-grown seedlings. High-tech growing for the modern gardener.
            </p>
            <div className="flex gap-4">
              {['instagram', 'facebook', 'tiktok'].map((platform) => (
                <motion.a
                  key={platform}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label={platform}
                >
                  {platform === 'instagram' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  )}
                  {platform === 'facebook' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  )}
                  {platform === 'tiktok' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                  )}
                </motion.a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white/5 rounded-[3rem] p-8 md:p-12 border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <SparkleIcon className="w-24 h-24 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-heading font-extrabold mb-4">Join the Garden</h3>
              <p className="text-gray-400 mb-8 max-w-sm">Get growing tips, nursery updates, and early access to rare seasonal seedlings.</p>
              
              <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <button className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-900/20 whitespace-nowrap">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Link Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 border-b border-white/10 pb-16">
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 text-emerald-500 uppercase tracking-widest text-xs">Shop</h4>
            <ul className="space-y-4">
              {shopLinks.map(item => (
                <li key={item.label}>
                  <button 
                    onClick={(e) => handleNav(e, 'shop', item.cat)} 
                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 text-emerald-500 uppercase tracking-widest text-xs">Company</h4>
            <ul className="space-y-4">
              <li><button onClick={(e) => handleNav(e, 'about')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">About Us</button></li>
              <li><button onClick={(e) => handleNav(e, 'growers')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Meet the Growers</button></li>
              <li><button onClick={(e) => handleNav(e, 'about')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Our Story</button></li>
              <li><button onClick={(e) => handleNav(e, 'about')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Sustainability</button></li>
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Careers</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 text-emerald-500 uppercase tracking-widest text-xs">Support</h4>
            <ul className="space-y-4">
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">FAQ</button></li>
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Contact</button></li>
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Shipping Policy</button></li>
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Returns</button></li>
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Wholesale</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 text-emerald-500 uppercase tracking-widest text-xs">Contact</h4>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Visit Our Nursery</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  123 High-Tech Way<br />
                  Atlanta, GA 30318
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Grow Support</p>
                <button 
                  onClick={(e) => handleNav(e, 'faq')}
                  className="text-gray-400 hover:text-white text-sm transition-colors text-left"
                >
                  hello@atlurbanfarms.com
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">
              © 2025 ATL URBAN FARMS. ALL RIGHTS RESERVED.
            </p>
            <div className="flex gap-6">
              <button onClick={(e) => handleNav(e, 'faq')} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Terms of Service</button>
              <button onClick={(e) => handleNav(e, 'faq')} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Privacy Policy</button>
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600/60">
            Built by Sweetwater Technologies
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
