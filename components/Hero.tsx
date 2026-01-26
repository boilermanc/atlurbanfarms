
import React from 'react';
import { motion } from 'framer-motion';

interface HeroProps {
  onShopClick: () => void;
  onAboutClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onShopClick, onAboutClick }) => {
  return (
    <section className="relative pt-40 pb-20 md:pt-56 md:pb-32 px-4 md:px-12 overflow-hidden bg-white">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-emerald-100/50 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 text-center md:text-left">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase mb-6 brand-bg-light brand-text">
            <span className="w-2 h-2 rounded-full animate-pulse brand-bg" />
            Direct from our Atlanta Nursery
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-5xl md:text-7xl font-heading font-extrabold text-gray-900 leading-[1.1] mb-8">
            High-Tech Growing for <span className="brand-text">Urban Spaces.</span>
          </motion.h1>
          
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-xl text-gray-500 max-w-xl mb-10 leading-relaxed">
            Premium live plant seedlings delivered to your doorstep. Optimized for home gardeners, schools, and vertical farmers.
          </motion.p>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
            <button
              onClick={onShopClick}
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-200 text-center btn-brand-hover"
            >
              Shop Seedlings
            </button>
            <button
              onClick={onAboutClick}
              className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
            >
              Learn Our Process
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" x2="15" y1="12" y2="12"/><polyline points="12 19 19 12 12 5"/></svg>
            </button>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -5 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="flex-1 relative">
          <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-emerald-200 border-8 border-white">
            <img src="https://picsum.photos/seed/urbanfarm/800/1000" alt="Healthy seedlings" className="w-full h-auto object-cover" />
          </div>
          <div className="absolute -bottom-6 -left-6 glass p-6 rounded-3xl shadow-xl border border-white z-20 flex items-center gap-4 max-w-[240px]">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center brand-bg-light brand-text">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Guaranteed</p>
              <p className="font-heading font-bold text-gray-900">Arrives Alive</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
