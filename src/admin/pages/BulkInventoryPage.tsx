import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Package, Save, AlertCircle, CheckCircle, RefreshCw, Bell, Star, X } from 'lucide-react';

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
  featured: boolean;
  alert_count: number;
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
  const [categoryHierarchy, setCategoryHierarchy] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Track changes: Map<product_id, new_value>
  const [changes, setChanges] = useState<Map<string, number>>(new Map());

  // Sale price per-row state
  const [salePriceInputs, setSalePriceInputs] = useState<Map<string, string>>(new Map());
  const [salePriceStatus, setSalePriceStatus] = useState<Map<string, 'saving' | 'success' | 'error'>>(new Map());
  const [salePriceErrors, setSalePriceErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, statusFilter, categoryFilter, categoryHierarchy]);

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
          featured,
          category:product_categories(name)
        `)
        .order('name');

      if (fetchError) throw fetchError;

      // Fetch pending back-in-stock alert counts per product
      const alertCountMap = new Map<string, number>();
      const { data: alertData } = await supabase
        .from('back_in_stock_alerts')
        .select('product_id')
        .eq('status', 'pending');

      if (alertData) {
        alertData.forEach((a: any) => {
          alertCountMap.set(a.product_id, (alertCountMap.get(a.product_id) || 0) + 1);
        });
      }

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
        featured: p.featured ?? false,
        alert_count: alertCountMap.get(p.id) || 0,
      }));

      // Sort by category name, then product name
      mappedProducts.sort((a, b) => {
        const catCmp = a.category_name.localeCompare(b.category_name);
        return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
      });

      setProducts(mappedProducts);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(mappedProducts.map((p) => p.category_name))
      ).sort();
      setCategories(uniqueCategories);

      // Fetch category hierarchy for parent-child filter support
      const { data: catHierarchy } = await supabase
        .from('product_categories')
        .select('id, name, parent_id')
        .eq('is_active', true);
      setCategoryHierarchy(catHierarchy || []);
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

    // Apply category filter (include child categories when a parent is selected)
    if (categoryFilter !== 'all') {
      const selectedCat = categoryHierarchy.find((c) => c.name === categoryFilter);
      if (selectedCat) {
        const childNames = categoryHierarchy
          .filter((c) => c.parent_id === selectedCat.id)
          .map((c) => c.name);
        const matchNames = new Set([categoryFilter, ...childNames]);
        filtered = filtered.filter((p) => matchNames.has(p.category_name));
      } else {
        filtered = filtered.filter((p) => p.category_name === categoryFilter);
      }
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

      // Collect all product IDs that have any change
      const allProductIds = new Set([
        ...changes.keys(),
      ]);

      console.log('Saving inventory updates for', allProductIds.size, 'product(s)');

      let updatedCount = 0;
      const errors: string[] = [];

      for (const productId of allProductIds) {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (changes.has(productId)) {
          updatePayload.quantity_available = changes.get(productId);
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', productId);

        if (updateError) {
          console.error(`Error updating product ${productId}:`, updateError);
          const productName = products.find(p => p.id === productId)?.name || productId;
          errors.push(`Failed to update "${productName}": ${updateError.message}`);
        } else {
          updatedCount++;
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

  const [featuredToast, setFeaturedToast] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null);

  const handleFeaturedToggle = async (productId: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, featured: newValue } : p))
    );

    const { error: updateError } = await supabase
      .from('products')
      .update({ featured: newValue, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (updateError) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, featured: currentValue } : p))
      );
      const name = products.find((p) => p.id === productId)?.name || 'Product';
      setFeaturedToast({ id: productId, message: `Failed to update "${name}"`, type: 'error' });
    } else {
      const name = products.find((p) => p.id === productId)?.name || 'Product';
      setFeaturedToast({ id: productId, message: `"${name}" ${newValue ? 'featured' : 'unfeatured'}`, type: 'success' });
    }

    setTimeout(() => setFeaturedToast(null), 3000);
  };

  const handleReset = () => {
    setChanges(new Map());
    setSalePriceInputs(new Map());
    setSalePriceErrors(new Map());
    setError(null);
    setSuccessMessage(null);
  };

  const handleRefresh = () => {
    setChanges(new Map());
    setSalePriceInputs(new Map());
    setSalePriceErrors(new Map());
    setSalePriceStatus(new Map());
    setError(null);
    setSuccessMessage(null);
    fetchProducts();
  };

  // Sale price helpers
  const getSalePriceDisplay = (product: ProductInventory): string => {
    if (salePriceInputs.has(product.id)) return salePriceInputs.get(product.id)!;
    // Pre-fill: if product is already on sale, show current (discounted) price
    if (product.compare_at_price != null && product.price != null) return String(product.price);
    return '';
  };

  const isOnSale = (product: ProductInventory): boolean => {
    return product.compare_at_price != null;
  };

  const getOriginalPrice = (product: ProductInventory): number | null => {
    // Use the higher of price/compare_at_price to handle inverted data
    if (product.compare_at_price != null && product.price != null) {
      return Math.max(product.price, product.compare_at_price);
    }
    return product.price;
  };

  const handleClearSale = async (product: ProductInventory) => {
    if (product.compare_at_price == null) return;
    try {
      setSalePriceStatus(prev => new Map(prev).set(product.id, 'saving'));
      const restoredPrice = Math.max(product.price ?? 0, product.compare_at_price ?? 0);
      const { error } = await supabase
        .from('products')
        .update({
          price: restoredPrice,
          compare_at_price: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      if (error) throw error;
      setSalePriceStatus(prev => new Map(prev).set(product.id, 'success'));
      setSalePriceInputs(prev => { const m = new Map(prev); m.delete(product.id); return m; });
      await fetchProducts();
      setTimeout(() => setSalePriceStatus(prev => { const m = new Map(prev); m.delete(product.id); return m; }), 2000);
    } catch (err: any) {
      setSalePriceStatus(prev => new Map(prev).set(product.id, 'error'));
      setSalePriceErrors(prev => new Map(prev).set(product.id, err.message || 'Failed to clear sale'));
    }
  };

  const handleSalePriceChange = (productId: string, value: string) => {
    setSalePriceInputs(prev => new Map(prev).set(productId, value));
    setSalePriceErrors(prev => { const m = new Map(prev); m.delete(productId); return m; });
  };

  const handleSalePriceCommit = async (product: ProductInventory) => {
    // If user hasn't touched this input, no-op
    if (!salePriceInputs.has(product.id)) return;

    const inputValue = salePriceInputs.get(product.id)!;

    // Clear errors
    setSalePriceErrors(prev => { const m = new Map(prev); m.delete(product.id); return m; });

    // If empty → clear sale
    if (!inputValue.trim()) {
      if (product.compare_at_price == null) {
        // Already not on sale, just clear input state
        setSalePriceInputs(prev => { const m = new Map(prev); m.delete(product.id); return m; });
        return;
      }

      try {
        setSalePriceStatus(prev => new Map(prev).set(product.id, 'saving'));

        // Restore the higher of the two prices as the original
        const restoredPrice = Math.max(product.price ?? 0, product.compare_at_price ?? 0);
        const { error } = await supabase
          .from('products')
          .update({
            price: restoredPrice,
            compare_at_price: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (error) throw error;

        setSalePriceStatus(prev => new Map(prev).set(product.id, 'success'));
        setSalePriceInputs(prev => { const m = new Map(prev); m.delete(product.id); return m; });
        await fetchProducts();
        setTimeout(() => setSalePriceStatus(prev => { const m = new Map(prev); m.delete(product.id); return m; }), 2000);
      } catch (err: any) {
        setSalePriceStatus(prev => new Map(prev).set(product.id, 'error'));
        setSalePriceErrors(prev => new Map(prev).set(product.id, err.message || 'Failed to clear sale'));
      }
      return;
    }

    // Parse and validate
    const salePrice = parseFloat(inputValue);
    if (isNaN(salePrice) || salePrice <= 0) {
      setSalePriceErrors(prev => new Map(prev).set(product.id, 'Must be a positive number'));
      return;
    }

    // Compare against the "original" (non-sale) price — use the higher of price/compare_at_price
    // to handle inverted data from prior bulk updates
    const originalPrice = Math.max(product.price ?? 0, product.compare_at_price ?? 0);
    if (originalPrice > 0 && salePrice >= originalPrice) {
      setSalePriceErrors(prev => new Map(prev).set(product.id, `Must be less than $${originalPrice.toFixed(2)}`));
      return;
    }

    try {
      setSalePriceStatus(prev => new Map(prev).set(product.id, 'saving'));

      // Always store: compare_at_price = original (higher) price, price = sale (lower) price
      const origPrice = Math.max(product.price ?? 0, product.compare_at_price ?? 0);
      const updatePayload: Record<string, any> = {
        price: salePrice,
        compare_at_price: origPrice,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', product.id);

      if (error) throw error;

      setSalePriceStatus(prev => new Map(prev).set(product.id, 'success'));
      setSalePriceInputs(prev => { const m = new Map(prev); m.delete(product.id); return m; });
      await fetchProducts();
      setTimeout(() => setSalePriceStatus(prev => { const m = new Map(prev); m.delete(product.id); return m; }), 2000);
    } catch (err: any) {
      setSalePriceStatus(prev => new Map(prev).set(product.id, 'error'));
      setSalePriceErrors(prev => new Map(prev).set(product.id, err.message || 'Failed to save sale price'));
    }
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
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                    Featured
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Sale Price
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
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const hasQtyChange = changes.has(product.id);
                    const hasChange = hasQtyChange;
                    const newQty = getDisplayQuantity(product);
                    const difference = hasQtyChange
                      ? newQty - product.quantity_available
                      : 0;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          hasChange ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleFeaturedToggle(product.id, product.featured)}
                            className="group"
                            title={product.featured ? 'Remove from featured' : 'Mark as featured'}
                          >
                            <Star
                              size={20}
                              className={`transition-colors ${
                                product.featured
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 group-hover:text-amber-300'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditProduct?.(product.id)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left"
                            >
                              {product.name}
                            </button>
                            {!product.is_active && (
                              <span className="text-xs text-slate-400 italic">Inactive</span>
                            )}
                            {product.alert_count > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
                                title={`${product.alert_count} customer${product.alert_count !== 1 ? 's' : ''} waiting for back-in-stock notification`}
                              >
                                <Bell size={12} />
                                {product.alert_count} waiting
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 text-sm">{product.category_name}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-slate-700 font-medium">
                            {getOriginalPrice(product) != null ? `$${Number(getOriginalPrice(product)).toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-slate-400 text-sm">$</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={getSalePriceDisplay(product)}
                                onChange={(e) => handleSalePriceChange(product.id, e.target.value)}
                                onBlur={() => handleSalePriceCommit(product)}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                placeholder="none"
                                className={`w-28 px-3 py-2 text-right border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                                  salePriceErrors.has(product.id)
                                    ? 'border-red-300 bg-red-50 focus:ring-red-500/20 focus:border-red-500'
                                    : salePriceStatus.get(product.id) === 'success'
                                    ? 'border-emerald-300 bg-emerald-50 focus:ring-emerald-500/20 focus:border-emerald-500'
                                    : isOnSale(product)
                                    ? 'border-amber-300 bg-amber-50 focus:ring-amber-500/20 focus:border-amber-500'
                                    : 'border-slate-200 bg-white focus:ring-emerald-500/20 focus:border-emerald-500'
                                }`}
                              />
                              {isOnSale(product) && salePriceStatus.get(product.id) !== 'saving' && (
                                <button
                                  onClick={() => handleClearSale(product)}
                                  title="Remove sale price"
                                  className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                >
                                  <X size={14} />
                                </button>
                              )}
                              {salePriceStatus.get(product.id) === 'saving' && (
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              )}
                              {salePriceStatus.get(product.id) === 'success' && (
                                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                            {salePriceErrors.has(product.id) && (
                              <p className="text-xs text-red-600 mt-1 text-center">{salePriceErrors.get(product.id)}</p>
                            )}
                          </div>
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
                              hasQtyChange
                                ? 'border-amber-300 bg-amber-50 focus:ring-amber-500/20 focus:border-amber-500 font-semibold'
                                : 'border-slate-200 bg-white focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasQtyChange && (
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
          </div>
        )}

        {/* Featured Toast */}
        {featuredToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-20 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
              featuredToast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {featuredToast.message}
          </motion.div>
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
