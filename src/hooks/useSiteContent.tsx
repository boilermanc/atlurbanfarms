import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Types
interface SiteContentItem {
  id: string;
  page: string;
  section: string;
  key: string;
  value: string;
  content_type: 'text' | 'rich_text' | 'image_url' | 'number';
}

// Nested content structure: content[section][key] = value
type SectionContent = Record<string, string>;
type PageContent = Record<string, SectionContent>;

interface SiteContentContextValue {
  content: Record<string, PageContent>;
  loading: boolean;
  error: string | null;
  getContent: (page: string, section: string, key: string, defaultValue?: string) => string;
  getSectionContent: (page: string, section: string) => SectionContent;
  refetch: () => Promise<void>;
}

// Default content values (fallback when database content not available)
const DEFAULT_CONTENT: Record<string, PageContent> = {
  home: {
    hero: {
      badge_text: 'Direct from our Atlanta Nursery',
      headline: 'High-Tech Growing for <span class="brand-text">Urban Spaces.</span>',
      subheadline: 'Premium live plant seedlings delivered to your doorstep. Optimized for home gardeners, schools, and vertical farmers.',
      primary_cta_text: 'Shop Seedlings',
      secondary_cta_text: 'Learn Our Process',
      guarantee_label: 'Guaranteed',
      guarantee_text: 'Arrives Alive',
      image_url: '',
    },
    featured: {
      label: 'Weekly Spotlight',
      headline: 'Nursery <span class="sage-text-gradient">Favorites</span>',
      description: 'Hand-picked by our lead growers for their exceptional vitality and flavor profiles.',
      cta_text: 'Meet Our Growers',
    },
    schools_promo: {
      label: 'Education First',
      headline: 'Empowering the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>',
      description: 'Our School Seedling Program provides discounted live plants and curriculum support to K-12 schools across Georgia. Let\'s grow together.',
      cta_text: 'Partner with Schools',
      image_url: '',
    },
  },
  about: {
    hero: {
      tagline: 'About Us',
      headline: 'Growing the Future of Food, <span class="sage-text-gradient">Right Here in Atlanta.</span>',
      subheadline: 'ATL Urban Farms isn\'t just a nursery. We are a technology company dedicated to shortening the distance between the farm and your fork.',
      image_url: '',
      image_caption_label: 'Facility 01 // Atlanta, GA',
      image_caption_text: 'Climate-Controlled Nursery Operations',
    },
    story: {
      tagline: 'The Genesis',
      headline: 'A Story of <span class="sage-text-gradient">Roots & Algorithms.</span>',
      paragraph_1: 'ATL Urban Farms began with a simple question: <span class="text-gray-900 font-bold italic">"Why does \'fresh\' produce at the grocery store already look tired?"</span>',
      paragraph_2: 'In 2018, we started experimenting with vertical growing systems in a small garage in Atlanta\'s Old Fourth Ward. We realized that by combining horticultural expertise with real-time sensor data and climate control, we could produce seedlings with vitality levels far beyond traditional nurseries.',
      paragraph_3: 'Today, we operate a 15,000 sq. ft. high-tech nursery facility. We\'ve replaced guesswork with precision algorithms, ensuring that every plant that leaves our floor is "Nursery Intelligence" certified.',
      image_url: '',
      founder_name: 'Marcus Sterling',
      founder_title: 'Founder & Chief Grower',
      established_year: '2018',
      established_caption: 'From a garage in Old Fourth Ward to the city\'s tech-hub.',
    },
    seedlings: {
      headline: 'Why <span class="text-emerald-600">Nursery-Grown</span> Seedlings Matter.',
      feature_1_title: 'Skip the Struggle',
      feature_1_description: 'Starting from seed is hard. We do the difficult first 4-6 weeks for you in a perfect environment.',
      feature_2_title: 'Nutrient Mapping',
      feature_2_description: 'Our seedlings are fed a proprietary mix of organic nutrients at precisely the right stages of growth.',
      feature_3_title: 'Arrives Alive Tech',
      feature_3_description: 'Our Mon-Wed shipping schedule and custom-engineered packaging ensure your plants never \'sit\' over the weekend.',
      image_url: '',
    },
    technology: {
      headline: 'The Technology Behind the <span class="sage-text-gradient">Green</span>',
      card_1_title: 'Climate AI',
      card_1_description: 'Our nursery adjusts light spectrums and humidity in real-time using localized sensor data.',
      card_1_link: '',
      card_2_title: 'Sustainable Roots',
      card_2_description: 'We use 85% less water than traditional soil-based nurseries through advanced recirculation.',
      card_2_link: '',
      card_3_title: 'School Support',
      card_3_description: 'Our \'Education First\' dashboard helps teachers track seedling growth in the classroom.',
      card_3_link: '',
    },
    stats: {
      stat_1_value: '50+',
      stat_1_label: 'Years Combined Experience',
      stat_2_value: '15K',
      stat_2_label: 'Sq. Ft. Nursery',
      stat_3_value: '100K+',
      stat_3_label: 'Plants Grown Annually',
      stat_4_value: '500+',
      stat_4_label: 'Schools Partnered',
    },
    growers: {
      tagline: 'Our Team',
      headline: 'Meet the <span class="sage-text-gradient">Growers</span>',
      description: 'The passionate experts behind every seedling. Our team combines decades of horticultural experience with cutting-edge technology to bring you the healthiest plants possible.',
    },
    grower_1: {
      name: '',
      title: '',
      image: '',
      bio: '',
    },
    grower_2: {
      name: '',
      title: '',
      image: '',
      bio: '',
    },
    grower_3: {
      name: '',
      title: '',
      image: '',
      bio: '',
    },
    grower_4: {
      name: '',
      title: '',
      image: '',
      bio: '',
    },
    values: {
      tagline: 'Our Philosophy',
      headline: 'What Drives <span class="sage-text-gradient">Our Team</span>',
      value_1_title: 'Passion for Plants',
      value_1_description: 'Every team member shares a deep love for horticulture. We treat each seedling as if it were going into our own gardens.',
      value_2_title: 'Innovation First',
      value_2_description: 'We constantly experiment with new growing techniques, technologies, and sustainable practices to improve our craft.',
      value_3_title: 'Community Impact',
      value_3_description: 'From school programs to local partnerships, we believe in sharing knowledge and making urban farming accessible to all.',
    },
    cta: {
      headline: 'Ready to grow <span class="text-emerald-400">smarter?</span>',
      description: 'Join thousands of Atlanta residents and schools who are bringing their gardens into the future.',
      button_text: 'Start Your Urban Farm',
      button_link: '/shop',
    },
  },
  schools: {
    hero: {
      tagline: 'School Partnership Program',
      headline: 'Growing the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>',
      description: 'Bring hands-on agriculture education to your school with our School Seedling Program. Discounted plants, curriculum support, and everything you need to cultivate young minds.',
      image_url: '',
      image_label: 'Education First Initiative',
      image_caption: 'Empowering K-12 Schools Across Georgia',
    },
    benefits: {
      tagline: 'Why Partner With Us',
      headline: 'Benefits for Your <span class="text-emerald-600">School</span>',
      description: 'Our program goes beyond just providing plants. We\'re committed to supporting comprehensive agricultural education.',
      benefit_1_title: 'STEM Learning',
      benefit_1_description: 'Integrate hands-on agriculture into science curriculum with real plant growth experiments and data collection.',
      benefit_2_title: 'Nutrition Education',
      benefit_2_description: 'Teach students where their food comes from and encourage healthy eating habits through growing their own vegetables.',
      benefit_3_title: 'Environmental Sustainability',
      benefit_3_description: 'Foster environmental stewardship by demonstrating sustainable growing practices and resource conservation.',
      benefit_4_title: 'Fresh Cafeteria Produce',
      benefit_4_description: 'Schools with growing programs can supply fresh herbs and vegetables directly to their cafeteria programs.',
    },
    features: {
      tagline: 'What\'s Included',
      headline: 'Everything You Need to <span class="text-emerald-600">Get Growing.</span>',
      feature_1_title: 'Discounted Seedlings',
      feature_1_description: 'K-12 schools receive up to 40% off our premium seedling collections, making it affordable to start or expand school gardens.',
      feature_2_title: 'Curriculum Support',
      feature_2_description: 'Access our \'Education First\' dashboard with lesson plans, growth tracking tools, and student activity sheets aligned to state standards.',
      feature_3_title: 'Teacher Training',
      feature_3_description: 'Free virtual workshops for educators on container gardening, Tower Garden maintenance, and integrating agriculture into classroom learning.',
      feature_4_title: 'Ongoing Support',
      feature_4_description: 'Dedicated support line for schools with questions about plant care, troubleshooting, and program expansion.',
      image_url: '',
      schools_served_value: '150+',
      schools_served_label: 'across Georgia',
    },
    contact: {
      tagline: 'Get Started',
      headline: 'Ready to Bring Urban Farming to Your <span class="text-emerald-600">School?</span>',
      description: 'Fill out the form and our Education Team will reach out within 2 business days to discuss your school\'s needs and how we can help you get growing.',
      email_label: 'Email Us Directly',
      email: 'schools@atlurbanfarms.com',
      phone_label: 'Call Our Education Team',
      phone: '(404) 555-1234',
    },
    testimonial: {
      quote: 'ATL Urban Farms transformed our science curriculum. Our students are now excited to come to class and check on their plants every day. The curriculum resources made it easy for our teachers to integrate gardening into multiple subjects.',
      author_name: 'Dr. Lisa Mitchell',
      author_title: 'Principal, Westside Academy',
      author_image: '',
    },
    cta: {
      headline: 'Questions? We\'re Here to Help.',
      description: 'Not sure if the program is right for your school? Our Education Team is happy to answer any questions.',
      primary_button_text: 'Email Our Team',
      secondary_button_text: 'View FAQ',
    },
  },
  faq: {
    header: {
      tagline: 'How can we help?',
      headline: 'Help <span class="text-emerald-600">Center</span>',
      description: 'Everything you need to know about our seedlings, our shipping process, and our high-tech growing mission.',
    },
    cta: {
      headline: 'Still have questions?',
      description: 'Sage AI is available 24/7 to answer your specific growing questions.',
      button_text: 'Ask Sage',
    },
  },
  calendar: {
    header: {
      tagline: 'What\'s Happening',
      headline: 'Events Calendar',
      description: 'Workshops, farm visits, shipping days, and more. Join us for hands-on learning and community growing!',
    },
  },
  footer: {
    main: {
      tagline: 'Transforming urban spaces with premium, nursery-grown seedlings. High-tech growing for the modern gardener.',
      copyright_text: 'ATL URBAN FARMS. ALL RIGHTS RESERVED.',
      built_by: 'Built by Sweetwater Technology',
    },
    newsletter: {
      headline: 'Join the Garden',
      description: 'Get growing tips, nursery updates, and early access to rare seasonal seedlings.',
    },
  },
};

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export const SiteContentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<Record<string, PageContent>>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('site_content')
        .select('*');

      if (supabaseError) {
        // If table doesn't exist, just use defaults
        if (supabaseError.code === '42P01') {
          console.warn('site_content table not found, using defaults');
          return;
        }
        throw supabaseError;
      }

      if (data && data.length > 0) {
        // Transform flat array into nested structure
        const transformed: Record<string, PageContent> = { ...DEFAULT_CONTENT };

        (data as SiteContentItem[]).forEach((item) => {
          if (!transformed[item.page]) {
            transformed[item.page] = {};
          }
          if (!transformed[item.page][item.section]) {
            transformed[item.page][item.section] = {};
          }
          transformed[item.page][item.section][item.key] = item.value;
        });

        setContent(transformed);
      }
    } catch (err) {
      console.error('Error fetching site content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
      // Keep using defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const getContent = useCallback(
    (page: string, section: string, key: string, defaultValue: string = ''): string => {
      return content[page]?.[section]?.[key] ?? DEFAULT_CONTENT[page]?.[section]?.[key] ?? defaultValue;
    },
    [content]
  );

  const getSectionContent = useCallback(
    (page: string, section: string): SectionContent => {
      return content[page]?.[section] ?? DEFAULT_CONTENT[page]?.[section] ?? {};
    },
    [content]
  );

  const value: SiteContentContextValue = {
    content,
    loading,
    error,
    getContent,
    getSectionContent,
    refetch: fetchContent,
  };

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  );
};

export const useSiteContent = (): SiteContentContextValue => {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error('useSiteContent must be used within a SiteContentProvider');
  }
  return context;
};

// Convenience hook for getting content for a specific page
export const usePageContent = (page: string) => {
  const { content, loading, error, getContent, getSectionContent } = useSiteContent();

  const get = useCallback(
    (section: string, key: string, defaultValue?: string) => {
      return getContent(page, section, key, defaultValue);
    },
    [getContent, page]
  );

  const getSection = useCallback(
    (section: string) => {
      return getSectionContent(page, section);
    },
    [getSectionContent, page]
  );

  return {
    content: content[page] || {},
    loading,
    error,
    get,
    getSection,
  };
};

export default useSiteContent;
