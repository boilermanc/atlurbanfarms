import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import RichTextEditor from '../components/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, FileText, Check, AlertCircle } from 'lucide-react';

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
  contentId?: string | null;
  onBack?: () => void;
  onSave?: () => void;
}

const ContentEditPage: React.FC<ContentEditPageProps> = ({ contentId, onBack, onSave }) => {
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_active: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPage = useCallback(async () => {
    if (!contentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .eq('id', contentId)
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
  }, [contentId]);

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
    setError(null);
    setSaveSuccess(false);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('content_pages')
        .update({
          title: formData.title,
          content: formData.content,
          is_active: formData.is_active,
          updated_by: userData.user?.id || null,
        })
        .eq('id', page.id);

      if (updateError) throw updateError;

      await fetchPage();
      setHasChanges(false);
      setSaveSuccess(true);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving content page:', err);
      setError(err instanceof Error ? err.message : 'Failed to save content page');
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
    if (onBack) {
      onBack();
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

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  if (!page) {
    return (
      <AdminPageWrapper>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">Page Not Found</h3>
            <p className="text-slate-500 mb-6">
              The content page you're looking for doesn't exist.
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Edit {page.title}</h1>
              <p className="text-slate-500 text-sm mt-1">
                Last updated {formatDate(page.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Page Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Enter page title..."
            />
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Content
            </label>
            <RichTextEditor
              value={formData.content}
              onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
              placeholder="Enter page content..."
            />
          </div>

          {/* Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Settings</h3>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Published
                </label>
                <p className="text-sm text-slate-500 mt-1">
                  When enabled, this page is visible to customers
                </p>
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Slug:</span>
                  <span className="text-slate-800 ml-2 font-medium">/{page.slug}</span>
                </div>
                <div>
                  <span className="text-slate-500">Created:</span>
                  <span className="text-slate-800 ml-2">{formatDate(page.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Toast notifications */}
        {saveSuccess && (
          <div className="fixed bottom-6 right-6 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl font-medium shadow-lg border border-emerald-200 flex items-center gap-2 z-50">
            <Check size={18} />
            Changes saved successfully
          </div>
        )}
        {error && (
          <div className="fixed bottom-6 right-6 bg-red-100 text-red-800 px-4 py-2 rounded-xl font-medium shadow-lg border border-red-200 flex items-center gap-2 z-50">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {hasChanges && !saveSuccess && !error && (
          <div className="fixed bottom-6 right-6 bg-amber-100 text-amber-800 px-4 py-2 rounded-xl font-medium shadow-lg border border-amber-200">
            You have unsaved changes
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default ContentEditPage;
