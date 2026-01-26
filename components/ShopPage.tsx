
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProducts, useCategories } from '../src/hooks/useSupabase';
import { Product } from '../types';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

interface ShopPageProps {
  onAddToCart: (product: Product, quantity: number) => void;
  initialCategory?: string;
}

// Special category names that are NOT seedlings
const NON_SEEDLING_CATEGORIES = ['Merchandise', 'Supplies'];

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

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  rawProducts: any[];
  onAddToCart: (product: Product, quantity: number) => void;
  onProductClick: (product: any) => void;
  showViewAll?: boolean;
  defaultExpanded?: boolean;
  accentColor?: string;
}

const ProductSection: React.FC<ProductSectionProps> = ({
  title,
  subtitle,
  products,
  rawProducts,
  onAddToCart,
  onProductClick,
  showViewAll = false,
  defaultExpanded = false,
  accentColor = 'emerald'
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const displayProducts = expanded ? products : products.slice(0, 8);
  const hasMore = products.length > 8;

  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-16"
    >
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-black text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {hasMore && showViewAll && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-${accentColor}-600 font-bold hover:underline text-sm`}
          >
            {expanded ? 'Show Less' : `View All (${products.length})`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {displayProducts.map((product) => {
            const rawProduct = rawProducts.find((p: any) => p.id === product.id);
            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard
                  id={product.id}
                  image={product.image}
                  name={product.name}
                  price={product.price}
                  category={product.category}
                  inStock={product.stock > 0}
                  onAddToCart={(qty) => onAddToCart(product, qty)}
                  onClick={() => onProductClick(rawProduct)}
                  compareAtPrice={product.salePrice ?? null}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {hasMore && !showViewAll && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border bg-${accentColor}-50 text-${accentColor}-600 border-${accentColor}-200 hover:bg-${accentColor}-100`}
          >
            {expanded ? 'Show Less' : `View All ${products.length} Items`}
          </button>
        </div>
      )}
    </motion.div>
  );
};

interface CategorySubsectionProps {
  categoryName: string;
  products: Product[];
  rawProducts: any[];
  onAddToCart: (product: Product, quantity: number) => void;
  onProductClick: (product: any) => void;
}

