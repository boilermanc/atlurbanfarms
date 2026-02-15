import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Trash2, FileText } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  author_name: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  featured_image_url: string | null;
}

interface BlogListPageProps {
  onEditPost: (postId: string) => void;
  onCreatePost: () => void;
}

const BlogListPage: React.FC<BlogListPageProps> = ({ onEditPost, onCreatePost }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deleteModalPost, setDeleteModalPost] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      // Use service-level select - RLS admin policy allows full access
      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' && post.is_published) ||
        (statusFilter === 'draft' && !post.is_published);
      return matchesSearch && matchesStatus;
    });
  }, [posts, searchQuery, statusFilter]);

  const handleDelete = async () => {
    if (!deleteModalPost) return;
    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', deleteModalPost.id);
      if (deleteError) throw deleteError;
      setDeleteModalPost(null);
      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-admin-display">Blog Posts</h2>
          <p className="text-slate-500 text-sm mt-1">{posts.length} total posts</p>
        </div>
        <button
          onClick={onCreatePost}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Create Post
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Table */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No blog posts found</h3>
          <p className="text-slate-500 text-sm mb-4">
            {posts.length === 0 ? 'Create your first blog post to get started.' : 'Try adjusting your search or filters.'}
          </p>
          {posts.length === 0 && (
            <button
              onClick={onCreatePost}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors text-sm"
            >
              <Plus size={16} />
              Create Post
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPosts.map((post) => (
                <tr
                  key={post.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onEditPost(post.id)}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {post.featured_image_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          <img src={post.featured_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{post.title}</p>
                        {post.excerpt && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{post.excerpt}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {post.category ? (
                      <span className="text-sm text-slate-600">{post.category}</span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {post.is_published ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-slate-600">
                      {post.is_published ? formatDate(post.published_at) : formatDate(post.created_at)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEditPost(post.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteModalPost(post)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Blog Post</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete <strong>{deleteModalPost.title}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalPost(null)}
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

export default BlogListPage;
