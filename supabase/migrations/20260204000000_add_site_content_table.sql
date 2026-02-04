-- Create site_content table for managing static content across the site
CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,           -- 'home', 'about', 'schools', 'faq', 'calendar', 'footer'
  section TEXT NOT NULL,        -- 'hero', 'story', 'benefits', etc.
  key TEXT NOT NULL,            -- 'headline', 'description', 'cta_text', 'image_url'
  value TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'rich_text', 'image_url', 'number'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page, section, key)
);

-- Create indexes for fast lookups
CREATE INDEX idx_site_content_page ON site_content(page);
CREATE INDEX idx_site_content_page_section ON site_content(page, section);

-- Enable RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read site content
CREATE POLICY "Anyone can view site content"
  ON site_content
  FOR SELECT
  USING (true);

-- Policy: Admins can manage site content
CREATE POLICY "Admins can manage site content"
  ON site_content
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW
  EXECUTE FUNCTION update_site_content_updated_at();

-- ============================================================================
-- SEED DATA: HOME PAGE
-- ============================================================================

-- Home > Hero Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('home', 'hero', 'badge_text', 'Direct from our Atlanta Nursery', 'text'),
  ('home', 'hero', 'headline', 'High-Tech Growing for <span class="brand-text">Urban Spaces.</span>', 'rich_text'),
  ('home', 'hero', 'subheadline', 'Premium live plant seedlings delivered to your doorstep. Optimized for home gardeners, schools, and vertical farmers.', 'text'),
  ('home', 'hero', 'primary_cta_text', 'Shop Seedlings', 'text'),
  ('home', 'hero', 'secondary_cta_text', 'Learn Our Process', 'text'),
  ('home', 'hero', 'guarantee_label', 'Guaranteed', 'text'),
  ('home', 'hero', 'guarantee_text', 'Arrives Alive', 'text'),
  ('home', 'hero', 'image_url', 'https://picsum.photos/seed/urbanfarm/800/1000', 'image_url');

-- Home > Featured Products Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('home', 'featured', 'label', 'Weekly Spotlight', 'text'),
  ('home', 'featured', 'headline', 'Nursery <span class="sage-text-gradient">Favorites</span>', 'rich_text'),
  ('home', 'featured', 'description', 'Hand-picked by our lead growers for their exceptional vitality and flavor profiles.', 'text'),
  ('home', 'featured', 'cta_text', 'Meet Our Growers', 'text');

-- Home > Schools Promo Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('home', 'schools_promo', 'label', 'Education First', 'text'),
  ('home', 'schools_promo', 'headline', 'Empowering the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>', 'rich_text'),
  ('home', 'schools_promo', 'description', 'Our School Seedling Program provides discounted live plants and curriculum support to K-12 schools across Georgia. Let''s grow together.', 'text'),
  ('home', 'schools_promo', 'cta_text', 'Partner with Schools', 'text'),
  ('home', 'schools_promo', 'image_url', 'https://picsum.photos/seed/school/800/600', 'image_url');

-- ============================================================================
-- SEED DATA: ABOUT PAGE
-- ============================================================================

