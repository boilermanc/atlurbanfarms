
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Raw Supabase product type with all possible fields
interface RawProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  quantity_available?: number;
  growing_instructions?: string;
  days_to_maturity?: number;
  sun_requirements?: string;
  water_requirements?: string;
  category?: {
    name: string;
  };
  primary_image?: {
    url: string;
    alt_text?: string;
  };
  images?: Array<{
    url: string;
    alt_text?: string;
  }>;
}

interface ProductDetailModalProps {
  product: RawProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (quantity: number) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart
}) => {
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when modal opens with new product
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen, product?.id]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!product) return null;

  const imageUrl = product.primary_image?.url || product.images?.[0]?.url || 'https://placehold.co/600x600?text=No+Image';
  const categoryName = product.category?.name || 'Uncategorized';
  const inStock = (product.quantity_available || 0) > 0;

  const handleAddToCart = () => {
    onAddToCart(quantity);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-[2.5rem] shadow-2xl z-[80] overflow-hidden flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all shadow-lg border border-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 min-h-full">
                {/* Image Section */}
                <div className="relative bg-gray-50 p-6 lg:p-12 flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative w-full max-w-lg aspect-square rounded-[2rem] overflow-hidden shadow-2xl shadow-gray-200/50"
                  >
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className={`w-full h-full object-cover ${!inStock ? 'grayscale opacity-70' : ''}`}
                    />

                    {/* Category Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-4 py-2 bg-white/95 backdrop-blur-md text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg border border-white/50">
                        {categoryName}
                      </span>
                    </div>

                    {/* Out of Stock Overlay */}
                    {!inStock && (
                      <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-xl border border-white">
                          <span className="text-gray-900 text-sm font-black uppercase tracking-widest">Out of Stock</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Details Section */}
                <div className="p-6 lg:p-12 flex flex-col">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="flex-1"
                  >
                    {/* Header */}
                    <div className="mb-6">
                      <h2 className="text-3xl lg:text-4xl font-heading font-extrabold text-gray-900 mb-2">
                        {product.name}
                      </h2>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-emerald-600">
                          ${product.price.toFixed(2)}
                        </span>
                        {inStock && (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl">
                            {product.quantity_available} in stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {product.description && (
                      <div className="mb-8">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3">Description</h3>
                        <p className="text-gray-600 leading-relaxed">{product.description}</p>
                      </div>
                    )}

                    {/* Growing Instructions */}
                    {product.growing_instructions && (
                      <div className="mb-8">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3">Growing Instructions</h3>
                        <p className="text-gray-600 leading-relaxed">{product.growing_instructions}</p>
                      </div>
                    )}

                    {/* Quick Facts Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {product.days_to_maturity && (
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                              </svg>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Days to Maturity</span>
                          </div>
                          <p className="text-xl font-black text-gray-900">{product.days_to_maturity} days</p>
                        </div>
                      )}

                      {product.sun_requirements && (
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                              </svg>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sun</span>
                          </div>
                          <p className="text-xl font-black text-gray-900">{product.sun_requirements}</p>
                        </div>
                      )}

                      {product.water_requirements && (
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
                              </svg>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Water</span>
                          </div>
                          <p className="text-xl font-black text-gray-900">{product.water_requirements}</p>
                        </div>
                      )}

                      {(product.quantity_available !== undefined && product.quantity_available > 0) && (
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
                              </svg>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Available</span>
                          </div>
                          <p className="text-xl font-black text-gray-900">{product.quantity_available} units</p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Action Section - Sticky at bottom */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="pt-6 border-t border-gray-100"
                  >
                    {inStock && (
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-sm font-bold text-gray-500">Quantity</span>
                        <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                          <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 hover:text-emerald-600 transition-colors font-black border border-gray-100 active:scale-90"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-sm font-black text-gray-900">
                            {quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(q => Math.min(product.quantity_available || 99, q + 1))}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 hover:text-emerald-600 transition-colors font-black border border-gray-100 active:scale-90"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm text-gray-400">
                          Total: <span className="font-bold text-emerald-600">${(product.price * quantity).toFixed(2)}</span>
                        </span>
                      </div>
                    )}

                    <motion.button
                      whileTap={inStock ? { scale: 0.98 } : undefined}
                      whileHover={inStock ? { scale: 1.01 } : undefined}
                      disabled={!inStock}
                      onClick={handleAddToCart}
                      className={`w-full py-5 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-3 ${
                        inStock
                          ? 'bg-gray-900 text-white hover:bg-emerald-600 shadow-xl shadow-gray-200 hover:shadow-emerald-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      }`}
                    >
                      {inStock ? (
                        <>
                          Add {quantity > 1 ? quantity : ''} to Cart
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                          </svg>
                        </>
                      ) : (
                        <span className="flex items-center gap-2">
                          Out of Stock
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                          </svg>
                        </span>
                      )}
                    </motion.button>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductDetailModal;
