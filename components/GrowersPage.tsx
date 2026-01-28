
import React from 'react';
import { motion } from 'framer-motion';
import { useGrowers } from '../src/hooks/useSupabase';

interface GrowersPageProps {
  onBack: () => void;
}

interface Grower {
  id: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  specialty: string;
  years_experience?: number;
}

// Placeholder growers data - will be replaced by Supabase data when available
const PLACEHOLDER_GROWERS: Grower[] = [
  {
    id: '1',
    name: 'Marcus Sterling',
    title: 'Founder & Chief Grower',
    bio: 'Marcus founded ATL Urban Farms in 2018 with a vision to revolutionize urban agriculture. With over 15 years of experience in horticulture and a background in agricultural technology, he leads our growing operations and innovation initiatives.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    specialty: 'Vertical Growing Systems',
    years_experience: 15,
  },
  {
    id: '2',
    name: 'Amara Johnson',
    title: 'Head of Herb Production',
    bio: 'Amara brings a lifetime of knowledge passed down through generations of farmers in her family. She specializes in aromatic herbs and has developed our signature herb growing protocols that maximize flavor and potency.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    specialty: 'Culinary & Medicinal Herbs',
    years_experience: 12,
  },
  {
    id: '3',
    name: 'David Chen',
    title: 'Climate Systems Engineer',
    bio: 'David oversees our climate control AI and sensor networks. His background in environmental engineering ensures our nursery maintains optimal growing conditions 24/7, resulting in healthier, more resilient seedlings.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
    specialty: 'Climate AI & Automation',
    years_experience: 8,
  },
  {
    id: '4',
    name: 'Sofia Rodriguez',
    title: 'Vegetable Cultivation Lead',
    bio: 'Sofia manages our vegetable seedling program with a focus on heirloom and specialty varieties. Her expertise in organic cultivation practices ensures every vegetable plant leaves our nursery ready to thrive.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    specialty: 'Heirloom Vegetables',
    years_experience: 10,
  },
  {
    id: '5',
    name: 'James Thompson',
    title: 'Education & Outreach Director',
    bio: 'James leads our School Seedling Program and community workshops. A former science teacher, he is passionate about connecting the next generation with the joy of growing their own food.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
    specialty: 'Agricultural Education',
    years_experience: 14,
  },
  {
    id: '6',
    name: 'Nina Okafor',
    title: 'Quality Assurance Manager',
    bio: 'Nina ensures every plant that leaves our facility meets our rigorous "Nursery Intelligence" standards. Her attention to detail and plant health expertise guarantee customer satisfaction.',
    image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=400',
    specialty: 'Plant Health & Quality',
    years_experience: 9,
  },
];

const GrowersPage: React.FC<GrowersPageProps> = ({ onBack }) => {
  const { growers: supabaseGrowers, loading } = useGrowers();

  // Use Supabase data if available, otherwise use placeholders
  const growers: Grower[] = supabaseGrowers.length > 0 ? supabaseGrowers : PLACEHOLDER_GROWERS;

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    visible: { transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 bg-white selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-24">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.span variants={fadeIn} className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">Our Team</motion.span>
          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-heading font-black text-gray-900 mb-8 leading-[1.1]">
            Meet the <span className="sage-text-gradient">Growers</span>
          </motion.h1>
          <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed">
            The passionate experts behind every seedling. Our team combines decades of horticultural experience with cutting-edge technology to bring you the healthiest plants possible.
          </motion.p>
        </motion.div>
      </section>

      {/* Team Stats */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { value: '50+', label: 'Years Combined Experience' },
            { value: '15K', label: 'Sq. Ft. Nursery' },
            { value: '100K+', label: 'Plants Grown Annually' },
            { value: '500+', label: 'Schools Partnered' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-gray-50 rounded-3xl p-8 text-center border border-gray-100">
              <p className="text-4xl md:text-5xl font-heading font-black text-emerald-600 mb-2">{stat.value}</p>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Growers Grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="animate-pulse">
                <div className="bg-gray-200 rounded-[2.5rem] aspect-[4/5] mb-6" />
                <div className="h-6 bg-gray-200 rounded-full w-3/4 mb-3" />
                <div className="h-4 bg-gray-200 rounded-full w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {growers.map((grower) => (
              <motion.div
                key={grower.id}
                variants={fadeIn}
                whileHover={{ y: -10 }}
                className="group"
              >
                <div className="relative rounded-[2.5rem] overflow-hidden aspect-[4/5] mb-6 shadow-xl">
                  <img
                    src={grower.image}
                    alt={grower.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Specialty Tag */}
                  <div className="absolute top-6 left-6">
                    <span className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-emerald-600">
                      {grower.specialty}
                    </span>
                  </div>

                  {/* Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <h3 className="text-2xl font-heading font-bold text-white mb-1">{grower.name}</h3>
                    <p className="text-emerald-400 font-semibold text-sm">{grower.title}</p>
                  </div>
                </div>

                <p className="text-gray-500 leading-relaxed text-sm px-2">
                  {grower.bio}
                </p>

                {grower.years_experience && (
                  <p className="mt-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {grower.years_experience}+ Years Experience
                  </p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="text-center mb-16">
            <span className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">Our Philosophy</span>
            <h2 className="text-4xl font-heading font-black text-gray-900">What Drives <span className="sage-text-gradient">Our Team</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Passion for Plants',
                desc: 'Every team member shares a deep love for horticulture. We treat each seedling as if it were going into our own gardens.',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>
                ),
              },
              {
                title: 'Innovation First',
                desc: 'We constantly experiment with new growing techniques, technologies, and sustainable practices to improve our craft.',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                ),
              },
              {
                title: 'Community Impact',
                desc: 'From school programs to local partnerships, we believe in sharing knowledge and making urban farming accessible to all.',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ),
              },
            ].map((value, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10 }}
                className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-500 leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join the Team CTA */}
      <section className="px-4 md:px-12 py-24">
        <div className="max-w-7xl mx-auto bg-gray-900 rounded-[4rem] p-12 md:p-24 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/leaf.png')] opacity-5 pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2 className="text-4xl md:text-6xl font-heading font-black text-white mb-8">Want to join our <span className="text-emerald-400">growing team?</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 font-medium">
              We're always looking for passionate plant people to join our mission of transforming urban agriculture.
            </p>
            <button
              onClick={() => onBack()}
              className="px-12 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-900/40"
            >
              View Open Positions
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default GrowersPage;
