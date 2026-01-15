import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';

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
  is_featured: boolean;
  category_id: string | null;
  category: Category | null;
  images: ProductImage[];
  primary_image: ProductImage | null;
  created_at: string;
}

interface ProductsPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const ITEMS_PER_PAGE = 20;

const ProductsPage: React.FC<ProductsPageProps> = ({ onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalProduct, setDeleteModalProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select(`*, category:product_categories(*), images:product_images(*)`)
        .order('created_at', { ascending: false });
      if (supabaseError) throw supabaseError;
      const productsWithPrimaryImage = (data || []).map(product => ({
        ...product,
        primary_image: product.images?.find((img: ProductImage) => img.is_primary) || product.images?.[0] || null
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
      const { data, error: supabaseError } = await supabase.from('product_categories').select('*').order('name');
      if (supabaseError) throw supabaseError;
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, statusFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter, statusFilter]);

  const handleDelete = async () => {
    if (!deleteModalProduct) return;
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

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Products</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your product catalog</p>
          </div>
          <button onClick={() => onNavigate('product-edit', { mode: 'add' })} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Add Product
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full md:w-48 px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="all">All Categories</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full md:w-40 px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">{error}</div>}

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : paginatedProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No products found</h3>
              <p className="text-slate-400">{searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by adding your first product'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Product</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Category</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Price</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Stock</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="text-right py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => onNavigate('product-edit', { id: product.id })}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                          {product.primary_image ? <img src={product.primary_image.url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg></div>}
                        </div>
                        <div><p className="text-white font-medium">{product.name}</p><p className="text-slate-400 text-sm">{product.slug}</p></div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-300">{product.category?.name || 'Uncategorized'}</td>
                    <td className="py-4 px-6"><span className="text-white font-medium">${product.price.toFixed(2)}</span>{product.compare_at_price && <span className="text-slate-500 text-sm line-through ml-2">${product.compare_at_price.toFixed(2)}</span>}</td>
                    <td className="py-4 px-6"><span className={`font-medium ${product.quantity_available <= 0 ? 'text-red-400' : product.quantity_available <= 10 ? 'text-yellow-400' : 'text-emerald-400'}`}>{product.quantity_available}</span></td>
                    <td className="py-4 px-6"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-600/50 text-slate-400'}`}>{product.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onNavigate('product-edit', { id: product.id })} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg></button>
                        <button onClick={() => setDeleteModalProduct(product)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
              <p className="text-sm text-slate-400">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-50">Previous</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page = i + 1;
                  if (totalPages > 5 && currentPage > 3) page = currentPage - 2 + i;
                  if (totalPages > 5 && currentPage > totalPages - 2) page = totalPages - 4 + i;
                  return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm font-medium rounded-lg ${currentPage === page ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{page}</button>;
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {deleteModalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Product</h3>
            <p className="text-slate-400 mb-6">Are you sure you want to delete <strong className="text-white">{deleteModalProduct.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModalProduct(null)} disabled={deleting} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2">
                {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default ProductsPage;
