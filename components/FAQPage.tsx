
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ_DATA = [
  {
    category: "Shipping & Delivery",
    questions: [
      {
        q: "Why do you only ship Monday through Wednesday?",
        a: "To ensure your live seedlings don't spend the weekend in a shipping warehouse! By shipping early in the week, we guarantee they arrive at your doorstep in peak health, ready for transplanting."
      },
      {
        q: "How are the plants packaged?",
        a: "We use high-tech, 100% recyclable plant-secure inserts that keep the root ball hydrated and the foliage protected from impact during transit."
      },
      {
        q: "Do you ship nationwide?",
        a: "Currently, we ship to most states in the Southeast and East Coast to minimize transit time. Check your zip code at checkout for availability."
      }
    ]
  },
  {
    category: "Growing & Care",
    questions: [
      {
        q: "What is a 'seedling' versus a 'seed'?",
        a: "A seedling is a young plant that has already germinated and grown for several weeks. When you buy from us, you're skipping the difficult 'start' phase and getting a plant ready for your garden or Tower Garden."
      },
      {
        q: "Are your plants organic?",
        a: "We follow strict non-GMO and sustainable growing practices. While we are not 'certified organic' yet, we use climate-controlled nursery environments that eliminate the need for harsh pesticides."
      },
      {
        q: "What if my plant arrives damaged?",
        a: "Our 'Arrives Alive' guarantee has you covered. If a seedling is damaged during transit, simply snap a photo and contact Sage or our support team within 24 hours for a replacement."
      }
    ]
  },
  {
    category: "Sage AI Assistant",
    questions: [
      {
        q: "What can Sage help me with?",
        a: "Sage is our nursery-trained AI. She can recommend plants based on your local climate, help diagnose common growing issues, and explain our unique nursery technology."
      },
      {
        q: "Is Sage a real person?",
        a: "Sage is a high-tech AI model trained on years of ATL Urban Farms horticultural data. For complex order issues, she can also connect you with our human growing team."
      }
    ]
  }
];

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
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
            <p className="text-gray-500 pb-8 leading-relaxed max-w-3xl">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface FAQPageProps {
  onBack: () => void;
}

const FAQPage: React.FC<FAQPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen pt-40 pb-32 bg-white">
      <div className="max-w-4xl mx-auto px-4 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <span className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">How can we help?</span>
          <h1 className="text-4xl md:text-6xl font-heading font-black text-gray-900 mb-6">
            Frequently Asked <span className="text-emerald-600">Questions</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Everything you need to know about our seedlings, our shipping process, and our high-tech growing mission.
          </p>
        </motion.div>

        <div className="space-y-16">
          {FAQ_DATA.map((section, idx) => (
            <motion.div
              key={section.category}
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
                {section.questions.map((item, qIdx) => (
                  <FAQItem key={qIdx} question={item.q} answer={item.a} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Still Have Questions? */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-24 p-12 sage-gradient rounded-[3rem] text-white text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <h2 className="text-3xl font-heading font-extrabold mb-4 relative z-10">Still have questions?</h2>
          <p className="text-white/80 mb-8 relative z-10 font-medium">Sage AI is available 24/7 to answer your specific growing questions.</p>
          <button 
            onClick={() => onBack()}
            className="px-10 py-5 bg-white text-gray-900 rounded-2xl font-bold hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all shadow-xl relative z-10"
          >
            Go Back Home
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQPage;