-- About > Hero Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'hero', 'tagline', 'About Us', 'text'),
  ('about', 'hero', 'headline', 'Growing the Future of Food, <span class="sage-text-gradient">Right Here in Atlanta.</span>', 'rich_text'),
  ('about', 'hero', 'subheadline', 'ATL Urban Farms isn''t just a nursery. We are a technology company dedicated to shortening the distance between the farm and your fork.', 'text'),
  ('about', 'hero', 'image_url', 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=1600', 'image_url'),
  ('about', 'hero', 'image_caption_label', 'Facility 01 // Atlanta, GA', 'text'),
  ('about', 'hero', 'image_caption_text', 'Climate-Controlled Nursery Operations', 'text');

-- About > Story Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'story', 'tagline', 'The Genesis', 'text'),
  ('about', 'story', 'headline', 'A Story of <span class="sage-text-gradient">Roots & Algorithms.</span>', 'rich_text'),
  ('about', 'story', 'paragraph_1', 'ATL Urban Farms began with a simple question: <span class="text-gray-900 font-bold italic">"Why does ''fresh'' produce at the grocery store already look tired?"</span>', 'rich_text'),
  ('about', 'story', 'paragraph_2', 'In 2018, we started experimenting with vertical growing systems in a small garage in Atlanta''s Old Fourth Ward. We realized that by combining horticultural expertise with real-time sensor data and climate control, we could produce seedlings with vitality levels far beyond traditional nurseries.', 'text'),
  ('about', 'story', 'paragraph_3', 'Today, we operate a 15,000 sq. ft. high-tech nursery facility. We''ve replaced guesswork with precision algorithms, ensuring that every plant that leaves our floor is "Nursery Intelligence" certified.', 'text'),
  ('about', 'story', 'image_url', 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&q=80&w=800', 'image_url'),
  ('about', 'story', 'founder_name', 'Marcus Sterling', 'text'),
  ('about', 'story', 'founder_title', 'Founder & Chief Grower', 'text'),
  ('about', 'story', 'established_year', '2018', 'text'),
  ('about', 'story', 'established_caption', 'From a garage in Old Fourth Ward to the city''s tech-hub.', 'text');

-- About > Why Seedlings Section (3 features)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'seedlings', 'headline', 'Why <span class="text-emerald-600">Nursery-Grown</span> Seedlings Matter.', 'rich_text'),
  ('about', 'seedlings', 'feature_1_title', 'Skip the Struggle', 'text'),
  ('about', 'seedlings', 'feature_1_description', 'Starting from seed is hard. We do the difficult first 4-6 weeks for you in a perfect environment.', 'text'),
  ('about', 'seedlings', 'feature_2_title', 'Nutrient Mapping', 'text'),
  ('about', 'seedlings', 'feature_2_description', 'Our seedlings are fed a proprietary mix of organic nutrients at precisely the right stages of growth.', 'text'),
  ('about', 'seedlings', 'feature_3_title', 'Arrives Alive Tech', 'text'),
  ('about', 'seedlings', 'feature_3_description', 'Our Mon-Wed shipping schedule and custom-engineered packaging ensure your plants never ''sit'' over the weekend.', 'text'),
  ('about', 'seedlings', 'image_url', 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800', 'image_url');

-- About > Technology Section (3 cards)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'technology', 'headline', 'The Technology Behind the <span class="sage-text-gradient">Green</span>', 'rich_text'),
  ('about', 'technology', 'card_1_title', 'Climate AI', 'text'),
  ('about', 'technology', 'card_1_description', 'Our nursery adjusts light spectrums and humidity in real-time using localized sensor data.', 'text'),
  ('about', 'technology', 'card_2_title', 'Sustainable Roots', 'text'),
  ('about', 'technology', 'card_2_description', 'We use 85% less water than traditional soil-based nurseries through advanced recirculation.', 'text'),
  ('about', 'technology', 'card_3_title', 'School Support', 'text'),
  ('about', 'technology', 'card_3_description', 'Our ''Education First'' dashboard helps teachers track seedling growth in the classroom.', 'text');

-- About > Team Stats (4 stats)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'stats', 'stat_1_value', '50+', 'text'),
  ('about', 'stats', 'stat_1_label', 'Years Combined Experience', 'text'),
  ('about', 'stats', 'stat_2_value', '15K', 'text'),
  ('about', 'stats', 'stat_2_label', 'Sq. Ft. Nursery', 'text'),
  ('about', 'stats', 'stat_3_value', '100K+', 'text'),
  ('about', 'stats', 'stat_3_label', 'Plants Grown Annually', 'text'),
  ('about', 'stats', 'stat_4_value', '500+', 'text'),
  ('about', 'stats', 'stat_4_label', 'Schools Partnered', 'text');

