
import React from 'react';
import { motion } from 'framer-motion';
import { useCategories } from '../src/hooks/useSupabase';

// Icon and style mapping for known categories
const categoryStyles: Record<string, { icon: React.ReactNode; description: string; color: string }> = {
  'Herbs': {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12M12 12C12 12 16 8 20 8M12 12C12 12 8 8 4 8M12 12C12 12 16 16 16 20M12 12C12 12 8 16 8 20" />
      </svg>
    ),
    description: 'Aromatic & Essential',
    color: 'emerald'
  },
  'Lettuce & Greens': {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20a7 7 0 0 1-7-7c0-3.87 3.13-7 7-7s7 3.13 7 7a7 7 0 0 1-7 7Z" />
        <path d="M9.1 9.1c.9-1.3 2.6-2.1 4.4-2.1" />
        <path d="M6.3 11.8c.8 1.2 2.1 2 3.7 2" />
      </svg>
    ),
    description: 'Crisp & Nutrient Dense',
    color: 'emerald'
  },
  'Vegetables': {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    ),
    description: 'High-Yield Crops',
    color: 'emerald'
  },
  'Flowers': {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 16.5A4.5 4.5 0 1 0 7.5 12c0 .5.1.9.3 1.3" />
        <path d="M12 7.5A4.5 4.5 0 1 1 16.5 12c0-.5-.1-.9-.3-1.3" />
        <path d="M12 12v9" />
        <path d="M11 18l1 1 1-1" />
      </svg>
    ),
    description: 'Edible & Ornamental',
    color: 'purple'
  }
};

// Default style for categories not in the mapping
const defaultStyle = {
  icon: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  description: 'Fresh & Local',
  color: 'emerald'
};

interface CategorySectionProps {
  onCategoryClick: (category: string) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({ onCategoryClick }) => {
  const { categories: dbCategories, loading } = useCategories();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  // Find the Seedlings parent category
  const seedlingsParent = dbCategories?.find((c: any) =>
    c.name.toLowerCase() === 'seedlings' && !c.parent_id
  );

  // Get seedling subcategories, or fall back to all subcategories (those with a parent),
  // or finally all categories if no hierarchy exists yet
  const seedlingCategories = (() => {
    if (seedlingsParent) {
      // Ideal case: show children of the "Seedlings" parent
      return dbCategories?.filter((c: any) => c.parent_id === seedlingsParent.id) || [];
    }
    // Fallback: show categories that have a parent (i.e., subcategories)
    const subcategories = dbCategories?.filter((c: any) => c.parent_id) || [];
    if (subcategories.length > 0) return subcategories;
    // Final fallback: show all active categories
    return dbCategories || [];
  })();

  // Don't render section if no categories at all
  if (loading || seedlingCategories.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4 md:px-12 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">Explore Categories</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-5xl font-heading font-extrabold text-gray-900 tracking-tight">Shop by <span className="sage-text-gradient">Garden Type</span></motion.h2>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className={`grid grid-cols-2 gap-6 ${seedlingCategories.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
        >
          {seedlingCategories.map((cat: any) => {
            const style = categoryStyles[cat.name] || defaultStyle;
            return (
              <motion.div
                key={cat.id}
                onClick={() => onCategoryClick(cat.name)}
                variants={itemVariants}
                whileHover="hover"
                className="cursor-pointer group relative p-8 rounded-[2.5rem] bg-gray-50 border border-transparent hover:border-emerald-100 hover:bg-emerald-50/50 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
              >
                {cat.image_url ? (
                  <div className="w-full h-48 rounded-[1.5rem] overflow-hidden mb-6 group-hover:shadow-lg group-hover:shadow-emerald-100/50 transition-all">
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-[1.5rem] bg-white shadow-sm flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-emerald-100/50 transition-all">
                    <div className={style.color === 'purple' ? 'text-purple-500' : 'text-emerald-500'}>{style.icon}</div>
                  </div>
                )}
                <h3 className="font-heading font-extrabold text-lg text-gray-900 mb-1 tracking-tight">{cat.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[70%]">{cat.description || style.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default CategorySection;
