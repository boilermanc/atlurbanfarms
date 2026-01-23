import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { FileText, ScrollText, Lock, Truck, RotateCcw, Edit2, ChevronRight } from 'lucide-react';

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
    switch (slug) {
      case 'terms':
        return <ScrollText size={24} className="text-slate-500" />;
      case 'privacy':
        return <Lock size={24} className="text-slate-500" />;
      case 'shipping':
        return <Truck size={24} className="text-slate-500" />;
      case 'returns':
        return <RotateCcw size={24} className="text-slate-500" />;
      default:
        return <FileText size={24} className="text-slate-500" />;
    }
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
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Content Pages</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage static content pages like Terms, Privacy, and Shipping policies.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {pages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Content Pages</h3>
              <p className="text-slate-500">
                Run the SQL migration to create default content pages.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => handleEditPage(page)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                        {getPageIcon(page.slug)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                          {page.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500">
                            /{page.slug}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-sm text-slate-500">
                            Updated {formatDate(page.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          page.is_active
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {page.is_active ? 'Published' : 'Draft'}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPage(page);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 size={20} />
                      </button>

                      <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60">
          <h4 className="text-sm font-semibold text-slate-800 mb-3">Content Guidelines</h4>
          <ul className="text-sm text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              Content supports Markdown formatting (headings, bold, links, etc.)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              Keep legal pages clear and easy to understand
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              Update timestamps are tracked automatically
            </li>
          </ul>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default ContentPagesPage;
