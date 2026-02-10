
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackInStockAlert } from '../src/hooks/useSupabase';
import { useAuth } from '../src/hooks/useAuth';

interface ProductCardProps {
  id: string;
  image: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  onAddToCart: (quantity: number) => void;
  onClick?: () => void;
  compareAtPrice?: number | null;
  saleBadge?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  // Favorites support - when provided, these override localStorage behavior
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string) => void;
  // Auth requirement - when true, requires login to favorite
  requireLoginToFavorite?: boolean;
  onRequireLogin?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  image,
  name,
  price,
  category,
  inStock,
  onAddToCart,
  onClick,
  compareAtPrice,
  saleBadge,
  shortDescription,
  description,
  isFavorited,
  onToggleFavorite,
  requireLoginToFavorite = false,
  onRequireLogin,
}) => {
  // Product is on sale when compare_at_price exists and is greater than current price
  const isOnSale = typeof compareAtPrice === 'number' && compareAtPrice > price;
  const percentOff = isOnSale ? Math.round((1 - price / compareAtPrice!) * 100) : 0;
  const [quantity, setQuantity] = useState(1);

  // Back-in-stock notification state
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const { subscribe, loading: notifyLoading, error: notifyError, success: notifySuccess, reset: resetNotify } = useBackInStockAlert();
  const { user } = useAuth();

  // Use prop value if provided, default to not favorited
  const isWishlisted = isFavorited ?? false;

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Require login to favorite
    if (!user) {
      onRequireLogin?.();
      return;
    }

    // Use callback from parent (handles DB persistence)
    if (onToggleFavorite) {
      onToggleFavorite(id);
      return;
    }
  };

  const incrementQty = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantity(prev => prev + 1);
  };

  const decrementQty = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantity(prev => Math.max(1, prev - 1));
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleNotifySubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!notifyEmail || !notifyEmail.includes('@')) return;
    await subscribe({ productId: id, email: notifyEmail });
  };

  const handleNotifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Pre-fill email if user is logged in
    if (user?.email) {
      setNotifyEmail(user.email);
    }
    setShowNotifyForm(true);
    resetNotify();
  };

  const handleNotifyCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNotifyForm(false);
    setNotifyEmail('');
    resetNotify();
  };

  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(var(--brand-primary-rgb), 0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative bg-white rounded-[2.5rem] p-5 border border-gray-100 shadow-sm transition-colors flex flex-col h-full cursor-pointer"
      style={{ ['--hover-border' as string]: 'rgba(var(--brand-primary-rgb), 0.2)' }}
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 bg-gray-50">
        <motion.img 
          src={image} 
          alt={name}
          className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${!inStock ? 'grayscale opacity-60' : ''}`}
        />
        
        {/* Wishlist Button - Appears on hover */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-900 shadow-lg border border-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onClick={toggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill={isWishlisted ? "#EC4899" : "none"} 
            stroke={isWishlisted ? "#EC4899" : "currentColor"} 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transition-colors duration-300"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </motion.button>

        {/* Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-wider rounded-xl shadow-sm border border-white/50">
            {category}
          </span>
          {isOnSale && (
            <span className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-200">
              {saleBadge || 'On Sale!'}
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col px-1">
        <div className="flex justify-between items-start mb-2 gap-4">
          <h3 className="font-heading font-extrabold text-xl text-gray-900 leading-tight transition-colors group-hover:brand-text" style={{ ['--group-hover-color' as string]: 'var(--brand-primary)' }}>
            {name}
          </h3>
          <div className="flex flex-col items-end text-right leading-tight">
            {isOnSale ? (
              <>
                <span className="text-xl font-semibold text-gray-400 line-through tracking-tight">
                  ${compareAtPrice!.toFixed(2)}
                </span>
                <span className="text-xl font-black text-red-500">
                  ${price.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-xl font-black brand-text">
                ${price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        
        {(shortDescription || description) && (
          <p className="text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed font-medium">
            {shortDescription || description}
          </p>
        )}

        {/* Action Controls */}
        <div className="mt-auto space-y-3">
          {inStock && (
            <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100">
              <button
                onClick={decrementQty}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 transition-colors font-black border border-gray-100 active:scale-90"
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                -
              </button>
              <span className="flex-1 text-center text-sm font-black text-gray-900">
                {quantity}
              </span>
              <button
                onClick={incrementQty}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 transition-colors font-black border border-gray-100 active:scale-90"
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                +
              </button>
            </div>
          )}

          {inStock ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.01 }}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(quantity);
                setQuantity(1); // Reset after adding
              }}
              className="w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-gray-900 text-white shadow-lg shadow-gray-100 btn-brand-hover"
            >
              Add {quantity > 1 ? quantity : ''} to Cart
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            </motion.button>
          ) : (
            <AnimatePresence mode="wait">
              {notifySuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    We'll notify you!
                  </div>
                </motion.div>
              ) : showNotifyForm ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 px-4 py-3 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleNotifyCancel}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNotifySubmit}
                      disabled={notifyLoading || !notifyEmail.includes('@')}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {notifyLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Notify Me'
                      )}
                    </button>
                  </div>
                  {notifyError && (
                    <p className="text-xs text-red-500 text-center">{notifyError}</p>
                  )}
                </motion.div>
              ) : (
                <motion.button
                  key="notify-btn"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={handleNotifyClick}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notify When Available
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
