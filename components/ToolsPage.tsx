import React from 'react';
import { motion } from 'framer-motion';

interface ToolsPageProps {
  onBack: () => void;
}

const TOOLS = [
  {
    name: 'Tower Planner',
    description: 'Plan your aeroponic tower layout with our interactive tool. Choose your plants, visualize placement, and get growing tips.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </svg>
    ),
    status: 'coming-soon' as const,
  },
  {
    name: 'Planting Calendar',
    description: 'Find the best times to start seeds and transplant seedlings based on your USDA hardiness zone.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    status: 'coming-soon' as const,
  },
  {
    name: 'Nutrient Calculator',
    description: 'Calculate the right nutrient mix for your aeroponic system based on plant type and growth stage.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 7h6m-6 4h6m-3-8v12m-7 4h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    status: 'coming-soon' as const,
  },
  {
    name: 'Sproutify Farm App',
    description: 'Manage your aeroponic garden with our companion app. Track growth, set watering schedules, and monitor plant health.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    url: 'https://farm.sproutify.app',
    status: 'available' as const,
  },
];

const ToolsPage: React.FC<ToolsPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-site">
      <div className="pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest brand-text brand-bg-light mb-4">
              Tools & Apps
            </span>
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-4">
              Tools for Your Garden
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Apps and tools for your aeroponic garden. Plan, grow, and thrive with our suite of gardening tools.
            </p>
          </motion.div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TOOLS.map((tool, index) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl brand-bg-light brand-text flex items-center justify-center">
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{tool.name}</h3>
                        {tool.status === 'coming-soon' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                      {tool.status === 'available' && tool.url && (
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-semibold text-white rounded-lg btn-brand transition-colors"
                        >
                          Open App
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
