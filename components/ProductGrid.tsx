
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProducts } from '../src/hooks/useSupabase';
import { Product } from '../types';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

interface ProductGridProps {
  onAddToCart: (product: Product, quantity: number) => void;
  onAboutClick?: () => void;
}

const ProductCardSkeleton = () => (
  <div className="bg-white rounded-[2.5rem] p-5 border border-gray-100 flex flex-col h-full animate-pulse">
    <div className="aspect-square rounded-[2rem] bg-gray-100 mb-6" />
    <div className="px-1 space-y-4">
      <div className="flex justify-between items-start">
        <div className="h-6 w-32 bg-gray-100 rounded-lg" />
        <div className="h-6 w-12 bg-gray-100 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-gray-50 rounded" />
        <div className="h-4 w-2/3 bg-gray-50 rounded" />
      </div>
      <div className="h-12 w-full bg-gray-100 rounded-2xl mt-4" />
    </div>
  </div>
);

// Map Supabase product to local Product type
const mapProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  price: p.price,
  image: p.primary_image?.url || p.images?.[0]?.url || 'https://placehold.co/400x400?text=No+Image',
  category: p.category?.name || 'Uncategorized',
  stock: p.quantity_available || 0
});

const ProductGrid: React.FC<ProductGridProps> = ({ onAddToCart, onAboutClick }) => {
  const { products: rawProducts, loading, error } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Map Supabase data to local Product type
  const products = rawProducts.map(mapProduct);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <section className="py-32 px-4 md:px-12 bg-gray-50/50">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-16 px-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-3 block">Curated Collection</span>
            <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 tracking-tight">
              Best <span className="text-emerald-600">Sellers</span>
            </h2>
          </motion.div>
          
          <motion.a 
            href="#shop"
            whileHover={{ x: 5 }}
            className="group flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-600 transition-colors"
          >
            View All Collection
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </motion.a>
        </div>

        {/* Grid Display */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <AnimatePresence>
            {loading ? (
              // Skeleton Loading State
              Array.from({ length: 8 }).map((_, idx) => (
                <motion.div
                  key={`skeleton-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ProductCardSkeleton />
                </motion.div>
              ))
            ) : error ? (
              // Error State
              <div className="col-span-full text-center py-12">
                <p className="text-red-500">Failed to load products: {error}</p>
              </div>
            ) : (
              // Actual Product Cards
              products.map((product, index) => (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  layout
                >
                  <ProductCard
                    id={product.id}
                    image={product.image}
                    name={product.name}
                    price={product.price}
                    category={product.category}
                    inStock={product.stock > 0}
                    onAddToCart={(qty) => onAddToCart(product, qty)}
                    onClick={() => setSelectedProduct(rawProducts[index])}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Educational/Trust Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 p-12 bg-white rounded-[3rem] border border-emerald-50 shadow-2xl shadow-emerald-100/20 flex flex-col lg:flex-row items-center justify-between gap-10 text-center lg:text-left overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />
          
          <div className="max-w-2xl">
            <h3 className="text-3xl font-heading font-extrabold text-gray-900 mb-4">The ATL Urban Nursery Standard</h3>
            <p className="text-gray-500 font-medium leading-relaxed">
              Every seedling is grown in a climate-controlled, pest-free environment. We use proprietary nutrient mapping to ensure your plants are at peak vitality when they ship.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onAboutClick}
              className="px-10 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-bold hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-100 whitespace-nowrap"
            >
              Learn Our Tech
            </button>
            <button className="px-10 py-5 bg-white text-gray-900 border-2 border-gray-100 rounded-[1.5rem] font-bold hover:border-emerald-600 transition-all whitespace-nowrap">
              Shipping Calendar
            </button>
          </div>
        </motion.div>
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(qty) => {
          if (selectedProduct) {
            const mappedProduct = mapProduct(selectedProduct);
            onAddToCart(mappedProduct, qty);
          }
        }}
      />
    </section>
  );
};

export default ProductGrid;
