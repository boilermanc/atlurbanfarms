
import React from 'react';
import { motion } from 'framer-motion';
import { PRODUCTS } from '../constants';
import { Product } from '../types';
import ProductCard from './ProductCard';

interface FeaturedSectionProps {
  onAddToCart: (product: Product, quantity: number) => void;
}

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ onAddToCart }) => {
  // Curated list: Tomato (1), Basil (2), French Lavender (4)
  const featuredIds = ['1', '2', '4'];
  const featuredProducts = PRODUCTS.filter(p => featuredIds.includes(p.id));

  return (
    <section className="py-24 px-4 md:px-12 bg-white relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <span className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-3 block">Weekly Spotlight</span>
            <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 tracking-tight leading-tight">
              Nursery <span className="sage-text-gradient">Favorites</span>
            </h2>
            <p className="text-gray-500 mt-4 text-lg font-medium">
              Hand-picked by our lead growers for their exceptional vitality and flavor profiles.
            </p>
          </motion.div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center gap-2"
          >
            Meet Our Growers
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <ProductCard 
                id={product.id}
                image={product.image}
                name={product.name}
                price={product.price}
                category={product.category}
                inStock={product.stock > 0}
                onAddToCart={(qty) => onAddToCart(product, qty)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedSection;
