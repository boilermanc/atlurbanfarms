-- Add is_featured column to blog_posts for home page featured blog section
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient featured posts query
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON public.blog_posts (is_featured)
  WHERE is_featured = true AND is_published = true;
