import React from 'react';
import { motion } from 'framer-motion';
import { usePageContent } from '../src/hooks/useSiteContent';

interface SproutifySectionProps {
  onNavigate: (view: string) => void;
}

const SproutifySection: React.FC<SproutifySectionProps> = ({ onNavigate }) => {
  const { getSection } = usePageContent('home');
  const content = getSection('sproutify');

  // Only render if enabled
  if (content.sproutify_enabled !== 'enabled') return null;

  const heading = content.sproutify_heading || 'Sproutify Home';
  const description = content.sproutify_description || '';
  const image = content.sproutify_image || '';
  const buttonText = content.sproutify_button_text || 'Learn More';
  const buttonLink = content.sproutify_button_link || '/tools';

  const handleClick = () => {
    // If it's an internal route (starts with /), use navigate
    if (buttonLink.startsWith('/')) {
      const route = buttonLink.replace('/', '') || 'home';
      onNavigate(route);
    } else {
      window.open(buttonLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className="py-16 px-4 md:px-12 bg-site overflow-hidden relative border-b border-gray-200">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Image */}
        {image && (
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={image}
              alt={heading}
              className="rounded-3xl shadow-2xl relative z-10 w-full object-cover"
            />
            <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>
          </motion.div>
        )}

        {/* Content */}
        <motion.div
          className={!image ? 'md:col-span-2 max-w-2xl mx-auto text-center' : ''}
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
            Sproutify
          </span>
          <h2 className="text-7xl md:text-8xl font-heading font-extrabold text-gray-900 mb-6 leading-tight">
            {heading}
          </h2>
          {description && (
            <div
              className="text-lg text-gray-500 mb-8 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
          <button
            onClick={handleClick}
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-3 mx-auto md:mx-0"
          >
            {buttonText}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default SproutifySection;
