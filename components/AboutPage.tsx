
import React from 'react';
import { motion } from 'framer-motion';
import { SparkleIcon } from '../constants';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    visible: { transition: { staggerChildren: 0.2 } }
  };

  return (
    <div className="min-h-screen pt-40 pb-20 bg-white selection:bg-purple-100 selection:text-purple-900">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-32">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.span variants={fadeIn} className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">About Us</motion.span>
          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-heading font-black text-gray-900 mb-8 leading-[1.1]">
            Growing the Future of Food, <span className="sage-text-gradient">Right Here in Atlanta.</span>
          </motion.h1>
          <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed mb-12">
            ATL Urban Farms isn't just a nursery. We are a technology company dedicated to shortening the distance between the farm and your fork.
          </motion.p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative rounded-[3rem] overflow-hidden aspect-[21/9] shadow-2xl border-8 border-white"
        >
          <img src="https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=1600" alt="Inside our high-tech nursery" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white">
            <p className="text-sm font-black uppercase tracking-widest mb-2">Facility 01 // Atlanta, GA</p>
            <h3 className="text-2xl font-bold">Climate-Controlled Nursery Operations</h3>
          </div>
        </motion.div>
      </section>

      {/* Our Story Section */}
      <section id="story" className="py-24 px-4 md:px-12 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
             <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 sage-gradient rounded-[3.5rem] blur-2xl opacity-10" />
              <img src="https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&q=80&w=800" alt="Founding journey" className="relative rounded-[3rem] shadow-2xl border-4 border-white aspect-[4/5] object-cover" />
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-w-[200px]">
                <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Established</p>
                <p className="text-2xl font-black text-gray-900">2018</p>
                <p className="text-xs text-gray-400 font-medium">From a garage in Old Fourth Ward to the city's tech-hub.</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-purple-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">The Genesis</span>
              <h2 className="text-4xl md:text-5xl font-heading font-black text-gray-900 mb-8 leading-tight">
                A Story of <span className="sage-text-gradient">Roots & Algorithms.</span>
              </h2>
              <div className="space-y-6 text-gray-500 text-lg leading-relaxed">
                <p>
                  ATL Urban Farms began with a simple question: <span className="text-gray-900 font-bold italic">"Why does 'fresh' produce at the grocery store already look tired?"</span>
                </p>
                <p>
                  In 2018, we started experimenting with vertical growing systems in a small garage in Atlanta's Old Fourth Ward. We realized that by combining horticultural expertise with real-time sensor data and climate control, we could produce seedlings with vitality levels far beyond traditional nurseries.
                </p>
                <p>
                  Today, we operate a 15,000 sq. ft. high-tech nursery facility. We've replaced guesswork with precision algorithms, ensuring that every plant that leaves our floor is "Nursery Intelligence" certified.
                </p>
              </div>
              
              <div className="mt-12 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-100">
                  <img src="https://i.pravatar.cc/150?u=founder" alt="Founder" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Marcus Sterling</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Founder & Chief Grower</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Difference Section */}
      <section className="py-24 bg-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-heading font-black text-gray-900 mb-8 leading-tight">
                Why <span className="text-emerald-600">Nursery-Grown</span> Seedlings Matter.
              </h2>
              <div className="space-y-8">
                {[
                  { title: "Skip the Struggle", desc: "Starting from seed is hard. We do the difficult first 4-6 weeks for you in a perfect environment." },
                  { title: "Nutrient Mapping", desc: "Our seedlings are fed a proprietary mix of organic nutrients at precisely the right stages of growth." },
                  { title: "Arrives Alive Tech", desc: "Our Mon-Wed shipping schedule and custom-engineered packaging ensure your plants never 'sit' over the weekend." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0 text-emerald-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 sage-gradient rounded-[3.5rem] blur-2xl opacity-10 animate-pulse" />
              <img src="https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800" alt="Perfect seedling" className="relative rounded-[3rem] shadow-2xl border-4 border-white" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tech Grid */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-heading font-black text-gray-900">The Technology Behind the <span className="sage-text-gradient">Green</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Climate AI", desc: "Our nursery adjusts light spectrums and humidity in real-time using localized sensor data.", icon: <SparkleIcon className="w-6 h-6" /> },
              { title: "Sustainable Roots", desc: "We use 85% less water than traditional soil-based nurseries through advanced recirculation.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> },
              { title: "School Support", desc: "Our 'Education First' dashboard helps teachers track seedling growth in the classroom.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> }
            ].map((tech, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="p-10 bg-gray-50 rounded-[2.5rem] border border-gray-100 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-purple-600">
                  {tech.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{tech.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="px-4 md:px-12 pb-32">
        <div className="max-w-7xl mx-auto bg-gray-900 rounded-[4rem] p-12 md:p-24 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/leaf.png')] opacity-5 pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2 className="text-4xl md:text-6xl font-heading font-black text-white mb-8">Ready to grow <span className="text-emerald-400">smarter?</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 font-medium">
              Join thousands of Atlanta residents and schools who are bringing their gardens into the future.
            </p>
            <button 
              onClick={() => onBack()}
              className="px-12 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-900/40"
            >
              Start Your Urban Farm
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
