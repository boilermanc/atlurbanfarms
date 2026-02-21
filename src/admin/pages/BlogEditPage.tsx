import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Upload, Trash2, Save, Code, Eye, ImagePlus, MonitorPlay, Copy, Check } from 'lucide-react';
import DOMPurify from 'dompurify';
import RichTextEditor from '../components/RichTextEditor';
import { useAdminAuth } from '../hooks/useAdminAuth';

type EditorMode = 'visual' | 'html' | 'preview';

interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  featured_image_url: string | null;
}

interface BlogEditPageProps {
  postId: string | null;
  onBack: () => void;
  onSave: () => void;
}

const generateSlug = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const BlogEditPage: React.FC<BlogEditPageProps> = ({ postId, onBack, onSave }) => {
  const isEditMode = Boolean(postId);
  const { adminUser } = useAdminAuth();
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [uploadingHtmlImage, setUploadingHtmlImage] = useState(false);
  const [uploadingForUrl, setUploadingForUrl] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const htmlImageInputRef = useRef<HTMLInputElement>(null);
  const urlImageInputRef = useRef<HTMLInputElement>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState<BlogFormData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: '',
    author_name: adminUser?.email || '',
    is_published: false,
    published_at: null,
    featured_image_url: null,
  });

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;
      if (data) {
        setFormData({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          content: data.content || '',
          category: data.category || '',
          author_name: data.author_name || '',
          is_published: data.is_published || false,
          published_at: data.published_at || null,
          featured_image_url: data.featured_image_url || null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isEditMode) {
      fetchPost();
    }
  }, [isEditMode, fetchPost]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setError(null);

    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'title' && !isEditMode) {
        newData.slug = generateSlug(value);
      }
      return newData;
    });
  };

  const handlePublishToggle = () => {
    setFormData(prev => {
      const newPublished = !prev.is_published;
      return {
        ...prev,
        is_published: newPublished,
        published_at: newPublished && !prev.published_at ? new Date().toISOString() : prev.published_at,
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const file = files[0];

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      }

      // Validate file extension
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        throw new Error('Invalid file extension. Please upload JPG, PNG, GIF, or WebP images.');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image file is too large. Maximum size is 5MB.');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('blog-media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('blog-media').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, featured_image_url: publicUrl }));
    } catch (err: any) {
      const message = err?.message || 'Failed to upload image';
      if (message.includes('bucket') && message.includes('not found')) {
        setError('Storage bucket not configured. Please check Supabase Storage settings.');
      } else if (message.includes('Payload too large') || message.includes('file size')) {
        setError('Image file is too large. Maximum size is 5MB.');
      } else {
        setError(message);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, featured_image_url: null }));
  };

  const handleHtmlImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingHtmlImage(true);
    setError(null);

    try {
      const file = files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image file is too large. Maximum size is 5MB.');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('blog-media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('blog-media').getPublicUrl(filePath);
      const imgTag = `<img src="${publicUrl}" alt="${file.name}" />`;

      // Insert at cursor position in textarea
      const textarea = htmlTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentContent = formData.content;
        const newContent = currentContent.substring(0, start) + imgTag + currentContent.substring(end);
        setFormData(prev => ({ ...prev, content: newContent }));
        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + imgTag.length;
          textarea.focus();
        });
      } else {
        // Fallback: append to end
        setFormData(prev => ({ ...prev, content: prev.content + imgTag }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image');
    } finally {
      setUploadingHtmlImage(false);
      e.target.value = '';
    }
  };

  const handleUploadForUrl = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingForUrl(true);
    setError(null);

    try {
      const file = files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image file is too large. Maximum size is 5MB.');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('blog-media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('blog-media').getPublicUrl(filePath);
      setUploadedUrls(prev => [publicUrl, ...prev]);

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(publicUrl);
      setCopiedUrl(publicUrl);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image');
    } finally {
      setUploadingForUrl(false);
      e.target.value = '';
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback: select a temporary input
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.slug.trim()) {
      setError('Slug is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const postData = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim() || null,
        content: formData.content || null,
        featured_image_url: formData.featured_image_url || null,
        category: formData.category.trim() || null,
        author_name: formData.author_name.trim() || null,
        is_published: formData.is_published,
        published_at: formData.is_published ? (formData.published_at || new Date().toISOString()) : null,
      };

      if (isEditMode && postId) {
        const { error: updateError } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', postId);
        if (updateError) throw updateError;
        onSave();
      } else {
        const { error: insertError } = await supabase
          .from('blog_posts')
          .insert(postData);
        if (insertError) throw insertError;
        onSave();
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to save post';
      if (message.includes('duplicate key') && message.includes('slug')) {
        setError('A post with this slug already exists. Please use a different slug.');
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!postId) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);
      if (deleteError) throw deleteError;
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 font-admin-display">
              {isEditMode ? 'Edit Blog Post' : 'Create Blog Post'}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEditMode && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium transition-colors text-sm"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isEditMode ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter post title..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Slug</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="post-url-slug"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Excerpt */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <label className="block text-sm font-medium text-slate-700 mb-2">Excerpt</label>
              <textarea
                name="excerpt"
                value={formData.excerpt}
                onChange={handleChange}
                placeholder="Short preview text for blog listing..."
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">Content</label>
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditorMode('visual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      editorMode === 'visual'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Eye size={14} />
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('html')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      editorMode === 'html'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Code size={14} />
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      editorMode === 'preview'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MonitorPlay size={14} />
                    Preview
                  </button>
                </div>
              </div>

              {editorMode === 'visual' && (
                <RichTextEditor
                  value={formData.content}
                  onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
                  placeholder="Write your blog post content..."
                />
              )}

              {editorMode === 'html' && (
                <div>
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <input
                      ref={htmlImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleHtmlImageUpload}
                      className="hidden"
                    />
                    <input
                      ref={urlImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleUploadForUrl}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => htmlImageInputRef.current?.click()}
                      disabled={uploadingHtmlImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                      title="Upload and insert <img> tag at cursor"
                    >
                      {uploadingHtmlImage ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ImagePlus size={14} />
                      )}
                      Insert Image
                    </button>
                    <div className="w-px h-5 bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => urlImageInputRef.current?.click()}
                      disabled={uploadingForUrl}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                      title="Upload image and copy URL to clipboard"
                    >
                      {uploadingForUrl ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      Upload &amp; Copy URL
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Upload an image and get the URL to paste into your HTML
                    </span>
                  </div>

                  {/* Uploaded URLs list */}
                  {uploadedUrls.length > 0 && (
                    <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Uploaded Images ({uploadedUrls.length})
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {uploadedUrls.map((url) => (
                          <div key={url} className="flex items-center gap-2 group">
                            <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-slate-200" />
                            <code className="flex-1 text-[11px] text-slate-500 truncate font-mono">
                              {url}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(url)}
                              className="flex-shrink-0 p-1 text-slate-400 hover:text-emerald-600 rounded transition-colors"
                              title="Copy URL"
                            >
                              {copiedUrl === url ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={htmlTextareaRef}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="<p>Paste your HTML content here...</p>"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
                    rows={20}
                    spellCheck={false}
                  />
                </div>
              )}

              {editorMode === 'preview' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {formData.content ? (
                    <div className="p-6 md:p-8 bg-white min-h-[300px]">
                      <div
                        className="prose prose-lg max-w-none
                          prose-headings:font-bold prose-headings:text-gray-900
                          prose-p:text-gray-600 prose-p:leading-relaxed
                          prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
                          prose-strong:text-gray-800
                          prose-img:rounded-2xl prose-img:shadow-md
                          prose-ul:text-gray-600 prose-ol:text-gray-600
                          prose-blockquote:border-emerald-500 prose-blockquote:text-gray-500
                          prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm
                          [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:rounded-2xl [&_iframe]:my-4"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formData.content, {
                          ADD_TAGS: ['iframe'],
                          ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src', 'width', 'height', 'title', 'style'],
                          ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
                        }) }}
                      />
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 text-sm">
                      No content to preview. Switch to Visual or HTML mode to add content.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Publish Status */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Status</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {formData.is_published ? 'Published' : 'Draft'}
                  </p>
                  {formData.published_at && formData.is_published && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(formData.published_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePublishToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_published ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_published ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Featured Image */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Featured Image</h3>
              {formData.featured_image_url ? (
                <div className="relative group rounded-xl overflow-hidden">
                  <img
                    src={formData.featured_image_url}
                    alt="Featured"
                    className="w-full aspect-video object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="featured-image-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="featured-image-upload" className="cursor-pointer">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={20} className="text-slate-400" />
                      )}
                    </div>
                    <p className="text-slate-600 text-sm font-medium">Click to upload</p>
                    <p className="text-slate-400 text-xs mt-1">PNG, JPG up to 5MB</p>
                  </label>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g. Growing Tips, News..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Author */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Author</label>
              <input
                type="text"
                name="author_name"
                value={formData.author_name}
                onChange={handleChange}
                placeholder="Author name"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Blog Post</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this post? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default BlogEditPage;
