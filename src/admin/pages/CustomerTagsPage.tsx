import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useCustomerTags } from '../hooks/useCustomerTags';
import { CustomerTag, TAG_COLOR_CONFIG } from '../types/customer';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Users, X, Check, Search } from 'lucide-react';

interface TagWithCount extends CustomerTag {
  customer_count: number;
}

const COLOR_OPTIONS: CustomerTag['color'][] = [
  'emerald', 'blue', 'purple', 'amber', 'red', 'pink', 'indigo', 'slate', 'teal', 'cyan'
];

const CustomerTagsPage: React.FC = () => {
  const { tags, loading, error, createTag, updateTag, deleteTag, refetch } = useCustomerTags();
  const [tagsWithCounts, setTagsWithCounts] = useState<TagWithCount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomerTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState<CustomerTag['color']>('emerald');
  const [formDescription, setFormDescription] = useState('');

  // Fetch customer counts for each tag
  const fetchCustomerCounts = useCallback(async () => {
    if (tags.length === 0) {
      setTagsWithCounts([]);
      return;
    }

    try {
      const { data: assignments, error: assignError } = await supabase
        .from('customer_tag_assignments')
        .select('tag_id');

      if (assignError) throw assignError;

      // Count customers per tag
      const countMap: Record<string, number> = {};
      (assignments || []).forEach((a: { tag_id: string }) => {
        countMap[a.tag_id] = (countMap[a.tag_id] || 0) + 1;
      });

      setTagsWithCounts(
        tags.map(tag => ({
          ...tag,
          customer_count: countMap[tag.id] || 0
        }))
      );
    } catch (err) {
      console.error('Error fetching customer counts:', err);
      setTagsWithCounts(tags.map(tag => ({ ...tag, customer_count: 0 })));
    }
  }, [tags]);

  useEffect(() => {
    fetchCustomerCounts();
  }, [fetchCustomerCounts]);

  const resetForm = () => {
    setFormName('');
    setFormColor('emerald');
    setFormDescription('');
    setShowAddForm(false);
    setEditingTag(null);
  };

  const handleEdit = (tag: CustomerTag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormDescription(tag.description || '');
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    setSaving(true);
    try {
      if (editingTag) {
        const result = await updateTag(editingTag.id, {
          name: formName.trim(),
          color: formColor,
          description: formDescription.trim() || null
        });
        if (!result.success) {
          alert(result.error || 'Failed to update tag');
          return;
        }
      } else {
        const result = await createTag(
          formName.trim(),
          formColor,
          formDescription.trim() || undefined
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
    if (tag.customer_count > 0) {
      if (!confirm(`This tag is assigned to ${tag.customer_count} customer(s). Deleting it will remove the tag from all customers. Continue?`)) {
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

  const filteredTags = tagsWithCounts.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Customer Tags</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage tags for segmenting and organizing customers
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., VIP, Wholesale, School"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => {
                    const config = TAG_COLOR_CONFIG[color];
                    const isSelected = formColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormColor(color)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                          config.badgeClass
                        } ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-slate-400'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
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
                disabled={!formName.trim() || saving}
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

        {/* Search */}
        {tagsWithCounts.length > 0 && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>
        )}

        {/* Tags List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {filteredTags.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {searchQuery ? 'No Tags Found' : 'No Customer Tags Yet'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery
                  ? `No tags match "${searchQuery}"`
                  : 'Get started by creating your first customer tag.'}
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
                      Tag
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Customers
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTags.map((tag) => {
                    const colorConfig = TAG_COLOR_CONFIG[tag.color];
                    return (
                      <tr key={tag.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-lg border ${colorConfig.badgeClass}`}>
                            {tag.name}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-slate-500 text-sm">
                            {tag.description || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            tag.customer_count > 0
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {tag.customer_count}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {tagsWithCounts.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>{tagsWithCounts.length} total tags</span>
            <span>{tagsWithCounts.filter(t => t.customer_count > 0).length} in use</span>
            <span>{tagsWithCounts.reduce((sum, t) => sum + t.customer_count, 0)} total assignments</span>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default CustomerTagsPage;
