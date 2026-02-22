
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { supabase } from '../src/lib/supabase';
import { useBrandingSettings } from '../src/hooks/useSupabase';
import { usePageContent } from '../src/hooks/useSiteContent';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
}

interface FAQCategory {
  category: string;
  questions: { q: string; a: string }[];
}

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className={`text-lg font-bold transition-colors ${isOpen ? 'text-emerald-600' : 'text-gray-900 group-hover:text-emerald-600'}`}>
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="text-gray-500 pb-8 leading-relaxed max-w-3xl [&_a]:text-emerald-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-gray-700 [&_p]:mb-2 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(answer) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface FAQPageProps {
  onBack: () => void;
  onOpenSage?: () => void;
}

// Convert category name to URL-friendly ID (e.g., "Shipping & Delivery" -> "shipping-delivery")
const categoryToId = (category: string): string => {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// Strip HTML tags to get plain text for search matching
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const FAQPage: React.FC<FAQPageProps> = ({ onBack, onOpenSage }) => {
  const [faqData, setFaqData] = useState<FAQCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { settings: brandingSettings } = useBrandingSettings();
  const { getSection } = usePageContent('faq');

  // Get CMS content for header
  const headerContent = getSection('header');
  const ctaContent = getSection('cta');

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const { data, error } = await supabase
          .from('faqs')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        // Group FAQs by category
        const faqs = data as FAQ[];
        const grouped: Record<string, { q: string; a: string }[]> = {};

        for (const faq of faqs) {
          const category = faq.category || 'General';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push({ q: faq.question, a: faq.answer });
        }

        // Convert to array format
        const categories: FAQCategory[] = Object.entries(grouped).map(([category, questions]) => ({
          category,
          questions,
        }));

        setFaqData(categories);
      } catch (err) {
        console.error('Error fetching FAQs:', err);
        setError('Unable to load FAQs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  const handleAskSage = () => {
    if (onOpenSage) {
      onOpenSage();
    } else {
      // Dispatch custom event to open Sage
      window.dispatchEvent(new CustomEvent('openSage'));
    }
  };

  // Extract all unique category names
  const allCategories = faqData.map(section => section.category);

  // Filter FAQ data based on search query and selected category
  const filteredFaqData = faqData
    .filter(section => !selectedCategory || section.category === selectedCategory)
    .map(section => {
      if (!searchQuery.trim()) return section;
      const query = searchQuery.toLowerCase();
      const filteredQuestions = section.questions.filter(item =>
        item.q.toLowerCase().includes(query) ||
        stripHtml(item.a).toLowerCase().includes(query)
      );
      return { ...section, questions: filteredQuestions };
    })
    .filter(section => section.questions.length > 0);

  const hasNoResults = !loading && !error && faqData.length > 0 && filteredFaqData.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen pt-36 pb-16 bg-site">
        <div className="max-w-4xl mx-auto px-4 md:px-12 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading FAQs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-36 pb-16 bg-site">
        <div className="max-w-4xl mx-auto px-4 md:px-12 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 pb-20 bg-site">
      <div className="max-w-4xl mx-auto px-4 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
            {headerContent.tagline || 'How can we help?'}
          </span>
          <h1
            className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-6"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(headerContent.headline || 'Help <span class="text-emerald-600">Center</span>') }}
          />
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {headerContent.description || 'Everything you need to know about our seedlings, our shipping process, and our high-tech growing mission.'}
          </p>
        </motion.div>

        {/* Search & Category Filters */}
        {faqData.length > 0 && (
          <div className="mb-10 space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs..."
                className="w-full pl-12 pr-10 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                  !selectedCategory
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {allCategories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                    selectedCategory === category
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {faqData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No FAQs available at the moment.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {hasNoResults ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-gray-500 text-lg">No FAQs found matching your search.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                  className="mt-4 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredFaqData.map((section, idx) => (
                <motion.div
                  key={section.category}
                  id={categoryToId(section.category)}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <h2 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-8 flex items-center gap-4">
                    {section.category}
                    <div className="h-px bg-emerald-100 flex-1" />
                  </h2>
                  <div className="bg-white rounded-[2rem] border border-gray-100 px-8 shadow-sm">
                    {section.questions.map((item: { q: string; a: string }, qIdx: number) => (
                      <FAQItem key={qIdx} question={item.q} answer={item.a} />
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Still Have Questions? */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-12 p-8 rounded-[3rem] text-white text-center relative overflow-hidden"
          style={{ backgroundColor: brandingSettings.secondary_brand_color || '#047857' }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          <h2 className="text-4xl md:text-5xl font-heading font-extrabold mb-4 relative z-10">Still have questions?</h2>
          <p className="text-white/90 mb-8 relative z-10 font-medium">Sage AI is available 24/7 to answer your specific growing questions.</p>
          <button
            onClick={handleAskSage}
            className="px-10 py-5 bg-white text-emerald-700 rounded-2xl font-bold hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all shadow-xl relative z-10 flex items-center gap-3 mx-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              <path d="M19 3v4"/>
              <path d="M21 5h-4"/>
            </svg>
            Ask Sage
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQPage;
