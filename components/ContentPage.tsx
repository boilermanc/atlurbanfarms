import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../src/lib/supabase';

interface ContentPageData {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

interface ContentPageProps {
  slug: string;
  onBack: () => void;
}

const ContentPage: React.FC<ContentPageProps> = ({ slug, onBack }) => {
  const [page, setPage] = useState<ContentPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('content_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Page not found');
          } else {
            throw fetchError;
          }
        } else {
          setPage(data);
        }
      } catch (err) {
        console.error('Error fetching content page:', err);
        setError('Unable to load page. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pt-40 pb-20 bg-site">
        <div className="max-w-4xl mx-auto px-4 md:px-12 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen pt-40 pb-20 bg-site">
        <div className="max-w-4xl mx-auto px-4 md:px-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Page Not Found</h2>
          <p className="text-gray-500 mb-8">{error || 'The page you are looking for does not exist.'}</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-40 pb-16 bg-site">
      <div className="max-w-4xl mx-auto px-4 md:px-12">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-8 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span className="font-medium">Back</span>
        </button>

        {/* Page title */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-4">
            {page.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>Last updated: {new Date(page.updated_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</span>
          </div>
        </div>

        {/* Content */}
        <div
          className="content-page prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-emerald-600 hover:prose-a:text-emerald-700 prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel'],
          }) }}
        />
      </div>
    </div>
  );
};

export default ContentPage;
