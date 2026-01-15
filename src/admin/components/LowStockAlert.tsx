import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
          .eq('is_low_stock', true)
          .order('total_available');

        if (error) throw error;
        setProducts(data || []);
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
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-500/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="text-amber-400 font-medium text-sm">Low Stock Alert</p>
              <p className="text-amber-400/70 text-xs">
                {products.length} product{products.length > 1 ? 's' : ''} below threshold
              </p>
            </div>
          </div>
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-5 h-5 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </motion.svg>
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
                    className="w-full flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-white text-sm">{product.product_name}</span>
                    <span className="text-amber-400 text-sm font-mono">
                      {product.total_available} left
                    </span>
                  </button>
                ))}
                {products.length > 5 && (
                  <p className="text-center text-xs text-slate-400 pt-1">
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
      className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-amber-400 font-semibold mb-1">Low Stock Alert</h3>
          <p className="text-amber-400/70 text-sm mb-3">
            The following products are running low on inventory:
          </p>
          <div className="flex flex-wrap gap-2">
            {products.map((product) => (
              <button
                key={product.product_id}
                onClick={() => onProductClick?.(product.product_id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors group"
              >
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-white text-sm group-hover:text-emerald-400 transition-colors">
                  {product.product_name}
                </span>
                <span className="text-slate-400 text-xs">
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
