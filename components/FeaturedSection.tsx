
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProducts } from '../src/hooks/useSupabase';
import { useProductsPromotions, calculateSalePrice } from '../src/hooks/usePromotions';
import { Product } from '../types';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

interface FeaturedSectionProps {
  onAddToCart: (product: Product, quantity: number) => void;
}

// Map Supabase product to local Product type
const mapProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  price: p.price,
  salePrice: p.compare_at_price ?? null,
  image: p.primary_image?.url || p.images?.[0]?.url || 'https://placehold.co/400x400?text=No+Image',
  category: p.category?.name || 'Uncategorized',
  stock: p.quantity_available || 0
});

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ onAddToCart }) => {
  const { products: rawProducts, loading, error } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Get first 3 products as featured (raw for modal, mapped for display)
  const featuredRawProducts = rawProducts.slice(0, 3);
  const featuredProducts = featuredRawProducts.map(mapProduct);

  // Fetch promotions for featured products
  const productIds = useMemo(() => featuredRawProducts.map(p => p.id), [featuredRawProducts]);
  const { promotions: productPromotions } = useProductsPromotions(productIds);

  if (loading) {
    return (
      <section className="py-24 px-4 md:px-12 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="h-4 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
            <div className="h-12 w-80 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[2.5rem] p-5 border border-gray-100 animate-pulse">
                <div className="aspect-square rounded-[2rem] bg-gray-100 mb-6" />
                <div className="px-1 space-y-4">
                  <div className="h-6 w-32 bg-gray-100 rounded-lg" />
                  <div className="h-4 w-full bg-gray-50 rounded" />
                  <div className="h-12 w-full bg-gray-100 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || featuredProducts.length === 0) {
    return null; // Don't show section if there's an error or no products
  }

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
          {featuredProducts.map((product, idx) => {
            const promo = productPromotions.get(product.id);
            const salePrice = promo
              ? calculateSalePrice(product.price, promo.discount_type, promo.discount_value)
              : null;

            return (
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
                  onClick={() => setSelectedProduct(featuredRawProducts[idx])}
                  salePrice={salePrice}
                  saleBadge={promo?.badge_text}
                />
              </motion.div>
            );
          })}
        </div>
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

export default FeaturedSection;
