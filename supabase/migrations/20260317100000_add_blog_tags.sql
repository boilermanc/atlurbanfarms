-- Blog tags table for SEO and categorization
CREATE TABLE IF NOT EXISTS blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Junction table linking blog posts to tags (many-to-many)
CREATE TABLE IF NOT EXISTS blog_post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blog_post_id, tag_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post_id ON blog_post_tags (blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag_id ON blog_post_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_blog_tags_slug ON blog_tags (slug);

-- RLS policies
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;

-- blog_tags: anyone can read, admins can manage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blog_tags' AND policyname = 'Anyone can view blog tags') THEN
    CREATE POLICY "Anyone can view blog tags"
      ON blog_tags FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blog_tags' AND policyname = 'Admins can manage blog tags') THEN
    CREATE POLICY "Admins can manage blog tags"
      ON blog_tags FOR ALL USING (
        EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
      );
  END IF;
END $$;

-- blog_post_tags: anyone can read (for public display), admins can manage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blog_post_tags' AND policyname = 'Anyone can view blog post tags') THEN
    CREATE POLICY "Anyone can view blog post tags"
      ON blog_post_tags FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blog_post_tags' AND policyname = 'Admins can manage blog post tags') THEN
    CREATE POLICY "Admins can manage blog post tags"
      ON blog_post_tags FOR ALL USING (
        EXISTS (SELECT 1 FROM admin_user_roles WHERE customer_id = auth.uid() AND is_active = true)
      );
  END IF;
END $$;