-- About > Growers Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'growers', 'tagline', 'Our Team', 'text'),
  ('about', 'growers', 'headline', 'Meet the <span class="sage-text-gradient">Growers</span>', 'rich_text'),
  ('about', 'growers', 'description', 'The passionate experts behind every seedling. Our team combines decades of horticultural experience with cutting-edge technology to bring you the healthiest plants possible.', 'text');

-- About > Values Section (3 values)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'values', 'tagline', 'Our Philosophy', 'text'),
  ('about', 'values', 'headline', 'What Drives <span class="sage-text-gradient">Our Team</span>', 'rich_text'),
  ('about', 'values', 'value_1_title', 'Passion for Plants', 'text'),
  ('about', 'values', 'value_1_description', 'Every team member shares a deep love for horticulture. We treat each seedling as if it were going into our own gardens.', 'text'),
  ('about', 'values', 'value_2_title', 'Innovation First', 'text'),
  ('about', 'values', 'value_2_description', 'We constantly experiment with new growing techniques, technologies, and sustainable practices to improve our craft.', 'text'),
  ('about', 'values', 'value_3_title', 'Community Impact', 'text'),
  ('about', 'values', 'value_3_description', 'From school programs to local partnerships, we believe in sharing knowledge and making urban farming accessible to all.', 'text');

-- About > CTA Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('about', 'cta', 'headline', 'Ready to grow <span class="text-emerald-400">smarter?</span>', 'rich_text'),
  ('about', 'cta', 'description', 'Join thousands of Atlanta residents and schools who are bringing their gardens into the future.', 'text'),
  ('about', 'cta', 'button_text', 'Start Your Urban Farm', 'text');

-- ============================================================================
-- SEED DATA: SCHOOLS PAGE
-- ============================================================================

-- Schools > Hero Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'hero', 'tagline', 'School Partnership Program', 'text'),
  ('schools', 'hero', 'headline', 'Growing the Next Generation of <span class="text-emerald-600">Urban Farmers.</span>', 'rich_text'),
  ('schools', 'hero', 'description', 'Bring hands-on agriculture education to your school with our School Seedling Program. Discounted plants, curriculum support, and everything you need to cultivate young minds.', 'text'),
  ('schools', 'hero', 'image_url', 'https://images.unsplash.com/photo-1588075592446-265fd1e6e76f?auto=format&fit=crop&q=80&w=1600', 'image_url'),
  ('schools', 'hero', 'image_label', 'Education First Initiative', 'text'),
  ('schools', 'hero', 'image_caption', 'Empowering K-12 Schools Across Georgia', 'text');

-- Schools > Benefits Section (4 benefits)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'benefits', 'tagline', 'Why Partner With Us', 'text'),
  ('schools', 'benefits', 'headline', 'Benefits for Your <span class="text-emerald-600">School</span>', 'rich_text'),
  ('schools', 'benefits', 'description', 'Our program goes beyond just providing plants. We''re committed to supporting comprehensive agricultural education.', 'text'),
  ('schools', 'benefits', 'benefit_1_title', 'STEM Learning', 'text'),
  ('schools', 'benefits', 'benefit_1_description', 'Integrate hands-on agriculture into science curriculum with real plant growth experiments and data collection.', 'text'),
  ('schools', 'benefits', 'benefit_2_title', 'Nutrition Education', 'text'),
  ('schools', 'benefits', 'benefit_2_description', 'Teach students where their food comes from and encourage healthy eating habits through growing their own vegetables.', 'text'),
  ('schools', 'benefits', 'benefit_3_title', 'Environmental Sustainability', 'text'),
  ('schools', 'benefits', 'benefit_3_description', 'Foster environmental stewardship by demonstrating sustainable growing practices and resource conservation.', 'text'),
  ('schools', 'benefits', 'benefit_4_title', 'Fresh Cafeteria Produce', 'text'),
  ('schools', 'benefits', 'benefit_4_description', 'Schools with growing programs can supply fresh herbs and vegetables directly to their cafeteria programs.', 'text');

