import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProductInventorySummary } from '../types/inventory';

interface LowStockAlertProps {
  products?: ProductInventorySummary[];
  compact?: boolean;
  onProductClick?: (productId: string) => void;
}

const LowStockAlert: React.FC<LowStockAlertProps> = ({
  products: propProducts,
  compact = false,
  onProductClick,
}) => {
  const [products, setProducts] = useState<ProductInventorySummary[]>([]);
  const [loading, setLoading] = useState(!propProducts);
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Fetch low stock products if not provided via props
  useEffect(() => {
    if (propProducts) {
      setProducts(propProducts);
      return;
    }

    const fetchLowStock = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('inventory_by_product')
          .select('*')
          .eq('stock_status', 'low_stock')
          .order('quantity_available');

        if (error) throw error;
        // Map to include backward-compatible field names
        const mappedData = (data || []).map(item => ({
          ...item,
          product_id: item.id,
          product_name: item.name,
          total_available: item.quantity_available,
        }));
        setProducts(mappedData);
      } catch (err) {
        console.error('Error fetching low stock products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLowStock();
  }, [propProducts]);

  if (loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-amber-700 font-medium text-sm">Low Stock Alert</p>
              <p className="text-amber-600/70 text-xs">
                {products.length} product{products.length > 1 ? 's' : ''} below threshold
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={20} className="text-amber-600" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-2">
                {products.slice(0, 5).map((product) => (
                  <button
                    key={product.product_id}
                    onClick={() => onProductClick?.(product.product_id)}
                    className="w-full flex items-center justify-between p-2 bg-white rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                  >
                    <span className="text-slate-800 text-sm">{product.product_name}</span>
                    <span className="text-amber-600 text-sm font-mono font-medium">
                      {product.total_available} left
                    </span>
                  </button>
                ))}
                {products.length > 5 && (
                  <p className="text-center text-xs text-slate-500 pt-1">
                    +{products.length - 5} more products
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-50 border border-amber-200 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={20} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-amber-700 font-semibold mb-1">Low Stock Alert</h3>
          <p className="text-amber-600/70 text-sm mb-3">
            The following products are running low on inventory:
          </p>
          <div className="flex flex-wrap gap-2">
            {products.map((product) => (
              <button
                key={product.product_id}
                onClick={() => onProductClick?.(product.product_id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg hover:bg-slate-50 transition-colors group border border-slate-200"
              >
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">
                  {product.product_name}
                </span>
                <span className="text-slate-500 text-xs">
                  ({product.total_available}/{product.low_stock_threshold})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LowStockAlert;