const CategorySubsection: React.FC<CategorySubsectionProps> = ({
  categoryName,
  products,
  rawProducts,
  onAddToCart,
  onProductClick
}) => {
  const [expanded, setExpanded] = useState(false);
  const displayProducts = expanded ? products : products.slice(0, 4);
  const hasMore = products.length > 4;

  if (products.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          {categoryName}
          <span className="text-gray-400 font-normal text-sm">({products.length})</span>
        </h3>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-emerald-600 font-medium hover:underline text-sm"
          >
            {expanded ? 'Show Less' : 'View All'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {displayProducts.map((product) => {
            const rawProduct = rawProducts.find((p: any) => p.id === product.id);
            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard
                  id={product.id}
                  image={product.image}
                  name={product.name}
                  price={product.price}
                  category={product.category}
                  inStock={product.stock > 0}
                  onAddToCart={(qty) => onAddToCart(product, qty)}
                  onClick={() => onProductClick(rawProduct)}
                  compareAtPrice={product.salePrice ?? null}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ShopPage: React.FC<ShopPageProps> = ({ onAddToCart, initialCategory = 'All' }) => {
  const { products: rawProducts, loading: productsLoading, error: productsError } = useProducts();
  const { categories: rawCategories, loading: categoriesLoading } = useCategories();

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'all' | 'seedlings' | 'merchandise' | 'supplies'>('all');

  // Scroll to top when page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Sync selectedCategory when initialCategory prop changes (e.g., from header navigation)
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  // Map Supabase data to local types
  const products = rawProducts.map(mapProduct);

  // Separate categories into seedlings vs non-seedlings
  const { seedlingCategories, merchandiseCategory, suppliesCategory } = useMemo(() => {
    const seedling: any[] = [];
    let merchandise: any = null;
    let supplies: any = null;

    rawCategories.forEach((cat: any) => {
      const catNameLower = cat.name.toLowerCase();
      if (catNameLower === 'merchandise') {
        merchandise = cat;
      } else if (catNameLower === 'supplies') {
        supplies = cat;
      } else {
        seedling.push(cat);
      }
    });

    return {
      seedlingCategories: seedling,
      merchandiseCategory: merchandise,
      suppliesCategory: supplies
    };
  }, [rawCategories]);

  // Build category filter options
  const categoryOptions = useMemo(() => {
    const options = ['All'];

    // Add seedling categories
    seedlingCategories.forEach((cat: any) => {
      options.push(cat.name);
    });

    // Add divider categories
    if (merchandiseCategory) options.push(merchandiseCategory.name);
    if (suppliesCategory) options.push(suppliesCategory.name);

    return options;
  }, [seedlingCategories, merchandiseCategory, suppliesCategory]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Group products by section
  const { seedlingProducts, merchandiseProducts, suppliesProducts } = useMemo(() => {
    const seedlings: Product[] = [];
    const merchandise: Product[] = [];
    const supplies: Product[] = [];

    filteredProducts.forEach(product => {
      const catNameLower = product.category.toLowerCase();
      if (catNameLower === 'merchandise') {
        merchandise.push(product);
      } else if (catNameLower === 'supplies') {
        supplies.push(product);
      } else {
        seedlings.push(product);
      }
    });

    return {
      seedlingProducts: seedlings,
      merchandiseProducts: merchandise,
      suppliesProducts: supplies
    };
  }, [filteredProducts]);

  // Group seedling products by category
  const seedlingsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    seedlingProducts.forEach(product => {
      if (!grouped[product.category]) {
        grouped[product.category] = [];
      }
      grouped[product.category].push(product);
    });

    // Sort by category order from seedlingCategories
    const orderedCategories = seedlingCategories.map((c: any) => c.name);
    const sortedGrouped: Record<string, Product[]> = {};

    orderedCategories.forEach((catName: string) => {
      if (grouped[catName]) {
        sortedGrouped[catName] = grouped[catName];
      }
    });

    // Add any remaining categories not in seedlingCategories
    Object.keys(grouped).forEach(catName => {
      if (!sortedGrouped[catName]) {
        sortedGrouped[catName] = grouped[catName];
      }
    });

    return sortedGrouped;
  }, [seedlingProducts, seedlingCategories]);

  const loading = productsLoading || categoriesLoading;
  const error = productsError;

  // Determine if we should show sectioned view (when viewing "All" or searching)
  const showSectionedView = selectedCategory === 'All';

  return (
    <div className="min-h-screen pt-40 pb-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {/* Shop Header */}
        <div className="mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-heading font-black text-gray-900 mb-4"
          >
            The <span className="text-emerald-600">Nursery</span> Shop
          </motion.h1>
          <p className="text-gray-500 text-lg max-w-2xl">
            Browse our current inventory of premium, climate-controlled seedlings,
            quality merchandise, and growing supplies.
          </p>
        </div>

        {/* Section Tabs (for All view) */}
        {showSectionedView && !searchQuery && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveSection('all')}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeSection === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Products
            </button>
            <button
              onClick={() => setActiveSection('seedlings')}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeSection === 'seedlings'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Seedlings ({seedlingProducts.length})
            </button>
            {merchandiseProducts.length > 0 && (
              <button
                onClick={() => setActiveSection('merchandise')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeSection === 'merchandise'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Merchandise ({merchandiseProducts.length})
              </button>
            )}
            {suppliesProducts.length > 0 && (
              <button
                onClick={() => setActiveSection('supplies')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeSection === 'supplies'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Supplies ({suppliesProducts.length})
              </button>
            )}
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide">
            {categoryOptions.map((cat, index) => {
              // Add visual separator before Merchandise/Supplies
              const isNonSeedling = NON_SEEDLING_CATEGORIES.includes(cat);
              const prevCat = index > 0 ? categoryOptions[index - 1] : null;
              const showSeparator = isNonSeedling && prevCat && !NON_SEEDLING_CATEGORIES.includes(prevCat);

              return (
                <React.Fragment key={cat}>
                  {showSeparator && (
                    <div className="w-px h-6 bg-gray-200 mx-2" />
                  )}
                  <button
                    onClick={() => {
                      setSelectedCategory(cat);
                      if (cat !== 'All') {
                        setActiveSection('all'); // Reset section view when selecting specific category
                      }
                    }}
                    className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border ${
                      selectedCategory === cat
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100'
                      : isNonSeedling
                        ? 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-emerald-200'
                    }`}
                  >
                    {cat}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="relative w-full md:w-80 group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
        </div>

        {/* Product Display */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-[2.5rem] p-5 border border-gray-100 animate-pulse">
                <div className="aspect-square rounded-[2rem] bg-gray-100 mb-6" />
                <div className="px-1 space-y-4">
                  <div className="h-6 w-32 bg-gray-100 rounded-lg" />
                  <div className="h-4 w-full bg-gray-50 rounded" />
                  <div className="h-12 w-full bg-gray-100 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">Failed to load products</h3>
            <p className="text-red-500">{error}</p>
          </div>
        ) : showSectionedView && !searchQuery ? (
          // Sectioned View (All Products)
          <div>
            {/* Show All Sections or Specific Section based on activeSection */}
            {(activeSection === 'all' || activeSection === 'seedlings') && seedlingProducts.length > 0 && (
              <div className="mb-16">
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-heading font-black text-gray-900 flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    Seedlings
                  </h2>
                  <p className="text-gray-500 mt-1">
                    Premium, climate-controlled seedlings fresh from our nursery
                  </p>
                </div>

                {/* Seedling Categories */}
                {Object.entries(seedlingsByCategory).map(([categoryName, categoryProducts]) => (
                  <CategorySubsection
                    key={categoryName}
                    categoryName={categoryName}
                    products={categoryProducts}
                    rawProducts={rawProducts}
                    onAddToCart={onAddToCart}
                    onProductClick={setSelectedProduct}
                  />
                ))}
              </div>
            )}

            {(activeSection === 'all' || activeSection === 'merchandise') && merchandiseProducts.length > 0 && (
              <ProductSection
                title="Merchandise"
                subtitle="Show your ATL Urban Farms pride"
                products={merchandiseProducts}
                rawProducts={rawProducts}
                onAddToCart={onAddToCart}
                onProductClick={setSelectedProduct}
                showViewAll
                accentColor="purple"
              />
            )}

            {(activeSection === 'all' || activeSection === 'supplies') && suppliesProducts.length > 0 && (
              <ProductSection
                title="Supplies"
                subtitle="Everything you need to help your plants thrive"
                products={suppliesProducts}
                rawProducts={rawProducts}
                onAddToCart={onAddToCart}
                onProductClick={setSelectedProduct}
                showViewAll
                accentColor="amber"
              />
            )}
          </div>
        ) : (
          // Filtered View (Specific Category or Search Results)
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => {
                const rawProduct = rawProducts.find((p: any) => p.id === product.id);
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProductCard
                      id={product.id}
                      image={product.image}
                      name={product.name}
                      price={product.price}
                      category={product.category}
                      inStock={product.stock > 0}
                      onAddToCart={(qty) => onAddToCart(product, qty)}
                      onClick={() => setSelectedProduct(rawProduct)}
                      compareAtPrice={product.salePrice ?? null}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="8"/><path d="M11 8v3"/><path d="M11 15h.01"/></svg>
            </div>
            <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your filters or searching for something else.</p>
            <button
              onClick={() => {setSelectedCategory('All'); setSearchQuery(''); setActiveSection('all');}}
              className="mt-6 text-emerald-600 font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
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
    </div>
  );
};

export default ShopPage;