-- Schools > Features Section (4 features)
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'features', 'tagline', 'What''s Included', 'text'),
  ('schools', 'features', 'headline', 'Everything You Need to <span class="text-emerald-600">Get Growing.</span>', 'rich_text'),
  ('schools', 'features', 'feature_1_title', 'Discounted Seedlings', 'text'),
  ('schools', 'features', 'feature_1_description', 'K-12 schools receive up to 40% off our premium seedling collections, making it affordable to start or expand school gardens.', 'text'),
  ('schools', 'features', 'feature_2_title', 'Curriculum Support', 'text'),
  ('schools', 'features', 'feature_2_description', 'Access our ''Education First'' dashboard with lesson plans, growth tracking tools, and student activity sheets aligned to state standards.', 'text'),
  ('schools', 'features', 'feature_3_title', 'Teacher Training', 'text'),
  ('schools', 'features', 'feature_3_description', 'Free virtual workshops for educators on container gardening, Tower Garden maintenance, and integrating agriculture into classroom learning.', 'text'),
  ('schools', 'features', 'feature_4_title', 'Ongoing Support', 'text'),
  ('schools', 'features', 'feature_4_description', 'Dedicated support line for schools with questions about plant care, troubleshooting, and program expansion.', 'text'),
  ('schools', 'features', 'image_url', 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80&w=800', 'image_url'),
  ('schools', 'features', 'schools_served_value', '150+', 'text'),
  ('schools', 'features', 'schools_served_label', 'across Georgia', 'text');

-- Schools > Contact Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'contact', 'tagline', 'Get Started', 'text'),
  ('schools', 'contact', 'headline', 'Ready to Bring Urban Farming to Your <span class="text-emerald-600">School?</span>', 'rich_text'),
  ('schools', 'contact', 'description', 'Fill out the form and our Education Team will reach out within 2 business days to discuss your school''s needs and how we can help you get growing.', 'text'),
  ('schools', 'contact', 'email_label', 'Email Us Directly', 'text'),
  ('schools', 'contact', 'email', 'schools@atlurbanfarms.com', 'text'),
  ('schools', 'contact', 'phone_label', 'Call Our Education Team', 'text'),
  ('schools', 'contact', 'phone', '(404) 555-1234', 'text');

