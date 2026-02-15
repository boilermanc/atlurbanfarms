import React from 'react';
import { motion } from 'framer-motion';
import { usePageContent } from '../src/hooks/useSiteContent';

interface MissionSectionProps {
  onNavigate: (view: string) => void;
}

const MissionSection: React.FC<MissionSectionProps> = ({ onNavigate }) => {
  const { get } = usePageContent('home');

  const heading = get('mission', 'mission_heading');
  const description = get('mission', 'mission_description');
  const buttonText = get('mission', 'mission_button_text');
  const buttonLink = get('mission', 'mission_button_link');

  if (!heading && !description) return null;

  return (
    <section className="py-14 px-4 md:px-12 bg-site border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-10 bg-white rounded-[3rem] border border-emerald-50 shadow-2xl shadow-emerald-100/20 flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />

          <div className="max-w-2xl">
            <h3 className="text-7xl md:text-9xl font-heading font-extrabold text-gray-900 mb-4">
              {heading}
            </h3>
            <p
              className="text-gray-500 font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                const route = (buttonLink || '/about').replace('/', '') || 'about';
                onNavigate(route);
              }}
              className="px-10 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-bold hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-100 whitespace-nowrap"
            >
              {buttonText || 'Learn More'}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MissionSection;
