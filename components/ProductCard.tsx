
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductCardProps {
  id: string;
  image: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  onAddToCart: (quantity: number) => void;
  onClick?: () => void;
  salePrice?: number | null;
  saleBadge?: string | null;
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
  salePrice,
  saleBadge,
}) => {
  const derivedSalePrice = typeof salePrice === 'number' && salePrice < price ? salePrice : null;
  const isOnSale = derivedSalePrice !== null;
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Initialize wishlist state from localStorage
  useEffect(() => {
    const wishlist = JSON.parse(localStorage.getItem('atl_wishlist') || '[]');
    setIsWishlisted(wishlist.includes(id));
  }, [id]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const wishlist = JSON.parse(localStorage.getItem('atl_wishlist') || '[]');
    let newWishlist;
    
    if (isWishlisted) {
      newWishlist = wishlist.filter((itemId: string) => itemId !== id);
    } else {
      newWishlist = [...wishlist, id];
    }
    
    localStorage.setItem('atl_wishlist', JSON.stringify(newWishlist));
    setIsWishlisted(!isWishlisted);
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

  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(16, 185, 129, 0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative bg-white rounded-[2.5rem] p-5 border border-gray-100 shadow-sm transition-colors hover:border-emerald-100 flex flex-col h-full cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 bg-gray-50">
        <motion.img 
          src={image} 
          alt={name}
          className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${!inStock ? 'grayscale opacity-60' : ''}`}
        />
        
        {/* Out of Stock Prominent Overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px] flex items-center justify-center z-10 p-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/95 px-4 py-2 rounded-xl shadow-xl border border-white"
            >
              <span className="text-gray-900 text-xs font-black uppercase tracking-widest">Unavailable</span>
            </motion.div>
          </div>
        )}
        
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
              {saleBadge || 'On Sale'}
            </span>
          )}
          {!inStock && (
            <span className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-200">
              Out of Stock
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col px-1">
        <div className="flex justify-between items-start mb-2 gap-4">
          <h3 className="font-heading font-extrabold text-xl text-gray-900 leading-tight group-hover:text-emerald-600 transition-colors">
            {name}
          </h3>
          <div className="flex flex-col items-end text-right leading-tight">
            {isOnSale ? (
              <>
                <span className="text-sm font-semibold text-gray-400 line-through tracking-tight">
                  ${price.toFixed(2)}
                </span>
                <span className="text-2xl font-black text-red-500">
                  ${derivedSalePrice?.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-2xl font-black text-emerald-600">
                ${price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        
        <p className="text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed font-medium">
          Premium climate-controlled seedling, ready for immediate transplant into your {category.toLowerCase()} garden.
        </p>

        {/* Action Controls */}
        <div className="mt-auto space-y-3">
          {inStock && (
            <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100">
              <button 
                onClick={decrementQty}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 hover:text-emerald-600 transition-colors font-black border border-gray-100 active:scale-90"
              >
                -
              </button>
              <span className="flex-1 text-center text-sm font-black text-gray-900">
                {quantity}
              </span>
              <button 
                onClick={incrementQty}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-900 hover:text-emerald-600 transition-colors font-black border border-gray-100 active:scale-90"
              >
                +
              </button>
            </div>
          )}

          <motion.button
            whileTap={inStock ? { scale: 0.95 } : undefined}
            whileHover={inStock ? { scale: 1.01 } : undefined}
            disabled={!inStock}
            onClick={(e) => {
              e.stopPropagation();
              if (inStock) {
                onAddToCart(quantity);
                setQuantity(1); // Reset after adding
              }
            }}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              inStock 
                ? 'bg-gray-900 text-white hover:bg-emerald-600 shadow-lg shadow-gray-100 hover:shadow-emerald-200' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            {inStock ? (
              <>
                Add {quantity > 1 ? quantity : ''} to Cart
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              </>
            ) : (
              <span className="flex items-center gap-2">
                Out of Stock
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