-- Schools > Testimonial Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'testimonial', 'quote', 'ATL Urban Farms transformed our science curriculum. Our students are now excited to come to class and check on their plants every day. The curriculum resources made it easy for our teachers to integrate gardening into multiple subjects.', 'rich_text'),
  ('schools', 'testimonial', 'author_name', 'Dr. Lisa Mitchell', 'text'),
  ('schools', 'testimonial', 'author_title', 'Principal, Westside Academy', 'text'),
  ('schools', 'testimonial', 'author_image', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100', 'image_url');

-- Schools > CTA Section
INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('schools', 'cta', 'headline', 'Questions? We''re Here to Help.', 'text'),
  ('schools', 'cta', 'description', 'Not sure if the program is right for your school? Our Education Team is happy to answer any questions.', 'text'),
  ('schools', 'cta', 'primary_button_text', 'Email Our Team', 'text'),
  ('schools', 'cta', 'secondary_button_text', 'View FAQ', 'text');

-- ============================================================================
-- SEED DATA: FAQ PAGE
-- ============================================================================

INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('faq', 'header', 'tagline', 'How can we help?', 'text'),
  ('faq', 'header', 'headline', 'Help <span class="text-emerald-600">Center</span>', 'rich_text'),
  ('faq', 'header', 'description', 'Everything you need to know about our seedlings, our shipping process, and our high-tech growing mission.', 'text'),
  ('faq', 'cta', 'headline', 'Still have questions?', 'text'),
  ('faq', 'cta', 'description', 'Sage AI is available 24/7 to answer your specific growing questions.', 'text'),
  ('faq', 'cta', 'button_text', 'Ask Sage', 'text');

-- ============================================================================
-- SEED DATA: CALENDAR PAGE
-- ============================================================================

INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('calendar', 'header', 'tagline', 'What''s Happening', 'text'),
  ('calendar', 'header', 'headline', 'Events Calendar', 'text'),
  ('calendar', 'header', 'description', 'Workshops, farm visits, shipping days, and more. Join us for hands-on learning and community growing!', 'text');

-- ============================================================================
-- SEED DATA: FOOTER
-- ============================================================================

INSERT INTO site_content (page, section, key, value, content_type) VALUES
  ('footer', 'main', 'tagline', 'Transforming urban spaces with premium, nursery-grown seedlings. High-tech growing for the modern gardener.', 'text'),
  ('footer', 'newsletter', 'headline', 'Join the Garden', 'text'),
  ('footer', 'newsletter', 'description', 'Get growing tips, nursery updates, and early access to rare seasonal seedlings.', 'text'),
  ('footer', 'main', 'copyright_text', 'ATL URBAN FARMS. ALL RIGHTS RESERVED.', 'text'),
  ('footer', 'main', 'built_by', 'Built by Sweetwater Technology', 'text');

-- ============================================================================
-- CREATE GROWERS TABLE FOR TEAM MEMBER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS growers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT,
  image TEXT,
  specialty TEXT,
  years_experience INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for display ordering
CREATE INDEX idx_growers_display_order ON growers(display_order);
CREATE INDEX idx_growers_is_active ON growers(is_active);

-- Enable RLS
ALTER TABLE growers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active growers
CREATE POLICY "Anyone can view active growers"
  ON growers
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can manage all growers
CREATE POLICY "Admins can manage growers"
  ON growers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid())
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_growers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER growers_updated_at
  BEFORE UPDATE ON growers
  FOR EACH ROW
  EXECUTE FUNCTION update_growers_updated_at();

-- ============================================================================
-- SEED DATA: GROWERS (Team Members)
-- ============================================================================

INSERT INTO growers (name, title, bio, image, specialty, years_experience, is_active, display_order) VALUES
  (
    'Marcus Sterling',
    'Founder & Chief Grower',
    'Marcus founded ATL Urban Farms in 2018 with a vision to revolutionize urban agriculture. With over 15 years of experience in horticulture and a background in agricultural technology, he leads our growing operations and innovation initiatives.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    'Vertical Growing Systems',
    15,
    true,
    1
  ),
  (
    'Amara Johnson',
    'Head of Herb Production',
    'Amara brings a lifetime of knowledge passed down through generations of farmers in her family. She specializes in aromatic herbs and has developed our signature herb growing protocols that maximize flavor and potency.',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    'Culinary & Medicinal Herbs',
    12,
    true,
    2
  ),
  (
    'David Chen',
    'Climate Systems Engineer',
    'David oversees our climate control AI and sensor networks. His background in environmental engineering ensures our nursery maintains optimal growing conditions 24/7, resulting in healthier, more resilient seedlings.',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
    'Climate AI & Automation',
    8,
    true,
    3
  ),
  (
    'Sofia Rodriguez',
    'Vegetable Cultivation Lead',
    'Sofia manages our vegetable seedling program with a focus on heirloom and specialty varieties. Her expertise in organic cultivation practices ensures every vegetable plant leaves our nursery ready to thrive.',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    'Heirloom Vegetables',
    10,
    true,
    4
  ),
  (
    'James Thompson',
    'Education & Outreach Director',
    'James leads our School Seedling Program and community workshops. A former science teacher, he is passionate about connecting the next generation with the joy of growing their own food.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
    'Agricultural Education',
    14,
    true,
    5
  ),
  (
    'Nina Okafor',
    'Quality Assurance Manager',
    'Nina ensures every plant that leaves our facility meets our rigorous "Nursery Intelligence" standards. Her attention to detail and plant health expertise guarantee customer satisfaction.',
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=400',
    'Plant Health & Quality',
    9,
    true,
    6
  );
