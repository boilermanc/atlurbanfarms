import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useProductTags, ProductTag } from '../hooks/useProductTags';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Tag, X, Check, Search } from 'lucide-react';

interface TagWithCount extends ProductTag {
  product_count: number;
}

const ProductTagsPage: React.FC = () => {
  const { tags, loading, error, createTag, updateTag, deleteTag, refetch } = useProductTags();
  const [tagsWithCounts, setTagsWithCounts] = useState<TagWithCount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ProductTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [filterType, setFilterType] = useState<string>('');

  // Known tag types from the database
  const TAG_TYPES = ['attribute', 'difficulty', 'growing', 'system', 'type', 'use'];

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTagType, setFormTagType] = useState('');

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Fetch product counts for each tag
  const fetchProductCounts = useCallback(async () => {
    if (tags.length === 0) {
      setTagsWithCounts([]);
      return;
    }

    try {
      const { data: assignments, error: assignError } = await supabase
        .from('product_tag_assignments')
        .select('tag_id');

      if (assignError) throw assignError;

      // Count products per tag
      const countMap: Record<string, number> = {};
      (assignments || []).forEach((a: { tag_id: string }) => {
        countMap[a.tag_id] = (countMap[a.tag_id] || 0) + 1;
      });

      setTagsWithCounts(
        tags.map(tag => ({
          ...tag,
          product_count: countMap[tag.id] || 0
        }))
      );
    } catch (err) {
      console.error('Error fetching product counts:', err);
      setTagsWithCounts(tags.map(tag => ({ ...tag, product_count: 0 })));
    }
  }, [tags]);

  useEffect(() => {
    fetchProductCounts();
  }, [fetchProductCounts]);

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingTag) {
      setFormSlug(generateSlug(name));
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormTagType('');
    setShowAddForm(false);
    setEditingTag(null);
  };

  const handleEdit = (tag: ProductTag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormSlug(tag.slug);
    setFormDescription(tag.description || '');
    setFormTagType(tag.tag_type || '');
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) return;

    setSaving(true);
    try {
      if (editingTag) {
        const result = await updateTag(editingTag.id, {
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          tag_type: formTagType || null
        });
        if (!result.success) {
          alert(result.error || 'Failed to update tag');
          return;
        }
      } else {
        const result = await createTag(
          formName.trim(),
          formSlug.trim(),
          formDescription.trim() || undefined,
          formTagType || undefined
        );
        if (!result.success) {
          alert(result.error || 'Failed to create tag');
          return;
        }
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagWithCount) => {
    if (tag.product_count > 0) {
      if (!confirm(`This tag is assigned to ${tag.product_count} product(s). Deleting it will remove the tag from all products. Continue?`)) {
        return;
      }
    } else {
      if (!confirm('Are you sure you want to delete this tag?')) {
        return;
      }
    }

    const result = await deleteTag(tag.id);
    if (!result.success) {
      alert(result.error || 'Failed to delete tag');
    }
  };

  const filteredTags = tagsWithCounts.filter(tag => {
    const matchesSearch = !searchQuery ||
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || tag.tag_type === filterType;
    return matchesSearch && matchesType;
  });

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Product Tags</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage tags for organizing and filtering products
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              <Plus size={20} />
              Add Tag
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">
                {editingTag ? 'Edit Tag' : 'Add New Tag'}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Organic, Best Seller"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g., organic, best-seller"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">URL-friendly identifier</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tag Type
                </label>
                <select
                  value={formTagType}
                  onChange={(e) => setFormTagType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                >
                  <option value="">No type</option>
                  {TAG_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Groups tags on the product detail page</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description for this tag..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formSlug.trim() || saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                {editingTag ? 'Save Changes' : 'Create Tag'}
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {tagsWithCounts.length > 0 && (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            >
              <option value="">All Types</option>
              {TAG_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tags List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {filteredTags.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {searchQuery ? 'No Tags Found' : 'No Product Tags Yet'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery
                  ? `No tags match "${searchQuery}"`
                  : 'Get started by creating your first product tag.'}
              </p>
              {!searchQuery && !showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Add Your First Tag
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tag Name
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Slug
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Products
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTags.map((tag) => (
                    <tr key={tag.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                          <span className="font-medium text-slate-800">{tag.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {tag.slug}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        {tag.tag_type ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {tag.tag_type.charAt(0).toUpperCase() + tag.tag_type.slice(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-500 text-sm">
                          {tag.description || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          tag.product_count > 0
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {tag.product_count}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tag)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(tag)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {tagsWithCounts.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>{tagsWithCounts.length} total tags</span>
            <span>{tagsWithCounts.filter(t => t.product_count > 0).length} in use</span>
            <span>{tagsWithCounts.reduce((sum, t) => sum + t.product_count, 0)} total assignments</span>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default ProductTagsPage;
