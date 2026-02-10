
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProducts, useCategories, useFavorites } from '../src/hooks/useSupabase';
import { useAuth } from '../src/hooks/useAuth';
import { Product } from '../types';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

interface ShopPageProps {
  onAddToCart: (product: Product, quantity: number) => void;
  initialCategory?: string;
  initialSearchQuery?: string;
  onNavigate?: (view: string) => void;
  categoryNavKey?: number;
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
  shortDescription: p.short_description || null,
  price: p.price,
  compareAtPrice: p.compare_at_price ?? null,
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
  isFavorite?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
  requireLoginToFavorite?: boolean;
  onRequireLogin?: () => void;
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
  accentColor = 'emerald',
  isFavorite,
  onToggleFavorite,
  requireLoginToFavorite,
  onRequireLogin
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const displayProducts = expanded ? products : products.slice(0, 8);
  const hasMore = products.length > 8;

  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
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
                  inStock={rawProduct ? isProductInStock(rawProduct) : product.stock > 0}
                  onAddToCart={(qty) => onAddToCart(product, qty)}
                  onClick={() => onProductClick(rawProduct)}
                  compareAtPrice={product.compareAtPrice ?? null}
                  shortDescription={product.shortDescription}
                  description={product.description}
                  isFavorited={isFavorite?.(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  requireLoginToFavorite={requireLoginToFavorite}
                  onRequireLogin={onRequireLogin}
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
  isFavorite?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
  requireLoginToFavorite?: boolean;
  onRequireLogin?: () => void;
}

const CategorySubsection: React.FC<CategorySubsectionProps> = ({
  categoryName,
  products,
  rawProducts,
  onAddToCart,
  onProductClick,
  isFavorite,
  onToggleFavorite,
  requireLoginToFavorite,
  onRequireLogin
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
                  inStock={rawProduct ? isProductInStock(rawProduct) : product.stock > 0}
                  onAddToCart={(qty) => onAddToCart(product, qty)}
                  onClick={() => onProductClick(rawProduct)}
                  compareAtPrice={product.compareAtPrice ?? null}
                  shortDescription={product.shortDescription}
                  description={product.description}
                  isFavorited={isFavorite?.(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  requireLoginToFavorite={requireLoginToFavorite}
                  onRequireLogin={onRequireLogin}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Helper to check if a product is in stock based on inventory rules
const isProductInStock = (rawProduct: any): boolean => {
  // If track_inventory is false, check stock_status
  if (rawProduct.track_inventory === false) {
    return rawProduct.stock_status === 'in_stock';
  }
  // If track_inventory is true (or not set), check quantity_available
  return (rawProduct.quantity_available || 0) > 0;
};

const ShopPage: React.FC<ShopPageProps> = ({ onAddToCart, initialCategory = 'All', initialSearchQuery = '', onNavigate, categoryNavKey }) => {
  const { products: rawProducts, loading: productsLoading, error: productsError } = useProducts();
  const { categories: rawCategories, loading: categoriesLoading } = useCategories();
  const { user } = useAuth();
  const { favorites, isFavorite, toggleFavorite, syncLocalFavoritesToDatabase } = useFavorites(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  // Track active parent category (null = "All Products")
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  // Track active subcategory within the parent (null = show all in parent)
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  // Toggle to show only in-stock products
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  // Show favorites view
  const [showFavorites, setShowFavorites] = useState(false);

  // Sync localStorage favorites when user logs in
  useEffect(() => {
    if (user?.id) {
      syncLocalFavoritesToDatabase();
    }
  }, [user?.id, syncLocalFavoritesToDatabase]);

  // Scroll to top when page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Sync search query when initialSearchQuery prop changes (e.g., from header search)
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      // Reset category filters when searching from header
      setActiveParentId(null);
      setActiveSubcategoryId(null);
      setShowFavorites(false);
    }
  }, [initialSearchQuery]);

  // Sync active parent when initialCategory prop changes (e.g., from header navigation)
  // categoryNavKey ensures this fires even when re-selecting the same category
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
    // Clear search and favorites when navigating via header/dropdown
    setSearchQuery('');
    setShowFavorites(false);
  }, [initialCategory, rawCategories, categoryNavKey]);

  // Map Supabase data to local types
  const products = rawProducts.map(mapProduct);

  // Separate categories into parent categories and get children helper
  // Only include categories that have at least one active product
  const { parentCategories, getChildCategories, getCategoryById } = useMemo(() => {
    const categories = rawCategories as Category[];

    // Build set of category IDs (and their parent IDs) that have at least one active product
    const categoryIdsWithProducts = new Set<string>();
    rawProducts.forEach((rp: any) => {
      const assignments = rp.category_assignments || [];
      assignments.forEach((a: any) => {
        if (a.category_id) categoryIdsWithProducts.add(a.category_id);
        if (a.category?.parent_id) categoryIdsWithProducts.add(a.category.parent_id);
      });
      if (assignments.length === 0 && rp.category) {
        categoryIdsWithProducts.add(rp.category.id);
        if (rp.category.parent_id) categoryIdsWithProducts.add(rp.category.parent_id);
      }
    });

    // Parent categories: no parent_id AND have at least one active product
    const parents = categories.filter(c => !c.parent_id && categoryIdsWithProducts.has(c.id));

    // Helper to get children for a parent (only those with active products)
    const getChildren = (parentId: string): Category[] => {
      return categories.filter(c => c.parent_id === parentId && categoryIdsWithProducts.has(c.id));
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
  }, [rawCategories, rawProducts]);

  // Get subcategories for the currently active parent
  const activeSubcategories = useMemo(() => {
    if (!activeParentId) return [];
    return getChildCategories(activeParentId);
  }, [activeParentId, getChildCategories]);

  // Filter products based on search, category hierarchy, and stock status
  // Uses product_category_assignments junction table so products in multiple categories show correctly
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search filter
      const matchesSearch = searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Find the raw product data
      const rawProduct = rawProducts.find((rp: any) => rp.id === p.id);

      // In-stock filter
      if (showInStockOnly && rawProduct) {
        if (!isProductInStock(rawProduct)) return false;
      }

      // If no parent selected, show all (that passed above filters)
      if (!activeParentId) return true;

      // Get all assigned category IDs and their details from the junction table
      const assignments = rawProduct?.category_assignments || [];
      const assignedCategoryIds = assignments.map((a: any) => a.category_id);
      const assignedCategories = assignments.map((a: any) => a.category).filter(Boolean);

      // If subcategory selected, check if product is assigned to that subcategory
      if (activeSubcategoryId) {
        return assignedCategoryIds.includes(activeSubcategoryId);
      }

      // Show products assigned to the parent category itself OR any of its subcategories
      const subcategoryIds = getChildCategories(activeParentId).map(c => c.id);
      return assignedCategoryIds.some((catId: string) =>
        catId === activeParentId ||
        subcategoryIds.includes(catId) ||
        assignedCategories.find((c: any) => c?.id === catId)?.parent_id === activeParentId
      );
    });
  }, [products, rawProducts, activeParentId, activeSubcategoryId, searchQuery, getChildCategories, showInStockOnly]);

  // Group products by parent category for the "All Products" view
  // Products with multiple category assignments appear under each relevant parent
  const productsByParentCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    const seen = new Set<string>(); // Track product-parent pairs to avoid duplicates

    filteredProducts.forEach(product => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
      const assignments = rawProduct?.category_assignments || [];

      if (assignments.length === 0) {
        // Fallback to primary category_id
        const productCategoryId = rawProduct?.category?.id;
        const productParentId = rawProduct?.category?.parent_id;
        const parentId = productParentId || productCategoryId;
        if (parentId) {
          if (!grouped[parentId]) grouped[parentId] = [];
          grouped[parentId].push(product);
        }
        return;
      }

      assignments.forEach((assignment: any) => {
        const cat = assignment.category;
        if (!cat) return;
        const parentId = cat.parent_id || cat.id;
        const key = `${product.id}-${parentId}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!grouped[parentId]) grouped[parentId] = [];
        grouped[parentId].push(product);
      });
    });

    return grouped;
  }, [filteredProducts, rawProducts]);

  // Group products by subcategory when viewing a parent category
  // Uses category_assignments so products in multiple subcategories appear under each
  const productsBySubcategory = useMemo(() => {
    if (!activeParentId) return {};

    const grouped: Record<string, Product[]> = {};
    const subcategories = getChildCategories(activeParentId);
    const seen = new Set<string>();

    filteredProducts.forEach(product => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
      const assignments = rawProduct?.category_assignments || [];
      let placed = false;

      assignments.forEach((assignment: any) => {
        const cat = assignment.category;
        if (!cat) return;
        // Only group under subcategories of the active parent
        const subcat = subcategories.find(c => c.id === cat.id);
        if (subcat) {
          const key = `${product.id}-${subcat.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            if (!grouped[subcat.name]) grouped[subcat.name] = [];
            grouped[subcat.name].push(product);
            placed = true;
          }
        } else if (cat.id === activeParentId) {
          // Product assigned directly to the parent category
          const key = `${product.id}-Other`;
          if (!seen.has(key)) {
            seen.add(key);
            if (!grouped['Other']) grouped['Other'] = [];
            grouped['Other'].push(product);
            placed = true;
          }
        }
      });

      // Fallback for products without assignments
      if (!placed && assignments.length === 0) {
        const categoryName = rawProduct?.category?.name || 'Other';
        if (!grouped[categoryName]) grouped[categoryName] = [];
        grouped[categoryName].push(product);
      }
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

  // Get favorite products
  const favoriteProducts = useMemo(() => {
    return products.filter(p => favorites.includes(p.id));
  }, [products, favorites]);

  // Determine if we should show sectioned view (when viewing "All" with no search)
  const showSectionedView = !activeParentId && !searchQuery && !showFavorites;

  return (
    <div className="min-h-screen pt-20 pb-10 bg-site">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {/* Shop Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-heading font-black text-gray-900 mb-4"
          >
            The <span className="text-emerald-600">Aeroponic</span> Shop
          </motion.h1>
          <p className="text-gray-500 text-lg max-w-2xl">
            Premium seedlings, growing supplies, and everything you need for your aeroponic garden needs.
          </p>
        </div>

        {/* Main Category Tabs - ALWAYS visible */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => {
              setActiveParentId(null);
              setActiveSubcategoryId(null);
              setShowFavorites(false);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              !activeParentId && !showFavorites
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </button>
          {parentCategories.map((cat: Category) => {
            const productCount = productsByParentCategory[cat.id]?.length || 0;
            const isActive = activeParentId === cat.id && !showFavorites;
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
                  setShowFavorites(false);
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${colorClasses}`}
              >
                {cat.name} {productCount > 0 && `(${productCount})`}
              </button>
            );
          })}
          {/* My Favorites Button */}
          <button
            onClick={() => {
              if (!user) {
                // Redirect to login if not authenticated
                onNavigate?.('login');
                return;
              }
              setShowFavorites(true);
              setActiveParentId(null);
              setActiveSubcategoryId(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              !user
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : showFavorites
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-100'
                : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={showFavorites && user ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            My Favorites {user && favorites.length > 0 && `(${favorites.length})`}
          </button>
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

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          {/* In-stock toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div className="relative">
              <input
                type="checkbox"
                checked={showInStockOnly}
                onChange={(e) => setShowInStockOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5"></div>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
              Show in-stock only
            </span>
          </label>

          {/* Search */}
          <div className="relative w-full sm:w-80 group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
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
          <div className="py-16 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">Failed to load products</h3>
            <p className="text-red-500">{error}</p>
          </div>
        ) : showFavorites ? (
          // Favorites View
          <div>
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-heading font-black text-gray-900 flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="#EC4899"
                  stroke="#EC4899"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
                My Favorites
              </h2>
              <p className="text-gray-500 mt-1">Products you've saved for later</p>
            </div>

            {favoriteProducts.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              >
                <AnimatePresence mode="popLayout">
                  {favoriteProducts.map((product) => {
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
                          inStock={rawProduct ? isProductInStock(rawProduct) : product.stock > 0}
                          onAddToCart={(qty) => onAddToCart(product, qty)}
                          onClick={() => setSelectedProduct(rawProduct)}
                          compareAtPrice={product.compareAtPrice ?? null}
                          shortDescription={product.shortDescription}
                          description={product.description}
                          isFavorited={true}
                          onToggleFavorite={toggleFavorite}
                          requireLoginToFavorite={true}
                          onRequireLogin={() => onNavigate?.('login')}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="py-16 text-center">
                <div className="w-20 h-20 bg-pink-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-pink-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">No favorites yet</h3>
                <p className="text-gray-500 mb-6">
                  {user ? (
                    "Browse our products and tap the heart icon to save your favorites!"
                  ) : (
                    "Sign in to save your favorites across devices, or browse and tap the heart icon to save locally."
                  )}
                </p>
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveParentId(null);
                  }}
                  className="px-6 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-colors"
                >
                  Browse Products
                </button>
              </div>
            )}
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
                  <div key={parentCat.id} className="mb-10">
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
                        isFavorite={isFavorite}
                        onToggleFavorite={toggleFavorite}
                        requireLoginToFavorite={true}
                        onRequireLogin={() => onNavigate?.('login')}
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
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                  requireLoginToFavorite={true}
                  onRequireLogin={() => onNavigate?.('login')}
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
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                requireLoginToFavorite={true}
                onRequireLogin={() => onNavigate?.('login')}
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
                      inStock={rawProduct ? isProductInStock(rawProduct) : product.stock > 0}
                      onAddToCart={(qty) => onAddToCart(product, qty)}
                      onClick={() => setSelectedProduct(rawProduct)}
                      compareAtPrice={product.compareAtPrice ?? null}
                      shortDescription={product.shortDescription}
                      description={product.description}
                      isFavorited={isFavorite(product.id)}
                      onToggleFavorite={toggleFavorite}
                      requireLoginToFavorite={true}
                      onRequireLogin={() => onNavigate?.('login')}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && !error && filteredProducts.length === 0 && !showFavorites && (
          <div className="py-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="8"/><path d="M11 8v3"/><path d="M11 15h.01"/></svg>
            </div>
            <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your filters or searching for something else.</p>
            <button
              onClick={() => {setActiveParentId(null); setActiveSubcategoryId(null); setSearchQuery(''); setShowInStockOnly(false);}}
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
