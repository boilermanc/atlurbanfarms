
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { usePageContent } from '../src/hooks/useSiteContent';

interface Review {
  name: string;
  image: string;
  growing_system: string;
  text: string;
}

const CustomerReviews: React.FC = () => {
  const { getSection } = usePageContent('home');
  const content = getSection('reviews');

  // Build reviews array from CMS content, filtering out empty entries
  const reviews: Review[] = [];
  for (let i = 1; i <= 6; i++) {
    const name = content[`review_${i}_name`];
    const text = content[`review_${i}_text`];
    if (name && text) {
      reviews.push({
        name,
        image: content[`review_${i}_image`] || '',
        growing_system: content[`review_${i}_growing_system`] || '',
        text,
      });
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duplicate reviews for seamless infinite loop
  const isInfinite = reviews.length > 1;
  const displayReviews = isInfinite ? [...reviews, ...reviews] : reviews;

  // Get scroll width of one full set of original cards
  const getOneSetWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !isInfinite) return 0;
    const cardWidth = el.querySelector('[data-review-card]')?.clientWidth || 340;
    const gap = 24;
    return reviews.length * (cardWidth + gap);
  }, [reviews.length, isInfinite]);

  // Reset scroll position when past the first set (seamless wrap)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isInfinite) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const setWidth = getOneSetWidth();
        if (setWidth > 0 && el.scrollLeft >= setWidth) {
          el.scrollLeft -= setWidth;
        }
      }, 150);
    };

    el.addEventListener('scroll', handleScrollEnd, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScrollEnd);
      clearTimeout(scrollTimeout);
    };
  }, [isInfinite, getOneSetWidth]);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (!isInfinite) return;

    autoScrollRef.current = setInterval(() => {
      if (isPaused) return;
      const el = scrollRef.current;
      if (!el) return;

      const cardWidth = el.querySelector('[data-review-card]')?.clientWidth || 340;
      const gap = 24;
      el.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
    }, 4000);

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [isPaused, isInfinite]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-review-card]')?.clientWidth || 340;
    const gap = 24;
    const scrollAmount = cardWidth + gap;

    if (direction === 'left' && isInfinite && el.scrollLeft < scrollAmount) {
      // Near the start: jump forward by one set, then smooth-scroll left
      el.scrollLeft += getOneSetWidth();
      requestAnimationFrame(() => {
        el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      });
    } else {
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  // Get initials from name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (reviews.length === 0) return null;

  const heading = content.heading || 'What People Are Saying';
  const subheading = content.subheading || 'Real reviews from our growing community of urban gardeners.';

  return (
    <section className="py-16 px-4 md:px-12 bg-amber-50 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="brand-text font-black uppercase tracking-[0.2em] text-[20px] mb-4 block"
          >
            Customer Reviews
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-heading font-extrabold text-gray-900 tracking-tight mb-4"
          >
            {heading}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 max-w-2xl mx-auto"
          >
            {subheading}
          </motion.p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Left Arrow */}
          {isInfinite && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-gray-200"
              aria-label="Scroll left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* Right Arrow */}
          {isInfinite && (
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-gray-200"
              aria-label="Scroll right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Scrollable Container */}
          <div
            ref={scrollRef}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            className="flex gap-6 overflow-x-auto scroll-smooth pb-4 -mx-4 md:mx-0 snap-x snap-mandatory md:snap-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <style>{`[data-reviews-scroll]::-webkit-scrollbar { display: none; }`}</style>
            {/* Spacer for left padding inside scroll container (padding gets eaten by overflow) */}
            <div className="flex-shrink-0 w-4 md:w-0" aria-hidden="true" />
            {displayReviews.map((review, index) => (
              <motion.div
                key={index}
                data-review-card
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index % reviews.length) * 0.1 }}
                className="flex-shrink-0 w-[300px] md:w-[360px] bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow snap-center"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Review Text */}
                <div className="mb-6 min-h-[60px]">
                  <span className="text-3xl leading-none text-emerald-300 font-serif">{'\u201C'}</span>
                  <div
                    className="text-gray-600 leading-relaxed text-sm mt-1 [&>p]:inline"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(review.text) }}
                  />
                </div>

                {/* Customer Info */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  {review.image ? (
                    <img
                      src={review.image}
                      alt={review.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        // On image error, hide the img and show initials instead
                        (e.target as HTMLImageElement).style.display = 'none';
                        const next = (e.target as HTMLImageElement).nextElementSibling;
                        if (next) (next as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm items-center justify-center ${review.image ? 'hidden' : 'flex'}`}
                  >
                    {getInitials(review.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.name}</p>
                    <p className="text-xs text-gray-400">{review.growing_system ? `Growing System: ${review.growing_system}` : 'Verified Customer'}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            {/* Spacer for right padding inside scroll container */}
            <div className="flex-shrink-0 w-4 md:w-0" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomerReviews;
