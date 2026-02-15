-- Create blog_posts table for admin blog management
CREATE TABLE blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text,
  featured_image_url text,
  category text,
  author_name text,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: public reads published, admins manage all
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published blog posts"
  ON blog_posts FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage blog posts"
  ON blog_posts FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
  );

-- Auto-update updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for slug lookups (public blog page)
CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);

-- Index for listing published posts
CREATE INDEX idx_blog_posts_published ON blog_posts (is_published, published_at DESC);
