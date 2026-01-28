
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

// Category type with hierarchy
interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  parent?: { id: string; name: string } | null;
  sort_order?: number;
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  // Track active parent category (null = "All Products")
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  // Track active subcategory within the parent (null = show all in parent)
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);

  // Scroll to top when page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Sync active parent when initialCategory prop changes (e.g., from header navigation)
  useEffect(() => {
    if (initialCategory === 'All') {
      setActiveParentId(null);
      setActiveSubcategoryId(null);
    } else {
      // Find the category by name
      const category = rawCategories.find((c: Category) => c.name === initialCategory);
      if (category) {
        if (category.parent_id) {
          // It's a subcategory - set parent and subcategory
          setActiveParentId(category.parent_id);
          setActiveSubcategoryId(category.id);
        } else {
          // It's a parent category
          setActiveParentId(category.id);
          setActiveSubcategoryId(null);
        }
      }
    }
  }, [initialCategory, rawCategories]);

  // Map Supabase data to local types
  const products = rawProducts.map(mapProduct);

  // Separate categories into parent categories and get children helper
  const { parentCategories, getChildCategories, getCategoryById } = useMemo(() => {
    const categories = rawCategories as Category[];

    // Parent categories have no parent_id
    const parents = categories.filter(c => !c.parent_id);

    // Helper to get children for a parent
    const getChildren = (parentId: string): Category[] => {
      return categories.filter(c => c.parent_id === parentId);
    };

    // Helper to get category by id
    const getById = (id: string): Category | undefined => {
      return categories.find(c => c.id === id);
    };

    return {
      parentCategories: parents,
      getChildCategories: getChildren,
      getCategoryById: getById
    };
  }, [rawCategories]);

  // Get subcategories for the currently active parent
  const activeSubcategories = useMemo(() => {
    if (!activeParentId) return [];
    return getChildCategories(activeParentId);
  }, [activeParentId, getChildCategories]);

  // Filter products based on search and category hierarchy
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search filter
      const matchesSearch = searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // If no parent selected, show all
      if (!activeParentId) return true;

      // Find the product's category
      const rawProduct = rawProducts.find((rp: any) => rp.id === p.id);
      const productCategoryId = rawProduct?.category?.id;
      const productParentId = rawProduct?.category?.parent_id;

      // If subcategory selected, only show products in that subcategory
      if (activeSubcategoryId) {
        return productCategoryId === activeSubcategoryId;
      }

      // Show products in the parent category itself OR any of its subcategories
      const subcategoryIds = getChildCategories(activeParentId).map(c => c.id);
      return productCategoryId === activeParentId || subcategoryIds.includes(productCategoryId) || productParentId === activeParentId;
    });
  }, [products, rawProducts, activeParentId, activeSubcategoryId, searchQuery, getChildCategories]);

  // Group products by parent category for the "All Products" view
  const productsByParentCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    filteredProducts.forEach(product => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
      const productCategoryId = rawProduct?.category?.id;
      const productParentId = rawProduct?.category?.parent_id;

      // Determine which parent this product belongs to
      let parentId = productParentId || productCategoryId;

      if (!grouped[parentId]) {
        grouped[parentId] = [];
      }
      grouped[parentId].push(product);
    });

    return grouped;
  }, [filteredProducts, rawProducts]);

  // Group products by subcategory when viewing a parent category
  const productsBySubcategory = useMemo(() => {
    if (!activeParentId) return {};

    const grouped: Record<string, Product[]> = {};
    const subcategories = getChildCategories(activeParentId);

    filteredProducts.forEach(product => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
      const productCategoryId = rawProduct?.category?.id;

      // Find the subcategory name
      const subcat = subcategories.find(c => c.id === productCategoryId);
      const categoryName = subcat?.name || rawProduct?.category?.name || 'Other';

      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(product);
    });

    // Sort by subcategory order
    const orderedCategories = subcategories.map(c => c.name);
    const sortedGrouped: Record<string, Product[]> = {};

    orderedCategories.forEach((catName: string) => {
      if (grouped[catName]) {
        sortedGrouped[catName] = grouped[catName];
      }
    });

    // Add any remaining
    Object.keys(grouped).forEach(catName => {
      if (!sortedGrouped[catName]) {
        sortedGrouped[catName] = grouped[catName];
      }
    });

    return sortedGrouped;
  }, [filteredProducts, rawProducts, activeParentId, getChildCategories]);

  const loading = productsLoading || categoriesLoading;
  const error = productsError;

  // Determine if we should show sectioned view (when viewing "All" with no search)
  const showSectionedView = !activeParentId && !searchQuery;

  return (
    <div className="min-h-screen pt-28 pb-20 bg-white">
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

        {/* Main Category Tabs - ALWAYS visible */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => {
              setActiveParentId(null);
              setActiveSubcategoryId(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              !activeParentId
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </button>
          {parentCategories.map((cat: Category) => {
            const productCount = productsByParentCategory[cat.id]?.length || 0;
            const isActive = activeParentId === cat.id;
            // Use different colors for different parent categories
            const catNameLower = cat.name.toLowerCase();
            const colorClasses = catNameLower === 'merchandise'
              ? isActive ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              : catNameLower === 'supplies'
              ? isActive ? 'bg-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              : isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100';

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveParentId(cat.id);
                  setActiveSubcategoryId(null);
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${colorClasses}`}
              >
                {cat.name} {productCount > 0 && `(${productCount})`}
              </button>
            );
          })}
        </div>

        {/* Subcategory Chips - Only show when parent category is selected AND has children */}
        {activeParentId && activeSubcategories.length > 0 && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveSubcategoryId(null)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                !activeSubcategoryId
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              All
            </button>
            {activeSubcategories.map((subcat: Category) => (
              <button
                key={subcat.id}
                onClick={() => setActiveSubcategoryId(subcat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                  activeSubcategoryId === subcat.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
                }`}
              >
                {subcat.name}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex justify-end mb-8">
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
        ) : showSectionedView ? (
          // Sectioned View (All Products - no parent selected)
          <div>
            {parentCategories.map((parentCat: Category) => {
              const parentProducts = productsByParentCategory[parentCat.id] || [];
              if (parentProducts.length === 0) return null;

              const catNameLower = parentCat.name.toLowerCase();
              const accentColor = catNameLower === 'merchandise' ? 'purple' : catNameLower === 'supplies' ? 'amber' : 'emerald';
              const hasSubcategories = getChildCategories(parentCat.id).length > 0;

              // For parent categories with subcategories, show grouped by subcategory
              if (hasSubcategories) {
                // Group products by subcategory for this parent
                const groupedBySubcat: Record<string, Product[]> = {};
                parentProducts.forEach(product => {
                  const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
                  const subcatName = rawProduct?.category?.name || 'Other';
                  if (!groupedBySubcat[subcatName]) {
                    groupedBySubcat[subcatName] = [];
                  }
                  groupedBySubcat[subcatName].push(product);
                });

                return (
                  <div key={parentCat.id} className="mb-16">
                    <div className="mb-8">
                      <h2 className="text-2xl md:text-3xl font-heading font-black text-gray-900 flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full bg-${accentColor}-500`}></span>
                        {parentCat.name}
                      </h2>
                    </div>

                    {Object.entries(groupedBySubcat).map(([subcatName, subcatProducts]) => (
                      <CategorySubsection
                        key={subcatName}
                        categoryName={subcatName}
                        products={subcatProducts}
                        rawProducts={rawProducts}
                        onAddToCart={onAddToCart}
                        onProductClick={setSelectedProduct}
                      />
                    ))}
                  </div>
                );
              }

              // For parent categories without subcategories, show as a section
              return (
                <ProductSection
                  key={parentCat.id}
                  title={parentCat.name}
                  products={parentProducts}
                  rawProducts={rawProducts}
                  onAddToCart={onAddToCart}
                  onProductClick={setSelectedProduct}
                  showViewAll
                  accentColor={accentColor}
                />
              );
            })}
          </div>
        ) : activeParentId && !activeSubcategoryId && activeSubcategories.length > 0 ? (
          // Parent category with subcategories - show grouped by subcategory
          <div>
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-heading font-black text-gray-900">
                {getCategoryById(activeParentId)?.name || 'Products'}
              </h2>
            </div>
            {Object.entries(productsBySubcategory).map(([subcatName, subcatProducts]) => (
              <CategorySubsection
                key={subcatName}
                categoryName={subcatName}
                products={subcatProducts}
                rawProducts={rawProducts}
                onAddToCart={onAddToCart}
                onProductClick={setSelectedProduct}
              />
            ))}
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
              onClick={() => {setActiveParentId(null); setActiveSubcategoryId(null); setSearchQuery('');}}
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
