
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useBackInStockAlert } from '../src/hooks/useSupabase';
import { useAuth } from '../src/hooks/useAuth';

// Sanitize HTML content from the rich text editor
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
};

// Raw Supabase product type with all possible fields
interface RawProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  compare_at_price?: number | null;
  quantity_available?: number;
  growing_instructions?: string;
  days_to_maturity?: number;
  sun_requirements?: string;
  water_requirements?: string;
  // New growing info fields
  yield_per_plant?: number | null;
  harvest_type?: string[] | null;
  growing_season?: string[] | null;
  growing_location?: string | null;
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
    sort_order?: number;
    is_primary?: boolean;
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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Back-in-stock notification state
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const { subscribe, loading: notifyLoading, error: notifyError, success: notifySuccess, reset: resetNotify } = useBackInStockAlert();
  const { user } = useAuth();

  // Reset quantity, notify form, and selected image when modal opens with new product
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedImageIndex(0);
      setShowNotifyForm(false);
      setNotifyEmail('');
      resetNotify();
    }
  }, [isOpen, product?.id, resetNotify]);

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

  // Build sorted images array - prioritize primary, then sort by sort_order
  const allImages = (() => {
    const images = product.images || [];
    // Sort by sort_order, with primary images first
    const sorted = [...images].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order ?? 999) - (b.sort_order ?? 999);
    });
    // If no images, use primary_image or placeholder
    if (sorted.length === 0 && product.primary_image) {
      return [{ url: product.primary_image.url, alt_text: product.primary_image.alt_text }];
    }
    return sorted.length > 0 ? sorted : [{ url: 'https://placehold.co/600x600?text=No+Image', alt_text: 'No image available' }];
  })();

  const currentImage = allImages[selectedImageIndex] || allImages[0];
  const imageUrl = currentImage?.url || 'https://placehold.co/600x600?text=No+Image';
  const categoryName = product.category?.name || 'Uncategorized';
  const inStock = (product.quantity_available || 0) > 0;
  const hasMultipleImages = allImages.length > 1;

  // Scroll thumbnails left/right
  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (thumbnailContainerRef.current) {
      const scrollAmount = 100;
      thumbnailContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Sale pricing logic
  const isOnSale = typeof product.compare_at_price === 'number' && product.compare_at_price > product.price;
  const percentOff = isOnSale ? Math.round((1 - product.price / product.compare_at_price!) * 100) : 0;

  const handleAddToCart = () => {
    onAddToCart(quantity);
    onClose();
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail || !notifyEmail.includes('@') || !product) return;
    await subscribe({ productId: product.id, email: notifyEmail });
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
                <div className="relative bg-gray-50 p-6 lg:p-12 flex flex-col items-center justify-start">
                  {/* Main Image */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative w-full max-w-lg aspect-square rounded-[2rem] overflow-hidden shadow-2xl shadow-gray-200/50"
                  >
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={imageUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        src={imageUrl}
                        alt={currentImage?.alt_text || product.name}
                        className={`w-full h-full object-cover ${!inStock ? 'grayscale opacity-70' : ''}`}
                      />
                    </AnimatePresence>

                    {/* Category Badge & Sale Badge */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      <span className="px-4 py-2 bg-white/95 backdrop-blur-md text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg border border-white/50">
                        {categoryName}
                      </span>
                      {isOnSale && (
                        <span className="px-4 py-2 bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg">
                          {percentOff > 0 ? `${percentOff}% Off` : 'On Sale'}
                        </span>
                      )}
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

                  {/* Thumbnail Gallery */}
                  {hasMultipleImages && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="relative w-full max-w-lg mt-4"
                    >
                      {/* Left Arrow */}
                      <button
                        onClick={() => scrollThumbnails('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
                        aria-label="Scroll thumbnails left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6" transform="scale(0.67) translate(0, 0)"/>
                        </svg>
                      </button>

                      {/* Thumbnails Container */}
                      <div
                        ref={thumbnailContainerRef}
                        className="flex gap-2 overflow-x-auto scrollbar-hide px-6 py-2 scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {allImages.map((img, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedImageIndex(index)}
                            className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                              selectedImageIndex === index
                                ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={img.alt_text || `${product.name} image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>

                      {/* Right Arrow */}
                      <button
                        onClick={() => scrollThumbnails('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
                        aria-label="Scroll thumbnails right"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" transform="scale(0.67) translate(0, 0)"/>
                        </svg>
                      </button>
                    </motion.div>
                  )}
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
                        {isOnSale ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-semibold text-gray-400 line-through">
                              ${product.compare_at_price!.toFixed(2)}
                            </span>
                            <span className="text-3xl font-black text-red-500">
                              ${product.price.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-3xl font-black text-emerald-600">
                            ${product.price.toFixed(2)}
                          </span>
                        )}
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
                        <div
                          className="product-description text-gray-600 leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-strong:font-bold prose-strong:text-gray-800 prose-em:italic prose-a:text-emerald-600 prose-a:underline prose-a:font-medium hover:prose-a:text-emerald-700 prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2 prose-li:my-1"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                        />
                      </div>
                    )}

                    {/* Growing Instructions */}
                    {product.growing_instructions && (
                      <div className="mb-8">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3">Growing Instructions</h3>
                        <div
                          className="product-description text-gray-600 leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-strong:font-bold prose-strong:text-gray-800 prose-em:italic prose-a:text-emerald-600 prose-a:underline prose-a:font-medium hover:prose-a:text-emerald-700 prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2 prose-li:my-1"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.growing_instructions) }}
                        />
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
                    </div>

                    {/* Growing Information Section */}
                    {(product.yield_per_plant || (product.harvest_type && product.harvest_type.length > 0) || (product.growing_season && product.growing_season.length > 0) || product.growing_location) && (
                      <div className="mb-8">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3">Growing Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {product.yield_per_plant && (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-lime-100 rounded-xl flex items-center justify-center text-lime-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Yield per Plant</span>
                              </div>
                              <p className="text-xl font-black text-gray-900">{product.yield_per_plant} oz</p>
                            </div>
                          )}

                          {product.harvest_type && product.harvest_type.length > 0 && (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Harvest Type</span>
                              </div>
                              <p className="text-lg font-black text-gray-900">
                                {product.harvest_type.map(type =>
                                  type === 'cut_and_come_again' ? 'Cut & Come Again' :
                                  type === 'full_head' ? 'Full Head' : type
                                ).join(', ')}
                              </p>
                            </div>
                          )}

                          {product.growing_season && product.growing_season.length > 0 && (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Growing Season</span>
                              </div>
                              <p className="text-lg font-black text-gray-900">
                                {product.growing_season.map(season =>
                                  season === 'year_round' ? 'Year-round' :
                                  season.charAt(0).toUpperCase() + season.slice(1)
                                ).join(', ')}
                              </p>
                            </div>
                          )}

                          {product.growing_location && (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                                  </svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Growing Location</span>
                              </div>
                              <p className="text-xl font-black text-gray-900">
                                {product.growing_location === 'indoor' ? 'Indoor' :
                                 product.growing_location === 'outdoor' ? 'Outdoor' :
                                 product.growing_location === 'both' ? 'Indoor & Outdoor' : product.growing_location}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
                          Total: <span className={`font-bold ${isOnSale ? 'text-red-500' : 'text-emerald-600'}`}>${(product.price * quantity).toFixed(2)}</span>
                        </span>
                      </div>
                    )}

                    {inStock ? (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={handleAddToCart}
                        className="w-full py-5 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-3 bg-gray-900 text-white hover:bg-emerald-600 shadow-xl shadow-gray-200 hover:shadow-emerald-200"
                      >
                        Add {quantity > 1 ? quantity : ''} to Cart
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                        </svg>
                      </motion.button>
                    ) : (
                      <AnimatePresence mode="wait">
                        {notifySuccess ? (
                          <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full py-5 px-6 rounded-2xl bg-emerald-50 border border-emerald-200"
                          >
                            <div className="flex items-center justify-center gap-3 text-emerald-700 font-bold text-base">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              We'll email you when it's back!
                            </div>
                            <p className="text-emerald-600/80 text-sm text-center mt-2">Check your inbox for confirmation.</p>
                          </motion.div>
                        ) : showNotifyForm ? (
                          <motion.form
                            key="form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onSubmit={handleNotifySubmit}
                            className="space-y-3"
                          >
                            <div className="flex gap-3">
                              <input
                                type="email"
                                value={notifyEmail}
                                onChange={(e) => setNotifyEmail(e.target.value)}
                                placeholder="Enter your email address"
                                className="flex-1 px-5 py-4 rounded-2xl text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                autoFocus
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNotifyForm(false);
                                  setNotifyEmail('');
                                  resetNotify();
                                }}
                                className="flex-1 py-4 rounded-2xl text-base font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={notifyLoading || !notifyEmail.includes('@')}
                                className="flex-1 py-4 rounded-2xl text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                              >
                                {notifyLoading ? (
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                    Notify Me
                                  </>
                                )}
                              </button>
                            </div>
                            {notifyError && (
                              <p className="text-sm text-red-500 text-center">{notifyError}</p>
                            )}
                          </motion.form>
                        ) : (
                          <motion.button
                            key="notify-btn"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => {
                              // Pre-fill email if user is logged in
                              if (user?.email) {
                                setNotifyEmail(user.email);
                              }
                              setShowNotifyForm(true);
                            }}
                            className="w-full py-5 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-3 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                            Notify Me When Available
                          </motion.button>
                        )}
                      </AnimatePresence>
                    )}
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
