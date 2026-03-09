import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { enrichBundleStock } from '../../hooks/useSupabase';
import { Plus, Search, Edit2, Trash2, Package, Image, Tag, X, ChevronDown } from 'lucide-react';

interface ProductImage {
  id: string;
  url: string;
  is_primary: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  quantity_available: number;
  is_active: boolean;
  featured: boolean;
  category_id: string | null;
  category: Category | null;
  images: ProductImage[];
  primary_image: ProductImage | null;
  created_at: string;
  purchase_count?: number;
  new_purchase_count?: number;
  legacy_purchase_count?: number;
  product_type?: string;
  stock_status?: string;
  track_inventory?: boolean;
}

interface ProductTag {
  id: string;
  name: string;
  slug: string;
  tag_type: string;
}

interface ProductsPageProps {
  onEditProduct: (productId: string) => void;
}

const ITEMS_PER_PAGE = 50;

const ProductsPage: React.FC<ProductsPageProps> = ({ onEditProduct }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalProduct, setDeleteModalProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagProductMap, setTagProductMap] = useState<Record<string, Set<string>>>({});
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = React.useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Save filter state before navigating to product edit
  const handleEditProduct = useCallback((productId: string) => {
    if (categoryFilter !== 'all') {
      sessionStorage.setItem('admin_products_category_filter', categoryFilter);
    }
    if (statusFilter !== 'active') {
      sessionStorage.setItem('admin_products_status_filter', statusFilter);
    }
    if (selectedTagIds.length > 0) {
      sessionStorage.setItem('admin_products_tag_filter', JSON.stringify(selectedTagIds));
    }
    onEditProduct(productId);
  }, [categoryFilter, statusFilter, selectedTagIds, onEditProduct]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select(`*, category:product_categories(*), images:product_images(*)`)
        .order('name', { ascending: true });
      if (supabaseError) throw supabaseError;

      // Fetch purchase counts from both new and legacy order items
      const [orderItemsResult, legacyItemsResult] = await Promise.all([
        supabase
          .from('order_items')
          .select('product_id, quantity, orders!inner(status)'),
        supabase
          .from('legacy_order_items')
          .select('product_id, woo_product_id, quantity'),
      ]);

      if (orderItemsResult.error) throw orderItemsResult.error;
      if (legacyItemsResult.error) throw legacyItemsResult.error;

      // Build woo_id → product UUID map for legacy items missing product_id
      const wooIdToProductId: Record<number, string> = {};
      (data || []).forEach((p: any) => {
        if (p.woo_id) wooIdToProductId[p.woo_id] = p.id;
      });

      // Tally new-platform purchases (excluding cancelled orders)
      const newCounts: Record<string, number> = {};
      (orderItemsResult.data || []).forEach((item: any) => {
        if (item.orders?.status !== 'cancelled') {
          newCounts[item.product_id] = (newCounts[item.product_id] || 0) + item.quantity;
        }
      });

      // Tally legacy WooCommerce purchases
      const legacyCounts: Record<string, number> = {};
      (legacyItemsResult.data || []).forEach((item: any) => {
        const productId = item.product_id || (item.woo_product_id && wooIdToProductId[item.woo_product_id]);
        if (productId) {
          legacyCounts[productId] = (legacyCounts[productId] || 0) + item.quantity;
        }
      });

      const productsWithPrimaryImage = (data || []).map(product => {
        const newCount = newCounts[product.id] || 0;
        const legacyCount = legacyCounts[product.id] || 0;
        return {
          ...product,
          primary_image: product.images?.find((img: ProductImage) => img.is_primary) || product.images?.[0] || null,
          purchase_count: newCount + legacyCount,
          new_purchase_count: newCount,
          legacy_purchase_count: legacyCount,
        };
      });
      // Enrich bundle products with computed stock from component items
      const enrichedProducts = await enrichBundleStock(productsWithPrimaryImage);
      setProducts(enrichedProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const [tagsRes, assignmentsRes] = await Promise.all([
        supabase.from('product_tags').select('id, name, slug, tag_type').order('name'),
        supabase.from('product_tag_assignments').select('product_id, tag_id'),
      ]);
      if (tagsRes.error) throw tagsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      setTags(tagsRes.data || []);
      const map: Record<string, Set<string>> = {};
      (assignmentsRes.data || []).forEach(a => {
        if (!map[a.tag_id]) map[a.tag_id] = new Set();
        map[a.tag_id].add(a.product_id);
      });
      setTagProductMap(map);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, []);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: supabaseError } = await supabase.from('product_categories').select('*').order('sort_order');
      if (supabaseError) throw supabaseError;
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchTags();

    // Check for tag filter saved from previous visit
    const sessionTagFilter = sessionStorage.getItem('admin_products_tag_filter');
    if (sessionTagFilter) {
      try { setSelectedTagIds(JSON.parse(sessionTagFilter)); } catch {}
      sessionStorage.removeItem('admin_products_tag_filter');
    }

    // Check for status filter saved from previous visit (e.g., returning from product edit)
    const sessionStatusFilter = sessionStorage.getItem('admin_products_status_filter');
    if (sessionStatusFilter) {
      setStatusFilter(sessionStatusFilter);
      sessionStorage.removeItem('admin_products_status_filter');
    }

    // Check for category filter saved from previous visit (e.g., returning from product edit)
    const sessionCategoryFilter = sessionStorage.getItem('admin_products_category_filter');
    if (sessionCategoryFilter) {
      setCategoryFilter(sessionCategoryFilter);
      sessionStorage.removeItem('admin_products_category_filter');
    } else {
      // Check for category filter passed from CategoriesPage (one-time migration to URL)
      const storedCategoryFilter = localStorage.getItem('admin_products_category_filter');
      if (storedCategoryFilter) {
        setCategoryFilter(storedCategoryFilter);
        localStorage.removeItem('admin_products_category_filter');
      }
    }
  }, [fetchProducts, fetchCategories, fetchTags, setCategoryFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);
      const matchesTags = selectedTagIds.length === 0 ||
        selectedTagIds.some(tagId => tagProductMap[tagId]?.has(product.id));
      // Hide out-of-stock external products by default (unless searching for them specifically)
      const isOosExternal = product.product_type === 'external' && product.stock_status === 'out_of_stock';
      if (isOosExternal && !searchQuery) return false;
      return matchesSearch && matchesCategory && matchesStatus && matchesTags;
    });
  }, [products, searchQuery, categoryFilter, statusFilter, selectedTagIds, tagProductMap]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);


  const handleDelete = async () => {
    if (!deleteModalProduct) return;

    // Safety check: prevent deletion of products with orders
    if ((deleteModalProduct.purchase_count || 0) > 0) {
      setError('This product has been purchased and cannot be deleted. Set it to Inactive instead.');
      setDeleteModalProduct(null);
      return;
    }

    try {
      setDeleting(true);
      await supabase.from('product_images').delete().eq('product_id', deleteModalProduct.id);
      const { error: productError } = await supabase.from('products').delete().eq('id', deleteModalProduct.id);
      if (productError) throw productError;
      setDeleteModalProduct(null);
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Products</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your product catalog</p>
          </div>
          <button onClick={() => handleEditProduct('')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors">
            <Plus size={20} />
            Add Product
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full md:w-48 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
              <option value="all">All Categories</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full md:w-40 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="relative" ref={tagDropdownRef}>
              <button
                onClick={() => setShowTagDropdown(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all w-full md:w-auto ${
                  selectedTagIds.length > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <Tag size={16} />
                {selectedTagIds.length === 0 ? 'Filter by Tags' : `${selectedTagIds.length} Tag${selectedTagIds.length > 1 ? 's' : ''}`}
                <ChevronDown size={14} className={`transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
              </button>
              {selectedTagIds.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTagIds([]); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-500 hover:bg-slate-700 text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              )}
              {showTagDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto">
                  <div className="p-2">
                    {tags.length === 0 ? (
                      <p className="text-sm text-slate-400 px-3 py-2">No tags found</p>
                    ) : (
                      tags.map(tag => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        const count = tagProductMap[tag.id]?.size || 0;
                        return (
                          <label
                            key={tag.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedTagIds(prev =>
                                  isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                                );
                                setCurrentPage(1);
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20"
                            />
                            <span className="text-sm text-slate-700 flex-1">{tag.name}</span>
                            <span className="text-xs text-slate-400">{count}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {selectedTagIds.length > 0 && (
                    <div className="border-t border-slate-100 p-2">
                      <button
                        onClick={() => { setSelectedTagIds([]); setCurrentPage(1); }}
                        className="w-full text-sm text-slate-500 hover:text-slate-700 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Clear tags
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : paginatedProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No products found</h3>
              <p className="text-slate-500">{searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || selectedTagIds.length > 0 ? 'Try adjusting your filters' : 'Get started by adding your first product'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Price</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Purchases</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleEditProduct(product.id)}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                          {product.primary_image ? <img src={product.primary_image.url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Image size={20} /></div>}
                        </div>
                        <div><p className="text-slate-800 font-medium">{product.name}</p><p className="text-slate-500 text-sm">{product.slug}</p></div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{product.category?.name || 'Uncategorized'}</td>
                    <td className="py-4 px-6">
                      {product.compare_at_price != null && Number(product.compare_at_price) > 0 && Number(product.compare_at_price) !== Number(product.price) ? (
                        <>
                          <span className="text-slate-400 text-sm line-through">${Math.max(Number(product.price), Number(product.compare_at_price)).toFixed(2)}</span>
                          <span className="text-red-600 font-semibold ml-2">${Math.min(Number(product.price), Number(product.compare_at_price)).toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-slate-800 font-semibold">${Number(product.price).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {product.product_type === 'external' ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${product.stock_status === 'in_stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {product.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                        </span>
                      ) : (
                        <span className={`font-semibold ${product.quantity_available <= 0 ? 'text-red-600' : product.quantity_available <= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{product.quantity_available}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className="text-slate-600 font-medium"
                        title={product.legacy_purchase_count ? `${product.purchase_count} total (${product.new_purchase_count} new + ${product.legacy_purchase_count} legacy)` : undefined}
                      >
                        {product.purchase_count || 0}
                      </span>
                    </td>
                    <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActive(product)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${product.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${product.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleEditProduct(product.id)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"><Edit2 size={18} /></button>
                        {(product.purchase_count || 0) > 0 ? (
                          <div className="relative group">
                            <button disabled className="p-2 text-slate-300 cursor-not-allowed rounded-xl"><Trash2 size={18} /></button>
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Cannot delete - product has orders
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteModalProduct(product)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">Previous</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page = i + 1;
                  if (totalPages > 5 && currentPage > 3) page = currentPage - 2 + i;
                  if (totalPages > 5 && currentPage > totalPages - 2) page = totalPages - 4 + i;
                  return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${currentPage === page ? 'bg-emerald-500 text-white' : 'text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{page}</button>;
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {deleteModalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            {(deleteModalProduct.purchase_count || 0) > 0 ? (
              <>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Cannot Delete Product</h3>
                <p className="text-slate-600 mb-4">
                  <strong className="text-slate-800">{deleteModalProduct.name}</strong> has been purchased {deleteModalProduct.purchase_count} time{deleteModalProduct.purchase_count !== 1 ? 's' : ''} and cannot be deleted.
                </p>
                <p className="text-slate-600 mb-6">You can deactivate this product instead to hide it from the store.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteModalProduct(null)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
                  <button
                    onClick={() => {
                      handleToggleActive(deleteModalProduct);
                      setDeleteModalProduct(null);
                    }}
                    disabled={!deleteModalProduct.is_active}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteModalProduct.is_active ? 'Deactivate' : 'Already Inactive'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Product</h3>
                <p className="text-slate-600 mb-6">Are you sure you want to delete <strong className="text-slate-800">{deleteModalProduct.name}</strong>? This cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteModalProduct(null)} disabled={deleting} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2">
                    {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default ProductsPage;
