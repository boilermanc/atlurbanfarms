import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface ContentPagesPageProps {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

const ContentPagesPage: React.FC<ContentPagesPageProps> = ({ onNavigate }) => {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error('Error fetching content pages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getPageIcon = (slug: string) => {
    const icons: Record<string, string> = {
      terms: '📜',
      privacy: '🔒',
      shipping: '🚚',
      returns: '↩️',
    };
    return icons[slug] || '📄';
  };

  const handleEditPage = (page: ContentPage) => {
    if (onNavigate) {
      onNavigate('content-edit', { slug: page.slug });
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Content Pages</h1>
          <p className="text-slate-400 mt-1">
            Manage static content pages like Terms, Privacy, and Shipping policies.
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {pages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-500 text-5xl mb-4">📄</div>
              <h3 className="text-lg font-medium text-white mb-2">No Content Pages</h3>
              <p className="text-slate-400">
                Run the SQL migration to create default content pages.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="p-6 hover:bg-slate-700/30 transition-colors cursor-pointer group"
                  onClick={() => handleEditPage(page)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{getPageIcon(page.slug)}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {page.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-400">
                            /{page.slug}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-sm text-slate-400">
                            Updated {formatDate(page.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-lg ${
                          page.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-600/50 text-slate-400'
                        }`}
                      >
                        {page.is_active ? 'Published' : 'Draft'}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPage(page);
                        }}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>

                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-slate-300 transition-colors">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-2">Content Guidelines</h4>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Content supports Markdown formatting (headings, bold, links, etc.)</li>
            <li>• Keep legal pages clear and easy to understand</li>
            <li>• Update timestamps are tracked automatically</li>
          </ul>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default ContentPagesPage;
