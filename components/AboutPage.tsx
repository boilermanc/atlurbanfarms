
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { SparkleIcon } from '../constants';
import { useGrowers } from '../src/hooks/useSupabase';
import { usePageContent } from '../src/hooks/useSiteContent';

interface Grower {
  id: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  specialty: string;
  years_experience?: number;
  font_color?: string;
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

const AboutPage: React.FC = () => {
  const { growers: supabaseGrowers, loading: growersLoading } = useGrowers();
  const { get, getSection } = usePageContent('about');

  // Use growers table data, fall back to placeholders if empty
  const growers: Grower[] = supabaseGrowers.length > 0
    ? supabaseGrowers
    : PLACEHOLDER_GROWERS;

  // Get CMS content for each section
  const heroContent = getSection('hero');
  const storyContent = getSection('story');
  const seedlingsContent = getSection('seedlings');
  const technologyContent = getSection('technology');
  const statsContent = getSection('stats');
  const growersHeaderContent = getSection('growers');
  const valuesContent = getSection('values');
  const ctaContent = getSection('cta');

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    visible: { transition: { staggerChildren: 0.2 } }
  };

  // Scroll to top when page mounts, or scroll to hash target section
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(null, '', window.location.pathname);
      }, 150);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className="min-h-screen pt-36 pb-12 bg-site selection:bg-purple-100 selection:text-purple-900">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-14">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.span variants={fadeIn} className="brand-text font-bold uppercase tracking-widest text-xs mb-4 block">
            {heroContent.tagline || 'About Us'}
          </motion.span>
          <motion.h1
            variants={fadeIn}
            className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-[1.1]"
            dangerouslySetInnerHTML={{ __html: heroContent.headline || 'Growing the Future of Food, <span class="sage-text-gradient">Right Here in Atlanta.</span>' }}
          />
          <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed mb-12">
            {heroContent.subheadline || "ATL Urban Farms isn't just a nursery. We are a technology company dedicated to shortening the distance between the farm and your fork."}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative rounded-[3rem] overflow-hidden aspect-[21/9] shadow-2xl border-8 border-white"
        >
          <img src={heroContent.image_url || 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=1600'} alt="Inside our high-tech nursery" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {(heroContent.image_caption_label?.trim() || heroContent.image_caption_text?.trim()) && (
            <div className="absolute bottom-10 left-10 text-white">
              {heroContent.image_caption_label?.trim() && <p className="text-sm font-black uppercase tracking-widest mb-2">{heroContent.image_caption_label}</p>}
              {heroContent.image_caption_text?.trim() && <h3 className="text-2xl font-bold">{heroContent.image_caption_text}</h3>}
            </div>
          )}
        </motion.div>
      </section>

      {/* Our Story Section */}
      <section id="our-story" className="py-12 px-4 md:px-12 bg-white overflow-hidden scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
             <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 sage-gradient rounded-[3.5rem] blur-2xl opacity-10" />
              <img src={storyContent.image_url || "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&q=80&w=800"} alt="Founding journey" className="relative rounded-[3rem] shadow-2xl border-4 border-white aspect-[4/5] object-cover" />
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-w-[200px]">
                <p className="text-[10px] font-black uppercase brand-text mb-1">Established</p>
                <p className="text-2xl font-black text-gray-900">{storyContent.established_year || '2018'}</p>
                <p className="text-xs text-gray-400 font-medium">{storyContent.established_caption || "From a garage in Old Fourth Ward to the city's tech-hub."}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="brand-text font-bold uppercase tracking-widest text-xs mb-4 block">{storyContent.tagline || 'The Genesis'}</span>
              <h2
                className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-tight"
                dangerouslySetInnerHTML={{ __html: storyContent.headline || 'A Story of <span class="sage-text-gradient">Roots & Algorithms.</span>' }}
              />
              <div className="space-y-6 text-gray-500 text-lg leading-relaxed">
                <p dangerouslySetInnerHTML={{ __html: storyContent.paragraph_1 || 'ATL Urban Farms began with a simple question: <span class="text-gray-900 font-bold italic">"Why does \'fresh\' produce at the grocery store already look tired?"</span>' }} />
                <p dangerouslySetInnerHTML={{ __html: storyContent.paragraph_2 || "In 2018, we started experimenting with vertical growing systems in a small garage in Atlanta's Old Fourth Ward. We realized that by combining horticultural expertise with real-time sensor data and climate control, we could produce seedlings with vitality levels far beyond traditional nurseries." }} />
                <p dangerouslySetInnerHTML={{ __html: storyContent.paragraph_3 || 'Today, we operate a 15,000 sq. ft. high-tech nursery facility. We\'ve replaced guesswork with precision algorithms, ensuring that every plant that leaves our floor is "Nursery Intelligence" certified.' }} />
              </div>

              <div className="mt-12 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 brand-border" style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.2)' }}>
                  <img src={storyContent.founder_image || "https://i.pravatar.cc/150?u=founder"} alt="Founder" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{storyContent.founder_name || 'Marcus Sterling'}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{storyContent.founder_title || 'Founder & Chief Grower'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Difference Section */}
      <section id="our-approach" className="py-12 bg-gray-50 overflow-hidden scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2
                className="text-4xl font-heading font-extrabold text-gray-900 mb-8 leading-tight"
                dangerouslySetInnerHTML={{ __html: seedlingsContent.headline || 'Why <span class="brand-text">Nursery-Grown</span> Seedlings Matter.' }}
              />
              <div className="space-y-8">
                {[
                  { title: seedlingsContent.feature_1_title || "Skip the Struggle", desc: seedlingsContent.feature_1_description || "Starting from seed is hard. We do the difficult first 4-6 weeks for you in a perfect environment." },
                  { title: seedlingsContent.feature_2_title || "Nutrient Mapping", desc: seedlingsContent.feature_2_description || "Our seedlings are fed a proprietary mix of organic nutrients at precisely the right stages of growth." },
                  { title: seedlingsContent.feature_3_title || "Arrives Alive Tech", desc: seedlingsContent.feature_3_description || "Our Mon-Wed shipping schedule and custom-engineered packaging ensure your plants never 'sit' over the weekend." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0 brand-text">
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
              <img src={seedlingsContent.image_url || "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800"} alt="Perfect seedling" className="relative rounded-[3rem] shadow-2xl border-4 border-white" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tech Grid */}
      <section id="technology" className="py-14 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="text-center mb-10">
            <h2
              className="text-4xl font-heading font-extrabold text-gray-900"
              dangerouslySetInnerHTML={{ __html: technologyContent.headline || 'The Technology Behind the <span class="sage-text-gradient">Green</span>' }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: technologyContent.card_1_title || "Climate AI", desc: technologyContent.card_1_description || "Our nursery adjusts light spectrums and humidity in real-time using localized sensor data.", link: technologyContent.card_1_link || '', icon: <SparkleIcon className="w-6 h-6" /> },
              { title: technologyContent.card_2_title || "Sustainable Roots", desc: technologyContent.card_2_description || "We use 85% less water than traditional soil-based nurseries through advanced recirculation.", link: technologyContent.card_2_link || '', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> },
              { title: technologyContent.card_3_title || "School Support", desc: technologyContent.card_3_description || "Our 'Education First' dashboard helps teachers track seedling growth in the classroom.", link: technologyContent.card_3_link || '', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> }
            ].map((tech, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10 }}
                className="p-10 bg-gray-50 rounded-[2.5rem] border border-gray-100 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 brand-text">
                  {tech.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{tech.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{tech.desc}</p>
                {tech.link && (
                  <a
                    href={tech.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold brand-text hover:opacity-80 transition-colors"
                  >
                    Learn More
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l5-5-5-5"/></svg>
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the Growers Section */}
      <section id="our-team" className="py-12 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center max-w-4xl mx-auto mb-8"
          >
            <motion.span variants={fadeIn} className="brand-text font-bold uppercase tracking-widest text-xs mb-4 block">
              {growersHeaderContent.tagline || 'Our Team'}
            </motion.span>
            <motion.h2
              variants={fadeIn}
              className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-[1.1]"
              dangerouslySetInnerHTML={{ __html: growersHeaderContent.headline || 'Meet the <span class="sage-text-gradient">Growers</span>' }}
            />
            <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed">
              {growersHeaderContent.description || 'The passionate experts behind every seedling. Our team combines decades of horticultural experience with cutting-edge technology to bring you the healthiest plants possible.'}
            </motion.p>
          </motion.div>

          {/* Team Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"
          >
            {[
              { value: statsContent.stat_1_value || '50+', label: statsContent.stat_1_label || 'Years Combined Experience' },
              { value: statsContent.stat_2_value || '15K', label: statsContent.stat_2_label || 'Sq. Ft. Nursery' },
              { value: statsContent.stat_3_value || '100K+', label: statsContent.stat_3_label || 'Plants Grown Annually' },
              { value: statsContent.stat_4_value || '500+', label: statsContent.stat_4_label || 'Schools Partnered' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-gray-50 rounded-3xl p-8 text-center border border-gray-100">
                <p className="text-4xl md:text-5xl font-heading font-black brand-text mb-2">{stat.value}</p>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Growers Grid */}
          {growersLoading ? (
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
                    {grower.specialty && (
                      <div className="absolute top-6 left-6">
                        <span className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold brand-text">
                          {grower.specialty}
                        </span>
                      </div>
                    )}

                    {/* Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <h3 className="text-2xl font-heading font-bold mb-1" style={{ color: grower.font_color || '#FFFFFF' }}>{grower.name}</h3>
                      <p className="font-semibold text-sm" style={{ color: grower.font_color || '#FFFFFF', opacity: 0.8 }}>{grower.title}</p>
                    </div>
                  </div>

                  <p
                    className="text-gray-500 leading-relaxed text-sm px-2"
                    dangerouslySetInnerHTML={{ __html: grower.bio }}
                  />

                  {grower.years_experience && (
                    <p className="mt-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {grower.years_experience}+ Years Experience
                    </p>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Values Section */}
          <div className="mt-12 py-12 bg-gray-50 -mx-4 md:-mx-12 px-4 md:px-12 rounded-[3rem]">
            <div className="text-center mb-8">
              <span className="brand-text font-bold uppercase tracking-widest text-xs mb-4 block">{valuesContent.tagline || 'Our Philosophy'}</span>
              <h3
                className="text-4xl font-heading font-extrabold text-gray-900"
                dangerouslySetInnerHTML={{ __html: valuesContent.headline || 'What Drives <span class="sage-text-gradient">Our Team</span>' }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: valuesContent.value_1_title || 'Passion for Plants',
                  desc: valuesContent.value_1_description || 'Every team member shares a deep love for horticulture. We treat each seedling as if it were going into our own gardens.',
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>
                  ),
                },
                {
                  title: valuesContent.value_2_title || 'Innovation First',
                  desc: valuesContent.value_2_description || 'We constantly experiment with new growing techniques, technologies, and sustainable practices to improve our craft.',
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  ),
                },
                {
                  title: valuesContent.value_3_title || 'Community Impact',
                  desc: valuesContent.value_3_description || 'From school programs to local partnerships, we believe in sharing knowledge and making urban farming accessible to all.',
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
                  <div className="w-16 h-16 brand-bg-light rounded-2xl flex items-center justify-center mb-6 brand-text">
                    {value.icon}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h4>
                  <p className="text-gray-500 leading-relaxed">{value.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="px-4 md:px-12 pb-14">
        <div className="max-w-7xl mx-auto bg-gray-900 rounded-[4rem] p-12 md:p-24 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/leaf.png')] opacity-5 pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2
              className="text-4xl md:text-5xl font-heading font-extrabold text-white mb-8"
              dangerouslySetInnerHTML={{ __html: ctaContent.headline || 'Ready to grow <span class="brand-text">smarter?</span>' }}
            />
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 font-medium">
              {ctaContent.description || 'Join thousands of Atlanta residents and schools who are bringing their gardens into the future.'}
            </p>
            <a
              href={ctaContent.button_link || '/shop'}
              className="inline-block px-12 py-5 btn-brand rounded-2xl font-black text-lg transition-all shadow-2xl brand-shadow"
            >
              {ctaContent.button_text || 'Start Your Urban Farm'}
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
