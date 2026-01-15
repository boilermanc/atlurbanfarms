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

interface ContentEditPageProps {
  slug?: string;
  onNavigate?: (page: string) => void;
}

const ContentEditPage: React.FC<ContentEditPageProps> = ({ slug, onNavigate }) => {
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_active: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPage = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;

      setPage(data);
      setFormData({
        title: data.title,
        content: data.content,
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('Error fetching content page:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    if (page) {
      const changed =
        formData.title !== page.title ||
        formData.content !== page.content ||
        formData.is_active !== page.is_active;
      setHasChanges(changed);
    }
  }, [formData, page]);

  const handleSave = async () => {
    if (!page) return;

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('content_pages')
        .update({
          title: formData.title,
          content: formData.content,
          is_active: formData.is_active,
          updated_by: userData.user?.id || null,
        })
        .eq('id', page.id);

      if (error) throw error;

      await fetchPage();
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving content page:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
        return;
      }
    }
    if (onNavigate) {
      onNavigate('content-pages');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Simple markdown to HTML converter
  const renderMarkdown = (text: string) => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-white mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      // Bold and Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-emerald-400 hover:underline" target="_blank">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="text-slate-300 mb-4">')
      .replace(/\n/g, '<br/>');

    return `<p class="text-slate-300 mb-4">${html}</p>`;
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

  if (!page) {
    return (
      <AdminPageWrapper>
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800 rounded-xl p-12 text-center">
            <div className="text-slate-500 text-5xl mb-4">404</div>
            <h3 className="text-lg font-medium text-white mb-2">Page Not Found</h3>
            <p className="text-slate-400 mb-6">
              The content page you're looking for doesn't exist.
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Back to Content Pages
            </button>
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Edit {page.title}</h1>
              <p className="text-slate-400 text-sm mt-1">
                Last updated {formatDate(page.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showPreview
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Title */}
          <div className="bg-slate-800 rounded-xl p-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Page Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter page title..."
            />
          </div>

          {/* Content */}
          <div className="bg-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Content
              </label>
              <span className="text-xs text-slate-500">Supports Markdown</span>
            </div>

            {showPreview ? (
              <div className="bg-slate-900 rounded-lg p-6 min-h-[400px] prose prose-invert max-w-none">
                <div
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(formData.content) }}
                />
              </div>
            ) : (
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={20}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm resize-none"
                placeholder="Enter page content using Markdown..."
              />
            )}
          </div>

          {/* Settings */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-white">
                  Published
                </label>
                <p className="text-sm text-slate-400 mt-1">
                  When enabled, this page is visible to customers
                </p>
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Slug:</span>
                  <span className="text-white ml-2">/{page.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400">Created:</span>
                  <span className="text-white ml-2">{formatDate(page.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Markdown Help */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-3">Markdown Reference</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <code className="text-emerald-400"># Heading 1</code>
                <p className="text-slate-400 mt-1">Large heading</p>
              </div>
              <div>
                <code className="text-emerald-400">## Heading 2</code>
                <p className="text-slate-400 mt-1">Medium heading</p>
              </div>
              <div>
                <code className="text-emerald-400">**bold**</code>
                <p className="text-slate-400 mt-1">Bold text</p>
              </div>
              <div>
                <code className="text-emerald-400">*italic*</code>
                <p className="text-slate-400 mt-1">Italic text</p>
              </div>
              <div>
                <code className="text-emerald-400">[text](url)</code>
                <p className="text-slate-400 mt-1">Link</p>
              </div>
              <div>
                <code className="text-emerald-400">Blank line</code>
                <p className="text-slate-400 mt-1">New paragraph</p>
              </div>
            </div>
          </div>
        </div>

        {/* Unsaved changes indicator */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-amber-500/90 text-amber-900 px-4 py-2 rounded-lg font-medium shadow-lg">
            You have unsaved changes
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default ContentEditPage;
