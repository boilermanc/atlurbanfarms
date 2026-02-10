
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePageContent } from '../src/hooks/useSiteContent';

interface SchoolsPageProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

const SchoolsPage: React.FC<SchoolsPageProps> = ({ onBack, onNavigate }) => {
  const [formData, setFormData] = useState({
    schoolName: '',
    contactName: '',
    email: '',
    phone: '',
    gradeLevel: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { get, getSection } = usePageContent('schools');

  // Get CMS content
  const heroContent = getSection('hero');
  const benefitsContent = getSection('benefits');
  const featuresContent = getSection('features');
  const contactContent = getSection('contact');
  const testimonialContent = getSection('testimonial');
  const ctaContent = getSection('cta');

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    visible: { transition: { staggerChildren: 0.2 } }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would submit to a backend
    setIsSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const benefits = [
    {
      title: "STEM Learning",
      description: "Integrate hands-on agriculture into science curriculum with real plant growth experiments and data collection.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
        </svg>
      )
    },
    {
      title: "Nutrition Education",
      description: "Teach students where their food comes from and encourage healthy eating habits through growing their own vegetables.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14 4.2 3.39 6.51 3.4 10 1-2-2-4-4-7-4-1 0-1.5.5-3 1.5"/>
          <path d="M2 2c0 4 4 9 7 11"/>
        </svg>
      )
    },
    {
      title: "Environmental Sustainability",
      description: "Foster environmental stewardship by demonstrating sustainable growing practices and resource conservation.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
      )
    },
    {
      title: "Fresh Cafeteria Produce",
      description: "Schools with growing programs can supply fresh herbs and vegetables directly to their cafeteria programs.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
        </svg>
      )
    }
  ];

  const programFeatures = [
    {
      title: "Discounted Seedlings",
      description: "K-12 schools receive up to 40% off our premium seedling collections, making it affordable to start or expand school gardens."
    },
    {
      title: "Curriculum Support",
      description: "Access our 'Education First' dashboard with lesson plans, growth tracking tools, and student activity sheets aligned to state standards."
    },
    {
      title: "Teacher Training",
      description: "Free virtual workshops for educators on container gardening, Tower Garden maintenance, and integrating agriculture into classroom learning."
    },
    {
      title: "Ongoing Support",
      description: "Dedicated support line for schools with questions about plant care, troubleshooting, and program expansion."
    }
  ];

  return (
    <div className="min-h-screen pt-20 pb-12 bg-site selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.span variants={fadeIn} className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">
            {heroContent.tagline || 'School Partnership Program'}
          </motion.span>
          <motion.h1
            variants={fadeIn}
            className="text-5xl md:text-7xl font-heading font-black text-gray-900 mb-8 leading-[1.1]"
            dangerouslySetInnerHTML={{ __html: heroContent.headline || 'Growing the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>' }}
          />
          <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed">
            {heroContent.description || 'Bring hands-on agriculture education to your school with our School Seedling Program. Discounted plants, curriculum support, and everything you need to cultivate young minds.'}
          </motion.p>
        </motion.div>
      </section>

      {/* Image Banner */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative rounded-[3rem] overflow-hidden aspect-[21/9] shadow-2xl border-8 border-white"
        >
          <img src={heroContent.image_url || 'https://images.unsplash.com/photo-1588075592446-265fd1e6e76f?auto=format&fit=crop&q=80&w=1600'} alt="Students in school garden" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white">
            <p className="text-sm font-black uppercase tracking-widest mb-2">{heroContent.image_label || 'Education First Initiative'}</p>
            <h3 className="text-2xl font-bold">{heroContent.image_caption || 'Empowering K-12 Schools Across Georgia'}</h3>
          </div>
        </motion.div>
      </section>

      {/* Program Benefits */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="text-purple-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">{benefitsContent.tagline || 'Why Partner With Us'}</span>
            <h2
              className="text-4xl md:text-5xl font-heading font-black text-gray-900 mb-6"
              dangerouslySetInnerHTML={{ __html: benefitsContent.headline || 'Benefits for Your <span class="text-emerald-600">School</span>' }}
            />
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              {benefitsContent.description || 'Our program goes beyond just providing plants. We\'re committed to supporting comprehensive agricultural education.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefitsContent[`benefit_${idx + 1}_title`] || benefit.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{benefitsContent[`benefit_${idx + 1}_description`] || benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">{featuresContent.tagline || 'What\'s Included'}</span>
              <h2
                className="text-4xl md:text-5xl font-heading font-black text-gray-900 mb-8 leading-tight"
                dangerouslySetInnerHTML={{ __html: featuresContent.headline || 'Everything You Need to <span class="text-emerald-600">Get Growing.</span>' }}
              />
              <div className="space-y-8">
                {programFeatures.map((feature, idx) => (
                  <div key={idx} className="flex gap-6">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-emerald-600 font-bold text-lg">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-2">{featuresContent[`feature_${idx + 1}_title`] || feature.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{featuresContent[`feature_${idx + 1}_description`] || feature.description}</p>
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
              <div className="absolute -inset-4 bg-gradient-to-br from-emerald-400 to-purple-500 rounded-[3.5rem] blur-2xl opacity-10" />
              <img
                src={featuresContent.image_url || 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80&w=800'}
                alt="School garden program"
                className="relative rounded-[3rem] shadow-2xl border-4 border-white aspect-[4/5] object-cover"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Schools Served</p>
                <p className="text-3xl font-black text-gray-900">{featuresContent.schools_served_value || '150+'}</p>
                <p className="text-xs text-gray-400 font-medium">{featuresContent.schools_served_label || 'across Georgia'}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-purple-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4 block">{contactContent.tagline || 'Get Started'}</span>
              <h2
                className="text-4xl md:text-5xl font-heading font-black text-gray-900 mb-6 leading-tight"
                dangerouslySetInnerHTML={{ __html: contactContent.headline || 'Ready to Bring Urban Farming to Your <span class="text-emerald-600">School?</span>' }}
              />
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                {contactContent.description || 'Fill out the form and our Education Team will reach out within 2 business days to discuss your school\'s needs and how we can help you get growing.'}
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{contactContent.email_label || 'Email Us Directly'}</p>
                    <a href={`mailto:${contactContent.email || 'schools@atlurbanfarms.com'}`} className="text-emerald-600 font-medium hover:underline">{contactContent.email || 'schools@atlurbanfarms.com'}</a>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{contactContent.phone_label || 'Call Our Education Team'}</p>
                    <a href={`tel:${contactContent.phone || '(404) 555-1234'}`} className="text-emerald-600 font-medium hover:underline">{contactContent.phone || '(404) 555-1234'}</a>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-gray-100"
            >
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h3>
                  <p className="text-gray-500 mb-6">We've received your inquiry and will be in touch within 2 business days.</p>
                  <button
                    onClick={() => onNavigate('shop')}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Browse Our Plants
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="schoolName" className="block text-sm font-bold text-gray-700 mb-2">School Name *</label>
                    <input
                      type="text"
                      id="schoolName"
                      name="schoolName"
                      required
                      value={formData.schoolName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                      placeholder="Atlanta Elementary School"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="contactName" className="block text-sm font-bold text-gray-700 mb-2">Contact Name *</label>
                      <input
                        type="text"
                        id="contactName"
                        name="contactName"
                        required
                        value={formData.contactName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label htmlFor="gradeLevel" className="block text-sm font-bold text-gray-700 mb-2">Grade Levels</label>
                      <select
                        id="gradeLevel"
                        name="gradeLevel"
                        value={formData.gradeLevel}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
                      >
                        <option value="">Select grade levels</option>
                        <option value="elementary">Elementary (K-5)</option>
                        <option value="middle">Middle School (6-8)</option>
                        <option value="high">High School (9-12)</option>
                        <option value="mixed">Multiple Levels</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        placeholder="jane@school.edu"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        placeholder="(404) 555-0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-2">Tell Us About Your Goals</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                      placeholder="We're interested in starting a school garden program..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                  >
                    Submit Partnership Inquiry
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-[3rem] p-12 md:p-16 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/leaf.png')] opacity-5 pointer-events-none" />
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400 mx-auto mb-8 opacity-50">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21c0 1 0 1 1 1z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-2xl md:text-3xl text-white font-medium leading-relaxed mb-8">
                "{testimonialContent.quote || 'ATL Urban Farms transformed our science curriculum. Our students are now excited to come to class and check on their plants every day. The curriculum resources made it easy for our teachers to integrate gardening into multiple subjects.'}"
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-400">
                  <img src={testimonialContent.author_image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100'} alt="Principal" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">{testimonialContent.author_name || 'Dr. Lisa Mitchell'}</p>
                  <p className="text-sm text-gray-400">{testimonialContent.author_title || 'Principal, Westside Academy'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 md:px-12 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-black text-gray-900 mb-6">
            {ctaContent.headline || 'Questions? We\'re Here to Help.'}
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            {ctaContent.description || 'Not sure if the program is right for your school? Our Education Team is happy to answer any questions.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`mailto:${contactContent.email || 'schools@atlurbanfarms.com'}`}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {ctaContent.primary_button_text || 'Email Our Team'}
            </a>
            <button
              onClick={() => onNavigate('faq')}
              className="px-8 py-4 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
            >
              {ctaContent.secondary_button_text || 'View FAQ'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SchoolsPage;
