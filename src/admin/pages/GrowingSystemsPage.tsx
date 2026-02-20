import React, { useState, useRef, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useGrowingSystems, GrowingSystem } from '../hooks/useGrowingSystems';
import { Plus, Edit2, Trash2, Sprout, X, Check, Search, ExternalLink } from 'lucide-react';

const GrowingSystemsPage: React.FC = () => {
  const { systems, loading, error, createSystem, updateSystem, deleteSystem } = useGrowingSystems();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<GrowingSystem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  useEffect(() => {
    if (editingSystem && showAddForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingSystem, showAddForm]);

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingSystem) {
      setFormSlug(generateSlug(name));
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormLogoUrl('');
    setFormWebsiteUrl('');
    setFormSortOrder(0);
    setFormIsActive(true);
    setShowAddForm(false);
    setEditingSystem(null);
  };

  const handleEdit = (system: GrowingSystem) => {
    setEditingSystem(system);
    setFormName(system.name);
    setFormSlug(system.slug);
    setFormDescription(system.description || '');
    setFormLogoUrl(system.logo_url || '');
    setFormWebsiteUrl(system.website_url || '');
    setFormSortOrder(system.sort_order);
    setFormIsActive(system.is_active);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) return;

    setSaving(true);
    try {
      if (editingSystem) {
        const result = await updateSystem(editingSystem.id, {
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          logo_url: formLogoUrl.trim() || null,
          website_url: formWebsiteUrl.trim() || null,
          sort_order: formSortOrder,
          is_active: formIsActive,
        });
        if (!result.success) {
          alert(result.error || 'Failed to update system');
          return;
        }
      } else {
        const result = await createSystem({
          name: formName.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          logo_url: formLogoUrl.trim() || null,
          website_url: formWebsiteUrl.trim() || null,
          sort_order: formSortOrder,
          is_active: formIsActive,
        });
        if (!result.success) {
          alert(result.error || 'Failed to create system');
          return;
        }
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (system: GrowingSystem) => {
    if (!confirm(`Are you sure you want to delete "${system.name}"?`)) return;

    const result = await deleteSystem(system.id);
    if (!result.success) {
      alert(result.error || 'Failed to delete system');
    }
  };

  const handleToggleActive = async (system: GrowingSystem) => {
    const result = await updateSystem(system.id, { is_active: !system.is_active });
    if (!result.success) {
      alert(result.error || 'Failed to toggle status');
    }
  };

  const filteredSystems = systems.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
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
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Growing Systems</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage hydroponic and aeroponic growing systems
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              <Plus size={20} />
              Add System
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
          <div ref={formRef} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">
                {editingSystem ? 'Edit System' : 'Add New System'}
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
                  System Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Tower Garden"
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
                  placeholder="e.g., tower-garden"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">URL-friendly identifier</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Website URL
                </label>
                <input
                  type="url"
                  value={formWebsiteUrl}
                  onChange={(e) => setFormWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">Lower numbers appear first</p>
              </div>

              <div className="flex items-center gap-3 pt-7">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formIsActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formIsActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-slate-700">
                  {formIsActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description for this growing system..."
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none"
              />
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
                {editingSystem ? 'Save Changes' : 'Create System'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        {systems.length > 0 && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search growing systems..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>
        )}

        {/* Systems List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {filteredSystems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sprout size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {searchQuery ? 'No Systems Found' : 'No Growing Systems Yet'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery
                  ? `No systems match "${searchQuery}"`
                  : 'Get started by adding your first growing system.'}
              </p>
              {!searchQuery && !showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Add Your First System
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      System Name
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Slug
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Order
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSystems.map((system) => (
                    <tr key={system.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${system.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          <span className="font-medium text-slate-800">{system.name}</span>
                          {system.website_url && (
                            <a
                              href={system.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-emerald-500 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                        {system.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                            {system.description}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {system.slug}
                        </code>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-slate-600">{system.sort_order}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(system)}
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer transition-colors ${
                            system.is_active
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {system.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(system)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(system)}
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
        {systems.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>{systems.length} total systems</span>
            <span>{systems.filter(s => s.is_active).length} active</span>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default GrowingSystemsPage;
