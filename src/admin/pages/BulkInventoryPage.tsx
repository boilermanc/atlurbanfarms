import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Package, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface ProductInventory {
  id: string;
  name: string;
  slug: string;
  category_name: string;
  quantity_available: number;
  is_active: boolean;
  low_stock_threshold: number;
  price: number | null;
  compare_at_price: number | null;
}


interface BulkInventoryPageProps {
  onEditProduct?: (productId: string) => void;
}

const BulkInventoryPage: React.FC<BulkInventoryPageProps> = ({ onEditProduct }) => {
  const { adminUser } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductInventory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Track changes: Map<product_id, new_quantity>
  const [changes, setChanges] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, statusFilter, categoryFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          quantity_available,
          is_active,
          low_stock_threshold,
          price,
          compare_at_price,
          category:product_categories(name)
        `)
        .order('name');

      if (fetchError) throw fetchError;

      // Map data to flat structure
      const mappedProducts: ProductInventory[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        quantity_available: p.quantity_available || 0,
        is_active: p.is_active,
        low_stock_threshold: p.low_stock_threshold || 10,
        category_name: p.category?.name || 'Uncategorized',
        price: p.price,
        compare_at_price: p.compare_at_price,
      }));

      setProducts(mappedProducts);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(mappedProducts.map((p) => p.category_name))
      ).sort();
      setCategories(uniqueCategories);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((p) => p.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((p) => !p.is_active);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category_name === categoryFilter);
    }

    setFilteredProducts(filtered);
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const newQuantity = parseInt(value, 10);

    if (isNaN(newQuantity) || value === '') {
      // Remove from changes if invalid
      const newChanges = new Map(changes);
      newChanges.delete(productId);
      setChanges(newChanges);
      return;
    }

    // Find original quantity
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Only track if different from original
    if (newQuantity !== product.quantity_available) {
      const newChanges = new Map(changes);
      newChanges.set(productId, newQuantity);
      setChanges(newChanges);
    } else {
      // Remove from changes if same as original
      const newChanges = new Map(changes);
      newChanges.delete(productId);
      setChanges(newChanges);
    }
  };

  const getDisplayQuantity = (product: ProductInventory): number => {
    return changes.has(product.id) ? changes.get(product.id)! : product.quantity_available;
  };

  const hasChanges = () => changes.size > 0;

  const handleSaveAll = async () => {
    if (!hasChanges()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Prepare updates array
      const updates = Array.from(changes.entries()).map(
        ([product_id, new_quantity]) => ({
          product_id,
          new_quantity,
        })
      );

      // Log the payload for debugging
      console.log('Saving inventory updates:', updates);

      // Update each product directly (more reliable than RPC)
      let updatedCount = 0;
      const errors: string[] = [];

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            quantity_available: update.new_quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.product_id);

        if (updateError) {
          console.error(`Error updating product ${update.product_id}:`, updateError);
          const productName = products.find(p => p.id === update.product_id)?.name || update.product_id;
          errors.push(`Failed to update "${productName}": ${updateError.message}`);
        } else {
          updatedCount++;
          console.log(`Updated product ${update.product_id} to quantity: ${update.new_quantity}`);
        }
      }

      if (errors.length > 0 && updatedCount === 0) {
        throw new Error(errors.join('; '));
      }

      // Show success message
      if (errors.length > 0) {
        setSuccessMessage(`Updated ${updatedCount} product(s). Some failed: ${errors.join('; ')}`);
      } else {
        setSuccessMessage(`Successfully updated ${updatedCount} product(s)`);
      }

      // Clear changes
      setChanges(new Map());

      // Refresh products
      await fetchProducts();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error saving inventory:', err);
      setError(err.message || 'Failed to save inventory updates');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setChanges(new Map());
    setError(null);
    setSuccessMessage(null);
  };

  const handleRefresh = () => {
    setChanges(new Map());
    setError(null);
    setSuccessMessage(null);
    fetchProducts();
  };

  return (
    <div className={`space-y-4 ${hasChanges() ? 'pb-36' : ''}`}>
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-emerald-800 font-medium">Success</p>
              <p className="text-emerald-700 text-sm mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">All Products</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Save Actions */}
          {hasChanges() && (
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Reset Changes
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Update All ({changes.size})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Regular Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Compare at Price
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Current Inventory
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    New Inventory
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const hasChange = changes.has(product.id);
                    const newQty = getDisplayQuantity(product);
                    const difference = hasChange
                      ? newQty - product.quantity_available
                      : 0;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          hasChange ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <button
                              type="button"
                              onClick={() => onEditProduct?.(product.id)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left"
                            >
                              {product.name}
                            </button>
                            {!product.is_active && (
                              <span className="text-xs text-slate-400 italic ml-2">Inactive</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 text-sm">{product.category_name}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-slate-800">
                            {product.price != null ? `$${product.price.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-emerald-600">
                            {product.compare_at_price != null ? `$${product.compare_at_price.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`font-semibold ${
                              product.quantity_available === 0
                                ? 'text-red-600'
                                : product.quantity_available <= product.low_stock_threshold
                                ? 'text-amber-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {product.quantity_available}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="0"
                            value={newQty}
                            onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                            className={`w-24 px-3 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                              hasChange
                                ? 'border-amber-300 bg-amber-50 focus:ring-amber-500/20 focus:border-amber-500 font-semibold'
                                : 'border-slate-200 bg-white focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasChange && (
                            <span
                              className={`text-sm font-semibold ${
                                difference > 0
                                  ? 'text-emerald-600'
                                  : difference < 0
                                  ? 'text-red-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {difference > 0 ? '+' : ''}
                              {difference}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Footer */}
        {hasChanges() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10"
          >
            <div className="bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6">
              <div className="text-sm">
                <span className="text-slate-300">Pending changes:</span>{' '}
                <span className="font-bold text-white">{changes.size} product(s)</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save All
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
  );
};

export default BulkInventoryPage;
