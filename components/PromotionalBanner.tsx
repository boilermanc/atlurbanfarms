import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHomepageBanners } from '../src/hooks/usePromotions';
import { X, Clock, Copy, Check } from 'lucide-react';

const PromotionalBanner: React.FC = () => {
  const { banners, loading } = useHomepageBanners();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Don't render anything while loading or if no banners
  if (loading || banners.length === 0) return null;

  // Filter out dismissed banners
  const activeBanners = banners.filter((b) => !dismissed.has(b.promotion_id));
  if (activeBanners.length === 0) return null;

  // Show the first (highest priority) banner
  const banner = activeBanners[0];

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDismiss = (e: React.MouseEvent, promotionId: string) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(promotionId));
  };

  const formatTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 7) return null; // Only show countdown for promotions ending within a week
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (remainingHours > 0) return `${remainingHours} hour${remainingHours > 1 ? 's' : ''} left`;
    return 'Ending soon';
  };

  const timeRemaining = banner.ends_at ? formatTimeRemaining(banner.ends_at) : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative overflow-hidden"
        style={{ backgroundColor: banner.banner_bg_color }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-4 flex-wrap">
          {/* Banner Text */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm md:text-base font-bold text-center"
            style={{ color: banner.banner_text_color }}
          >
            {banner.banner_text}
          </motion.p>

          {/* Coupon Code */}
          {banner.code && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={(e) => handleCopyCode(e, banner.code!)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Click to copy code"
            >
              <code
                className="text-xs md:text-sm font-mono font-bold tracking-wider"
                style={{ color: banner.banner_text_color }}
              >
                {banner.code}
              </code>
              {copiedCode === banner.code ? (
                <Check size={14} style={{ color: banner.banner_text_color }} />
              ) : (
                <Copy size={14} style={{ color: banner.banner_text_color }} />
              )}
            </motion.button>
          )}

          {/* Time Remaining */}
          {timeRemaining && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="hidden sm:flex items-center gap-1.5 text-xs md:text-sm font-medium opacity-80"
              style={{ color: banner.banner_text_color }}
            >
              <Clock size={14} />
              <span>{timeRemaining}</span>
            </motion.div>
          )}

          {/* Dismiss Button */}
          <button
            onClick={(e) => handleDismiss(e, banner.promotion_id)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss banner"
          >
            <X size={16} style={{ color: banner.banner_text_color }} />
          </button>
        </div>

        {/* Copied Toast */}
        <AnimatePresence>
          {copiedCode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg z-50"
            >
              Code copied!
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default PromotionalBanner;
