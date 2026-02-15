
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { supabase } from '../src/lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
}

interface BlogPostPageProps {
  slug: string;
  onBack: () => void;
}

const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug, onBack }) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, content, excerpt, featured_image_url, author_name, category, published_at, created_at')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        if (error) throw error;
        setPost(data);
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError('Post not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-16 bg-site">
        <div className="max-w-3xl mx-auto px-4 md:px-12 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading article...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen pt-32 pb-16 bg-site">
        <div className="max-w-3xl mx-auto px-4 md:px-12 text-center">
          <h1 className="text-4xl font-heading font-bold text-gray-900 mb-4">Post Not Found</h1>
          <p className="text-gray-500 mb-8">The article you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Back to Blog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20 bg-site">
      <div className="max-w-3xl mx-auto px-4 md:px-12">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-emerald-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Blog
          </button>
        </motion.div>

        {/* Article Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Category & Date */}
          <div className="flex items-center gap-3 mb-4">
            {post.category && (
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                {post.category}
              </span>
            )}
            <span className="text-sm text-gray-400 font-medium">
              {formatDate(post.published_at || post.created_at)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-heading font-black text-gray-900 mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Author */}
          {post.author_name && (
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-600">
                  {post.author_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{post.author_name}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Featured Image */}
        {post.featured_image_url && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-10"
          >
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full rounded-[2rem] shadow-lg object-cover max-h-[500px]"
            />
          </motion.div>
        )}

        {/* Article Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 md:p-12"
        >
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-heading prose-headings:font-bold prose-headings:text-gray-900
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-800
              prose-img:rounded-2xl prose-img:shadow-md
              prose-ul:text-gray-600 prose-ol:text-gray-600
              prose-blockquote:border-emerald-500 prose-blockquote:text-gray-500
              prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
          />
        </motion.div>

        {/* Back to Blog CTA */}
        <div className="mt-12 text-center">
          <button
            onClick={onBack}
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all"
          >
            View All Articles
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlogPostPage;
