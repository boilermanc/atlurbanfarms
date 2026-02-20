
import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// Check if a raw product is on sale - handles both conventions
// (compare_at_price as original price OR as sale price)
const isRawProductOnSale = (rawProduct: any): boolean => {
  const cap = rawProduct.compare_at_price;
  if (cap == null) return false;
  const numCap = Number(cap);
  const numPrice = Number(rawProduct.price) || 0;
  return numCap > 0 && numPrice > 0 && numCap !== numPrice;
};

// Map Supabase product to local Product type
const mapProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  shortDescription: p.short_description || null,
  price: Number(p.price) || 0,
  compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
  image: p.primary_image?.url || p.images?.[0]?.url || 'https://placehold.co/400x400?text=No+Image',
  category: p.category?.name || 'Uncategorized',
  stock: p.quantity_available || 0,
  productType: p.product_type || null,
  externalUrl: p.external_url || null,
  externalButtonText: p.external_button_text || null,
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
          <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {hasMore && showViewAll && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
              expanded
                ? `bg-${accentColor}-600 text-white border-${accentColor}-600`
                : `border-${accentColor}-600 text-${accentColor}-600 hover:bg-${accentColor}-600 hover:text-white`
            }`}
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
                  productType={product.productType}
                  externalUrl={product.externalUrl}
                  externalButtonText={product.externalButtonText}
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
        <h3 className="text-2xl font-heading font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          {categoryName}
          <span className="text-gray-400 font-normal">({products.length})</span>
        </h3>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
              expanded
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white'
            }`}
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
                  productType={product.productType}
                  externalUrl={product.externalUrl}
                  externalButtonText={product.externalButtonText}
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

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  // Track active parent category (null = "All Products")
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  // Track active subcategory within the parent (null = show all in parent)
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  // Toggle to show only in-stock products
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  // Show favorites view
  const [showFavorites, setShowFavorites] = useState(false);
  // Show on-sale view (products where compare_at_price differs from price)
  const [showOnSale, setShowOnSale] = useState(false);
  // Tag filter
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  // Search input ref for refocus after clear
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      setShowOnSale(false);
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
    // But preserve search if there's an active search query from the header
    if (!initialSearchQuery) {
      setSearchQuery('');
    }
    setShowFavorites(false);
    setShowOnSale(false);
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

  // Derive available tags from products' tag_assignments (only tags with products)
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, { id: string; name: string; tag_type: string | null; count: number }>();
    rawProducts.forEach((rp: any) => {
      const assignments = rp.tag_assignments || [];
      assignments.forEach((a: any) => {
        const tag = a.tag;
        if (!tag) return;
        const existing = tagMap.get(tag.id);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(tag.id, { id: tag.id, name: tag.name, tag_type: tag.tag_type, count: 1 });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawProducts]);

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

      // Tag filter
      if (activeTagId && rawProduct) {
        const tagAssignments = rawProduct.tag_assignments || [];
        const hasTag = tagAssignments.some((a: any) => a.tag_id === activeTagId);
        if (!hasTag) return false;
      }

      // On Sale view: only show products where compare_at_price differs from price
      if (showOnSale) {
        if (!rawProduct) return false;
        return isRawProductOnSale(rawProduct);
      }

      // If no parent selected, show all (that passed above filters)
      if (!activeParentId) return true;

      // Get all assigned category IDs and their details from the junction table
      const assignments = rawProduct?.category_assignments || [];
      let assignedCategoryIds = assignments.map((a: any) => a.category_id);
      let assignedCategories = assignments.map((a: any) => a.category).filter(Boolean);

      // Fallback to primary category if no junction table assignments exist
      if (assignedCategoryIds.length === 0 && rawProduct?.category) {
        assignedCategoryIds = [rawProduct.category.id];
        assignedCategories = [rawProduct.category];
      }

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
  }, [products, rawProducts, activeParentId, activeSubcategoryId, searchQuery, getChildCategories, showInStockOnly, showOnSale, activeTagId]);

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

  // Get on-sale products (compare_at_price differs from price)
  const onSaleProducts = useMemo(() => {
    return products.filter(p => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === p.id);
      if (!rawProduct) return false;
      return isRawProductOnSale(rawProduct);
    });
  }, [products, rawProducts]);

  // Find the "Seedlings" parent category and "On Sale this Week" category
  const { seedlingsParentId, onSaleWeekCategoryId } = useMemo(() => {
    const categories = rawCategories as Category[];
    const seedlings = categories.find(c => !c.parent_id && c.name.toLowerCase() === 'seedlings');
    const onSaleWeek = categories.find(c => c.name.toLowerCase().includes('on sale'));
    return {
      seedlingsParentId: seedlings?.id || null,
      onSaleWeekCategoryId: onSaleWeek?.id || null,
    };
  }, [rawCategories]);

  // Dynamic "On Sale this Week" seedling products: active seedlings where compare_at_price differs from price
  const onSaleSeedlings = useMemo(() => {
    if (!seedlingsParentId) return [];
    const seedlingSubcategoryIds = (rawCategories as Category[])
      .filter(c => c.parent_id === seedlingsParentId)
      .map(c => c.id);
    const seedlingCategoryIds = new Set([seedlingsParentId, ...seedlingSubcategoryIds]);

    return products.filter(p => {
      const rawProduct = rawProducts.find((rp: any) => rp.id === p.id);
      if (!rawProduct) return false;
      // Must be on sale
      if (!isRawProductOnSale(rawProduct)) return false;
      // Must be a seedling (assigned to Seedlings parent or any of its subcategories)
      const assignments = rawProduct.category_assignments || [];
      const assignedCatIds = assignments.length > 0
        ? assignments.map((a: any) => a.category_id)
        : rawProduct.category ? [rawProduct.category.id] : [];
      return assignedCatIds.some((catId: string) => seedlingCategoryIds.has(catId));
    });
  }, [products, rawProducts, rawCategories, seedlingsParentId]);

  // Determine if we should show sectioned view (when viewing "All" with no search)
  const showSectionedView = !activeParentId && !searchQuery && !showFavorites && !showOnSale && !activeTagId;

  return (
    <div className="min-h-screen pt-32 pb-10 bg-site">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {/* Shop Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-4"
          >
            The <span className="text-emerald-600">Aeroponic</span> Shop
          </motion.h1>
          <p className="text-gray-500 text-lg max-w-4xl">
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
              setShowOnSale(false);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              !activeParentId && !showFavorites && !showOnSale
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
                  setShowOnSale(false);
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${colorClasses}`}
              >
                {cat.name} {productCount > 0 && `(${productCount})`}
              </button>
            );
          })}
          {/* On Sale Button */}
          {onSaleProducts.length > 0 && (
            <button
              onClick={() => {
                setShowOnSale(true);
                setShowFavorites(false);
                setActiveParentId(null);
                setActiveSubcategoryId(null);
              }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                showOnSale
                  ? 'bg-red-600 text-white shadow-lg shadow-red-100'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              On Sale ({onSaleProducts.length})
            </button>
          )}
          {/* My Favorites Button */}
          <button
            onClick={() => {
              if (!user) {
                // Redirect to login if not authenticated
                onNavigate?.('login');
                return;
              }
              setShowFavorites(true);
              setShowOnSale(false);
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
          <div className="flex items-center gap-4 flex-wrap">
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

            {/* Tag filter dropdown */}
            {availableTags.length > 0 && (
              <div className="relative">
                <select
                  value={activeTagId || ''}
                  onChange={(e) => setActiveTagId(e.target.value || null)}
                  className="appearance-none px-4 py-2.5 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="">All Tags</option>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} ({tag.count})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-80 group">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12"
            />
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            ) : (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
            )}
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
              <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 flex items-center gap-3">
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
                          productType={product.productType}
                          externalUrl={product.externalUrl}
                          externalButtonText={product.externalButtonText}
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
        ) : showOnSale ? (
          // On Sale View - products with compare_at_price set
          <div>
            <div className="mb-8">
              <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                On Sale
              </h2>
              <p className="text-gray-500 mt-1">Seedlings currently at reduced prices</p>
            </div>

            {filteredProducts.length > 0 ? (
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
                          productType={product.productType}
                          externalUrl={product.externalUrl}
                          externalButtonText={product.externalButtonText}
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
            ) : (
              <div className="py-16 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-extrabold text-gray-900 mb-2">No sale items right now</h3>
                <p className="text-gray-500">Check back soon for deals on seedlings!</p>
              </div>
            )}
          </div>
        ) : showSectionedView ? (
          // Sectioned View (All Products - no parent selected)
          <div>
            {/* Dynamic "On Sale this Week" section - shows seedlings where compare_at_price differs from price */}
            {onSaleSeedlings.length > 0 && (
              <ProductSection
                title="On Sale this Week"
                subtitle="Seedlings currently at reduced prices"
                products={onSaleSeedlings}
                rawProducts={rawProducts}
                onAddToCart={onAddToCart}
                onProductClick={setSelectedProduct}
                showViewAll
                accentColor="red"
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                requireLoginToFavorite={true}
                onRequireLogin={() => onNavigate?.('login')}
              />
            )}
            {parentCategories.map((parentCat: Category) => {
              // Skip the manually-curated "On Sale" category — replaced by dynamic section above
              if (onSaleWeekCategoryId && parentCat.id === onSaleWeekCategoryId) return null;

              const parentProducts = productsByParentCategory[parentCat.id] || [];
              if (parentProducts.length === 0) return null;

              const catNameLower = parentCat.name.toLowerCase();
              const accentColor = catNameLower === 'merchandise' ? 'purple' : catNameLower === 'supplies' ? 'amber' : 'emerald';
              const hasSubcategories = getChildCategories(parentCat.id).length > 0;

              // For parent categories with subcategories, show grouped by subcategory
              if (hasSubcategories) {
                // Group products by subcategory using category_assignments (not primary category)
                const groupedBySubcat: Record<string, Product[]> = {};
                const subcategories = getChildCategories(parentCat.id);
                const seenSubcat = new Set<string>();

                parentProducts.forEach(product => {
                  const rawProduct = rawProducts.find((rp: any) => rp.id === product.id);
                  const assignments = rawProduct?.category_assignments || [];
                  let placed = false;

                  // Find which subcategory of this parent the product is assigned to
                  assignments.forEach((assignment: any) => {
                    const cat = assignment.category;
                    if (!cat) return;
                    const subcat = subcategories.find((c: Category) => c.id === cat.id);
                    if (subcat) {
                      const key = `${product.id}-${subcat.name}`;
                      if (!seenSubcat.has(key)) {
                        seenSubcat.add(key);
                        if (!groupedBySubcat[subcat.name]) groupedBySubcat[subcat.name] = [];
                        groupedBySubcat[subcat.name].push(product);
                        placed = true;
                      }
                    }
                  });

                  // Fallback: products assigned directly to parent or without matching subcategory
                  if (!placed) {
                    const fallbackName = rawProduct?.category?.name || 'Other';
                    if (!groupedBySubcat[fallbackName]) groupedBySubcat[fallbackName] = [];
                    groupedBySubcat[fallbackName].push(product);
                  }
                });

                return (
                  <div key={parentCat.id} className="mb-10">
                    <div className="mb-8">
                      <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full bg-${accentColor}-500`}></span>
                        {parentCat.name}
                      </h2>
                    </div>

                    {/* Render subcategories in sort_order, then any remaining groups */}
                    {[
                      ...subcategories.map(sc => sc.name).filter(name => groupedBySubcat[name]),
                      ...Object.keys(groupedBySubcat).filter(name => !subcategories.some(sc => sc.name === name))
                    ].map(subcatName => (
                      <CategorySubsection
                        key={subcatName}
                        categoryName={subcatName}
                        products={groupedBySubcat[subcatName]}
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
              <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900">
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
                      productType={product.productType}
                      externalUrl={product.externalUrl}
                      externalButtonText={product.externalButtonText}
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
              onClick={() => {setActiveParentId(null); setActiveSubcategoryId(null); setSearchQuery(''); setShowInStockOnly(false); setShowOnSale(false); setActiveTagId(null);}}
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
