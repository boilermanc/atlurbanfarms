import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Trash2, Package, Image } from 'lucide-react';

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
  product_type?: string;
  stock_status?: string;
  track_inventory?: boolean;
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
  const [currentPage, setCurrentPage] = useState(1);

  // Save filter state before navigating to product edit
  const handleEditProduct = useCallback((productId: string) => {
    if (categoryFilter !== 'all') {
      sessionStorage.setItem('admin_products_category_filter', categoryFilter);
    }
    if (statusFilter !== 'active') {
      sessionStorage.setItem('admin_products_status_filter', statusFilter);
    }
    onEditProduct(productId);
  }, [categoryFilter, statusFilter, onEditProduct]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select(`*, category:product_categories(*), images:product_images(*)`)
        .order('name', { ascending: true });
      if (supabaseError) throw supabaseError;

      // Fetch purchase counts from order_items (excluding cancelled orders)
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(status)');

      if (orderItemsError) throw orderItemsError;

      // Calculate total purchases per product
      const purchaseCounts: Record<string, number> = {};
      (orderItemsData || []).forEach((item: any) => {
        if (item.orders?.status !== 'cancelled') {
          purchaseCounts[item.product_id] = (purchaseCounts[item.product_id] || 0) + item.quantity;
        }
      });

      const productsWithPrimaryImage = (data || []).map(product => ({
        ...product,
        primary_image: product.images?.find((img: ProductImage) => img.is_primary) || product.images?.[0] || null,
        purchase_count: purchaseCounts[product.id] || 0
      }));
      setProducts(productsWithPrimaryImage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
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
  }, [fetchProducts, fetchCategories, setCategoryFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);
      // Hide out-of-stock external products by default (unless searching for them specifically)
      const isOosExternal = product.product_type === 'external' && product.stock_status === 'out_of_stock';
      if (isOosExternal && !searchQuery) return false;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, statusFilter]);

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
              <p className="text-slate-500">{searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by adding your first product'}</p>
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
                    <td className="py-4 px-6"><span className="text-slate-600 font-medium">{product.purchase_count || 0}</span></td>
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
