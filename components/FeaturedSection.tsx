
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';
import { useProductsPromotions, calculateSalePrice } from '../src/hooks/usePromotions';
import { useAuth } from '../src/hooks/useAuth';
import { usePageContent } from '../src/hooks/useSiteContent';
import { Product } from '../types';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

interface FeaturedSectionProps {
  onAddToCart: (product: Product, quantity: number) => void;
  onNavigate?: (view: string) => void;
}

// Map Supabase product to local Product type
const mapProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  price: p.price,
  compareAtPrice: p.compare_at_price ?? null,
  image: p.primary_image?.url || p.images?.[0]?.url || 'https://placehold.co/400x400?text=No+Image',
  category: p.category?.name || 'Uncategorized',
  stock: p.quantity_available || 0
});

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ onAddToCart, onNavigate }) => {
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { user } = useAuth();
  const { get } = usePageContent('home');

  // Get content from CMS
  const sectionLabel = get('featured', 'label', 'Weekly Spotlight');
  const headline = get('featured', 'headline', 'Nursery <span class="sage-text-gradient">Favorites</span>');
  const description = get('featured', 'description', 'Hand-picked by our lead growers for their exceptional vitality and flavor profiles.');


  // Fetch featured products with realtime subscription
  useEffect(() => {
    async function fetchFeaturedProducts() {
      try {
        setLoading(true);
        setError(null);

        // Query products with featured = true
        const { data, error: supabaseError } = await supabase
          .from('products')
          .select(`
            *,
            category:product_categories(*),
            images:product_images(*)
          `)
          .eq('is_active', true)
          .eq('featured', true)
          .order('updated_at', { ascending: false })
          .limit(4);

        if (supabaseError) throw supabaseError;

        // Extract primary image for each product
        const productsWithPrimaryImage = (data || []).map(product => ({
          ...product,
          primary_image: product.images?.find((img: any) => img.is_primary) || product.images?.[0] || null
        }));

        setRawProducts(productsWithPrimaryImage);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedProducts();

    // Subscribe to realtime changes on products table
    const channel = supabase
      .channel('featured-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          // Refetch when any product changes (status, featured flag, etc.)
          fetchFeaturedProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Map raw products to display format
  const featuredRawProducts = rawProducts;
  const featuredProducts = featuredRawProducts.map(mapProduct);

  // Fetch promotions for featured products
  const productIds = useMemo(() => featuredRawProducts.map(p => p.id), [featuredRawProducts]);
  const { promotions: productPromotions } = useProductsPromotions(productIds);

  if (loading) {
    return (
      <section className="py-12 px-4 md:px-12 bg-gray-50 border-b border-gray-200 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <div className="h-4 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
            <div className="h-12 w-80 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
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
    <section className="py-16 px-4 md:px-12 bg-gray-50 border-b border-gray-200 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <span className="brand-text font-black uppercase tracking-[0.2em] text-[10px] mb-3 block">{sectionLabel}</span>
            <h2
              className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 tracking-tight leading-tight"
              dangerouslySetInnerHTML={{ __html: headline }}
            />
            <p className="text-gray-500 mt-4 text-lg font-medium"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {featuredProducts.map((product, idx) => {
            const promo = productPromotions.get(product.id);
            const promoSalePrice = promo
              ? calculateSalePrice(product.price, promo.discount_type, promo.discount_value)
              : null;

            // If there's a promotion, use promo price; otherwise use product price
            // compareAtPrice is either the original price (for promo) or compare_at_price from DB
            const displayPrice = promoSalePrice ?? product.price;
            const displayCompareAtPrice = promoSalePrice
              ? product.price  // Promotion: original price is the compare price
              : product.compareAtPrice;  // No promo: use compare_at_price from DB

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
                  price={displayPrice}
                  category={product.category}
                  inStock={product.stock > 0}
                  onAddToCart={(qty) => onAddToCart(product, qty)}
                  onClick={() => setSelectedProduct(featuredRawProducts[idx])}
                  compareAtPrice={displayCompareAtPrice}
                  saleBadge={promo?.badge_text}
                  requireLoginToFavorite={true}
                  onRequireLogin={() => onNavigate?.('login')}
                />
              </motion.div>
            );
          })}
        </div>

        {/* View All Link */}
        <div className="mt-8 text-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate?.('shop')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-600"
          >
            View All Products
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </motion.button>
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
