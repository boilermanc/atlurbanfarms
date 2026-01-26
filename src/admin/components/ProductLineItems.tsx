import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Minus, X, Package, AlertTriangle } from 'lucide-react';

export interface OrderLineItem {
  product_id: string;
  product_name: string;
  product_price: number;
  product_image: string | null;
  quantity: number;
  line_total: number;
  available_stock: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  quantity_available: number;
  images?: { url: string; is_primary: boolean }[];
  primary_image?: { url: string } | null;
}

interface ProductLineItemsProps {
  lineItems: OrderLineItem[];
  onChange: (items: OrderLineItem[]) => void;
  overrideInventory?: boolean;
}

const ProductLineItems: React.FC<ProductLineItemsProps> = ({ lineItems, onChange, overrideInventory = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchProducts();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const searchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: productsData, error: searchError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          price,
          quantity_available,
          images:product_images(url, is_primary)
        `)
        .or(`name.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .order('name')
        .limit(5);

      if (searchError) throw searchError;

      const products: Product[] = (productsData || []).map((product) => {
        const images = product.images as { url: string; is_primary: boolean }[] || [];
        const primaryImage = images.find((img) => img.is_primary) || images[0] || null;

        return {
          ...product,
          images,
          primary_image: primaryImage,
        };
      });

      setSearchResults(products);
      setShowDropdown(products.length > 0);
    } catch (err) {
      console.error('Error searching products:', err);
      setError('Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = (product: Product) => {
    // Check if product already in cart
    const existingIndex = lineItems.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      // Increment quantity if already exists
      const updated = [...lineItems];
      const newQuantity = updated[existingIndex].quantity + 1;

      // Only enforce stock limits if override is not enabled
      if (!overrideInventory && newQuantity > product.quantity_available) {
        setError(`Cannot add more. Only ${product.quantity_available} in stock.`);
        return;
      }

      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQuantity,
        line_total: newQuantity * product.price,
      };

      onChange(updated);
    } else {
      // Add new product - only enforce stock check if override is not enabled
      if (!overrideInventory && product.quantity_available < 1) {
        setError('This product is out of stock.');
        return;
      }

      const newItem: OrderLineItem = {
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        product_image: product.primary_image?.url || null,
        quantity: 1,
        line_total: product.price,
        available_stock: product.quantity_available,
      };

      onChange([...lineItems, newItem]);
    }

    setSearchQuery('');
    setShowDropdown(false);
    setError(null);
  };

  const handleRemoveProduct = (productId: string) => {
    onChange(lineItems.filter((item) => item.product_id !== productId));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const item = lineItems.find((item) => item.product_id === productId);
    if (!item) return;

    if (newQuantity < 1) {
      handleRemoveProduct(productId);
      return;
    }

    // Only enforce stock limits if override is not enabled
    if (!overrideInventory && newQuantity > item.available_stock) {
      setError(`Cannot exceed available stock of ${item.available_stock}`);
      return;
    }

    const updated = lineItems.map((item) =>
      item.product_id === productId
        ? {
            ...item,
            quantity: newQuantity,
            line_total: newQuantity * item.product_price,
          }
        : item
    );

    onChange(updated);
    setError(null);
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.line_total, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isLowStock = (available: number, quantity: number) => {
    return available - quantity < 5 && available - quantity >= 0;
  };

  return (
    <div className="space-y-4">
      {/* Product Search */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder="Search products to add..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Product Search Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {searchResults.map((product) => {
              const isOutOfStock = product.quantity_available < 1;
              const isDisabled = isOutOfStock && !overrideInventory;

              return (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  disabled={isDisabled}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOutOfStock && overrideInventory ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {product.primary_image ? (
                      <img
                        src={product.primary_image.url}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Package className="text-slate-400" size={20} />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{product.name}</span>
                        {isOutOfStock && overrideInventory && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertTriangle size={10} />
                            Out of Stock
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-emerald-600 font-medium">
                          {formatCurrency(product.price)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Stock: {product.quantity_available}
                          {product.quantity_available < 5 && product.quantity_available > 0 && ' - Low!'}
                          {product.quantity_available === 0 && !overrideInventory && ' - Out of Stock'}
                        </span>
                      </div>
                    </div>
                    <Plus size={18} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !loading && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-slate-500">
            No products found
          </div>
        )}
      </div>

      {/* Selected Products Cart */}
      {lineItems.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <div className="text-sm font-medium text-slate-700">Selected Products</div>
          </div>

          <div className="divide-y divide-slate-100">
            {lineItems.map((item) => {
              const exceedsStock = item.quantity > item.available_stock;
              const isOutOfStock = item.available_stock < 1;

              return (
                <div key={item.product_id} className={`p-4 hover:bg-slate-50 transition-colors ${exceedsStock ? 'bg-amber-50/50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Package className="text-slate-400" size={24} />
                      </div>
                    )}

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {formatCurrency(item.product_price)} each
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Stock: {item.available_stock}
                        </span>
                        {isOutOfStock && overrideInventory && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs">
                            <AlertTriangle size={12} />
                            Out of Stock
                          </span>
                        )}
                        {exceedsStock && !isOutOfStock && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertTriangle size={12} />
                            Exceeds Stock
                          </span>
                        )}
                        {!exceedsStock && !isOutOfStock && isLowStock(item.available_stock, item.quantity) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertTriangle size={12} />
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg">
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus size={16} className="text-slate-600" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.product_id, parseInt(e.target.value) || 1)
                          }
                          min="1"
                          max={overrideInventory ? undefined : item.available_stock}
                          className={`w-16 text-center bg-transparent border-none focus:outline-none font-medium ${exceedsStock ? 'text-amber-700' : ''}`}
                        />
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                          disabled={!overrideInventory && item.quantity >= item.available_stock}
                          className="p-2 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Increase quantity"
                        >
                          <Plus size={16} className="text-slate-600" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="w-24 text-right font-medium text-slate-900">
                        {formatCurrency(item.line_total)}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveProduct(item.product_id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove product"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">Subtotal</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatCurrency(calculateSubtotal())}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Package className="mx-auto text-slate-400 mb-3" size={48} />
          <div className="text-slate-600 font-medium">No products added</div>
          <div className="text-sm text-slate-500 mt-1">Search and add products to create the order</div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default ProductLineItems;
