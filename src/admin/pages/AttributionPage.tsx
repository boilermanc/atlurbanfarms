import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface AttributionOption {
  id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { label: string; value: string; is_active: boolean }) => Promise<void>;
  option: AttributionOption | null;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, option }) => {
  const [formData, setFormData] = useState({
    label: '',
    value: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ label?: string; value?: string }>({});

  useEffect(() => {
    if (option) {
      setFormData({
        label: option.label,
        value: option.value,
        is_active: option.is_active,
      });
    } else {
      setFormData({
        label: '',
        value: '',
        is_active: true,
      });
    }
    setErrors({});
  }, [option, isOpen]);

  const generateValue = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  };

  const handleLabelChange = (label: string) => {
    setFormData(prev => ({
      ...prev,
      label,
      value: !option ? generateValue(label) : prev.value,
    }));
  };

  const validate = (): boolean => {
    const newErrors: { label?: string; value?: string } = {};

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
    }

    if (!formData.value.trim()) {
      newErrors.value = 'Value is required';
    } else if (!/^[a-z0-9_]+$/.test(formData.value)) {
      newErrors.value = 'Value must be lowercase letters, numbers, and underscores only';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4"
          >
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {option ? 'Edit Option' : 'Add Attribution Option'}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Label <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.label ? 'border-red-500' : 'border-slate-600'
                  }`}
                  placeholder="e.g., Social Media"
                />
                {errors.label && (
                  <p className="mt-1 text-sm text-red-400">{errors.label}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Value (slug) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  className={`w-full px-4 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.value ? 'border-red-500' : 'border-slate-600'
                  }`}
                  placeholder="e.g., social_media"
                  disabled={!!option}
                />
                {errors.value && (
                  <p className="mt-1 text-sm text-red-400">{errors.value}</p>
                )}
                {option && (
                  <p className="mt-1 text-xs text-slate-500">Value cannot be changed after creation</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-300">
                  Active (visible to customers)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : option ? 'Update' : 'Add Option'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AttributionPage: React.FC = () => {
  const [options, setOptions] = useState<AttributionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<AttributionOption | null>(null);
  const [draggedItem, setDraggedItem] = useState<AttributionOption | null>(null);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attribution_options')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Error fetching attribution options:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSave = async (data: { label: string; value: string; is_active: boolean }) => {
    try {
      if (editingOption) {
        const { error } = await supabase
          .from('attribution_options')
          .update({
            label: data.label,
            is_active: data.is_active,
          })
          .eq('id', editingOption.id);

        if (error) throw error;
      } else {
        const maxOrder = options.length > 0 ? Math.max(...options.map(o => o.sort_order)) : 0;
        const { error } = await supabase
          .from('attribution_options')
          .insert({
            label: data.label,
            value: data.value,
            is_active: data.is_active,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
      }

      await fetchOptions();
    } catch (error) {
      console.error('Error saving option:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;

    try {
      const { error } = await supabase.from('attribution_options').delete().eq('id', id);
      if (error) throw error;
      setOptions(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Error deleting option:', error);
    }
  };

  const handleToggleActive = async (option: AttributionOption) => {
    try {
      const { error } = await supabase
        .from('attribution_options')
        .update({ is_active: !option.is_active })
        .eq('id', option.id);

      if (error) throw error;

      setOptions(prev =>
        prev.map(o => (o.id === option.id ? { ...o, is_active: !o.is_active } : o))
      );
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, option: AttributionOption) => {
    setDraggedItem(option);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetOption: AttributionOption) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.id === targetOption.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = options.findIndex(o => o.id === draggedItem.id);
    const targetIndex = options.findIndex(o => o.id === targetOption.id);

    const newOptions = [...options];
    newOptions.splice(draggedIndex, 1);
    newOptions.splice(targetIndex, 0, draggedItem);

    const updatedOptions = newOptions.map((opt, index) => ({
      ...opt,
      sort_order: index + 1,
    }));

    setOptions(updatedOptions);
    setDraggedItem(null);

    try {
      for (const opt of updatedOptions) {
        await supabase
          .from('attribution_options')
          .update({ sort_order: opt.sort_order })
          .eq('id', opt.id);
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      fetchOptions();
    }
  };

  const handleEdit = (option: AttributionOption) => {
    setEditingOption(option);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingOption(null);
    setModalOpen(true);
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Attribution Options</h1>
            <p className="text-slate-400 mt-1">
              Manage "How did you hear about us?" options. Drag to reorder.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Option
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {options.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-500 text-5xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-white mb-2">No Attribution Options</h3>
              <p className="text-slate-400 mb-6">
                Add options for customers to tell you how they found you.
              </p>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Add First Option
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {options.map((option) => (
                <div
                  key={option.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, option)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, option)}
                  className={`flex items-center gap-4 p-4 hover:bg-slate-700/30 transition-colors cursor-move ${
                    draggedItem?.id === option.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="text-slate-500 cursor-grab active:cursor-grabbing">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="5" r="1"/>
                      <circle cx="9" cy="12" r="1"/>
                      <circle cx="9" cy="19" r="1"/>
                      <circle cx="15" cy="5" r="1"/>
                      <circle cx="15" cy="12" r="1"/>
                      <circle cx="15" cy="19" r="1"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{option.label}</p>
                    <p className="text-slate-500 text-sm">{option.value}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleActive(option)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                        option.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-slate-600/50 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {option.is_active ? 'Active' : 'Inactive'}
                    </button>

                    <button
                      onClick={() => handleEdit(option)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDelete(option.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 flex items-center gap-6 text-sm text-slate-400">
          <span>{options.length} total options</span>
          <span>{options.filter(o => o.is_active).length} active</span>
          <span>{options.filter(o => !o.is_active).length} inactive</span>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-2">Usage</h4>
          <p className="text-sm text-slate-400">
            These options appear in the checkout flow when customers are asked "How did you hear about us?"
            This helps track marketing effectiveness and customer acquisition channels.
          </p>
        </div>
      </div>

      <EditModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingOption(null);
        }}
        onSave={handleSave}
        option={editingOption}
      />
    </AdminPageWrapper>
  );
};

export default AttributionPage;
