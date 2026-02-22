import React, { useState, useRef, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useGrowingInterests, GrowingInterestOption } from '../hooks/useGrowingInterests';
import { Plus, Edit2, Trash2, Heart, X, Check, Search } from 'lucide-react';

const generateValue = (label: string) => {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
};

const GrowingInterestsPage: React.FC = () => {
  const { interests, loading, error, createInterest, updateInterest, deleteInterest } = useGrowingInterests();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInterest, setEditingInterest] = useState<GrowingInterestOption | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    if (editingInterest && showAddForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingInterest, showAddForm]);

  const handleLabelChange = (label: string) => {
    setFormLabel(label);
    if (!editingInterest) {
      setFormValue(generateValue(label));
    }
  };

  const resetForm = () => {
    setFormLabel('');
    setFormValue('');
    setFormSortOrder(0);
    setFormIsActive(true);
    setShowAddForm(false);
    setEditingInterest(null);
  };

  const handleEdit = (interest: GrowingInterestOption) => {
    setEditingInterest(interest);
    setFormLabel(interest.label);
    setFormValue(interest.value);
    setFormSortOrder(interest.sort_order);
    setFormIsActive(interest.is_active);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim() || !formValue.trim()) return;

    setSaving(true);
    try {
      if (editingInterest) {
        const result = await updateInterest(editingInterest.id, {
          label: formLabel.trim(),
          value: formValue.trim(),
          sort_order: formSortOrder,
          is_active: formIsActive,
        });
        if (!result.success) {
          alert(result.error || 'Failed to update interest');
          return;
        }
      } else {
        const result = await createInterest({
          label: formLabel.trim(),
          value: formValue.trim(),
          sort_order: formSortOrder,
          is_active: formIsActive,
        });
        if (!result.success) {
          alert(result.error || 'Failed to create interest');
          return;
        }
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (interest: GrowingInterestOption) => {
    if (!confirm(`Are you sure you want to delete "${interest.label}"?`)) return;

    const result = await deleteInterest(interest.id);
    if (!result.success) {
      alert(result.error || 'Failed to delete interest');
    }
  };

  const handleToggleActive = async (interest: GrowingInterestOption) => {
    const result = await updateInterest(interest.id, { is_active: !interest.is_active });
    if (!result.success) {
      alert(result.error || 'Failed to toggle status');
    }
  };

  const filteredInterests = interests.filter(i => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q);
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
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Growing Interests</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage plant interest categories shown on customer profiles
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              <Plus size={20} />
              Add Interest
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
                {editingInterest ? 'Edit Interest' : 'Add New Interest'}
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
                  Label *
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g., Native Plants"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Value *
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="e.g., native_plants"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">Stored identifier (auto-generated from label)</p>
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

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formLabel.trim() || !formValue.trim() || saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                {editingInterest ? 'Save Changes' : 'Create Interest'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        {interests.length > 0 && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search growing interests..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>
        )}

        {/* Interests List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {filteredInterests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {searchQuery ? 'No Interests Found' : 'No Growing Interests Yet'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery
                  ? `No interests match "${searchQuery}"`
                  : 'Get started by adding your first growing interest.'}
              </p>
              {!searchQuery && !showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Add Your First Interest
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Label
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Value
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
                  {filteredInterests.map((interest) => (
                    <tr key={interest.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${interest.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          <span className="font-medium text-slate-800">{interest.label}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {interest.value}
                        </code>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-slate-600">{interest.sort_order}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(interest)}
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer transition-colors ${
                            interest.is_active
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {interest.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(interest)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(interest)}
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
        {interests.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>{interests.length} total interests</span>
            <span>{interests.filter(i => i.is_active).length} active</span>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default GrowingInterestsPage;
