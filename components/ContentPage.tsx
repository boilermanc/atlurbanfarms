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

/**
 * If content is mostly plain text (no <p> or <h2> tags), wrap lines in <p> tags
 * and convert numbered sections (e.g. "1. Title") into headings.
 */
function formatContentForDisplay(html: string): string {
  // If content already has paragraph or heading tags, return as-is
  if (/<(p|h[1-6]|div|section|article)\b/i.test(html)) {
    return html;
  }

  // Split on double newlines or numbered section patterns
  const lines = html.split(/\n\s*\n|\n(?=\d+\.\s)/);

  return lines
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      // Convert "1. Section Title" pattern into h2
      const numberedHeading = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (numberedHeading && numberedHeading[2].length < 100) {
        return `<h2>${numberedHeading[1]}. ${numberedHeading[2]}</h2>`;
      }

      // Wrap everything else in paragraphs, preserving single newlines as <br>
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
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
      <style>{`
        .content-page {
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .content-page h1,
        .content-page h2,
        .content-page h3,
        .content-page h4 {
          margin-top: 2em;
          margin-bottom: 0.75em;
          line-height: 1.3;
        }
        .content-page h1:first-child,
        .content-page h2:first-child {
          margin-top: 0;
        }
        .content-page p {
          margin-bottom: 1.25em;
        }
        .content-page ul,
        .content-page ol {
          padding-left: 1.5em;
          margin-bottom: 1.25em;
        }
        .content-page li {
          margin-bottom: 0.5em;
        }
        @media (max-width: 640px) {
          .content-page {
            font-size: 15px;
            line-height: 1.75;
          }
          .content-page h1 { font-size: 1.5em; }
          .content-page h2 { font-size: 1.3em; }
          .content-page h3 { font-size: 1.15em; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 md:px-12">
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
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-3">
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
          className="content-page prose prose-base md:prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-emerald-600 hover:prose-a:text-emerald-700 prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatContentForDisplay(page.content), {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel'],
          }) }}
        />
      </div>
    </div>
  );
};

export default ContentPage;
