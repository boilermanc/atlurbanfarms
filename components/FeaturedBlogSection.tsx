
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';
import { usePageContent } from '../src/hooks/useSiteContent';

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface FeaturedBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  category: string | null;
  published_at: string | null;
  tags?: BlogTag[];
}

interface FeaturedBlogSectionProps {
  onNavigate?: (view: string) => void;
  onViewPost?: (slug: string) => void;
}

const FeaturedBlogSection: React.FC<FeaturedBlogSectionProps> = ({ onNavigate, onViewPost }) => {
  const [posts, setPosts] = useState<FeaturedBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = usePageContent('home');

  const sectionLabel = get('featured_blog', 'label', 'From the Farm');
  const headline = get('featured_blog', 'headline', 'Latest <span class="sage-text-gradient">Stories</span>');
  const description = get('featured_blog', 'description', 'Tips, stories, and updates from ATL Urban Farms.');

  useEffect(() => {
    async function fetchFeaturedPosts() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, featured_image_url, author_name, category, published_at, blog_post_tags ( tag_id, blog_tags ( id, name, slug ) )')
          .eq('is_published', true)
          .eq('is_featured', true)
          .eq('visibility', 'public')
          .order('published_at', { ascending: false })
          .limit(3);

        if (fetchError) throw fetchError;

        const postsWithTags = (data || []).map((post: any) => ({
          ...post,
          tags: (post.blog_post_tags || [])
            .map((pt: any) => pt.blog_tags)
            .filter(Boolean)
            .sort((a: BlogTag, b: BlogTag) => a.name.localeCompare(b.name)),
        }));

        setPosts(postsWithTags);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedPosts();
  }, []);

  if (loading) {
    return (
      <section className="py-12 px-4 md:px-12 bg-site border-b border-gray-200 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <div className="h-4 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
            <div className="h-12 w-80 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-gray-100" />
                <div className="p-6 space-y-3">
                  <div className="h-4 w-20 bg-gray-100 rounded-full" />
                  <div className="h-6 w-full bg-gray-100 rounded-lg" />
                  <div className="h-4 w-full bg-gray-50 rounded" />
                  <div className="h-4 w-2/3 bg-gray-50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || posts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 md:px-12 bg-site border-b border-gray-200 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <span className="brand-text font-black uppercase tracking-[0.2em] text-[20px] mb-4 block">{sectionLabel}</span>
            <h2
              className="text-5xl md:text-7xl font-heading font-extrabold text-gray-900 tracking-tight leading-tight"
              dangerouslySetInnerHTML={{ __html: headline }}
            />
            <p className="text-gray-500 mt-4 text-lg font-medium"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, idx) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => onViewPost?.(post.slug)}
              className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-300"
            >
              {/* Featured Image */}
              {post.featured_image_url ? (
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                  </svg>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                {/* Category & Tags */}
                {post.category && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {post.category}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h3 className="text-xl font-heading font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
                  {post.title}
                </h3>

                {/* Excerpt */}
                {post.excerpt && (
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 mb-4">
                    {post.excerpt}
                  </p>
                )}

                {/* Author & Date */}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  {post.author_name && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-600">
                          {post.author_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium">{post.author_name}</span>
                    </div>
                  )}
                  {post.published_at && (
                    <span>
                      {new Date(post.published_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-8 text-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate?.('blog')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-600"
          >
            View All Posts
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedBlogSection;
