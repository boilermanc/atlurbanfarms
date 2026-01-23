import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import FAQEditModal from '../components/FAQEditModal';
import { supabase } from '../../lib/supabase';
import { Plus, GripVertical, Edit2, Trash2, HelpCircle } from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const FAQPage: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [draggedItem, setDraggedItem] = useState<FAQ | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const categories = [...new Set(faqs.map(f => f.category).filter(Boolean))] as string[];

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleSave = async (faqData: Omit<FAQ, 'id' | 'sort_order' | 'created_at' | 'updated_at'> & { id?: string }) => {
    try {
      if (faqData.id) {
        const { error } = await supabase
          .from('faqs')
          .update({
            question: faqData.question,
            answer: faqData.answer,
            category: faqData.category,
            is_active: faqData.is_active,
          })
          .eq('id', faqData.id);

        if (error) throw error;
      } else {
        const maxOrder = faqs.length > 0 ? Math.max(...faqs.map(f => f.sort_order)) : 0;
        const { error } = await supabase
          .from('faqs')
          .insert({
            question: faqData.question,
            answer: faqData.answer,
            category: faqData.category,
            is_active: faqData.is_active,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
      }

      await fetchFaqs();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const { error } = await supabase.from('faqs').delete().eq('id', id);
      if (error) throw error;
      setFaqs(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, faq: FAQ) => {
    setDraggedItem(faq);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetFaq: FAQ) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.id === targetFaq.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = faqs.findIndex(f => f.id === draggedItem.id);
    const targetIndex = faqs.findIndex(f => f.id === targetFaq.id);

    const newFaqs = [...faqs];
    newFaqs.splice(draggedIndex, 1);
    newFaqs.splice(targetIndex, 0, draggedItem);

    // Update sort_order for all items
    const updatedFaqs = newFaqs.map((faq, index) => ({
      ...faq,
      sort_order: index + 1,
    }));

    setFaqs(updatedFaqs);
    setDraggedItem(null);

    // Persist to database
    try {
      const updates = updatedFaqs.map(faq => ({
        id: faq.id,
        sort_order: faq.sort_order,
      }));

      for (const update of updates) {
        await supabase
          .from('faqs')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      fetchFaqs(); // Revert on error
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingFaq(null);
    setModalOpen(true);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const filteredFaqs = filterCategory
    ? faqs.filter(f => f.category === filterCategory)
    : faqs;

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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Manage FAQs</h1>
            <p className="text-slate-500 text-sm mt-1">
              Drag and drop to reorder. Click to edit.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} />
            Add FAQ
          </button>
        </div>

        {/* Filters */}
        {categories.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">Filter by Category:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategory('')}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    !filterCategory
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      filterCategory === cat
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAQ List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No FAQs Found</h3>
              <p className="text-slate-500 mb-6">
                {filterCategory
                  ? `No FAQs in the "${filterCategory}" category.`
                  : 'Get started by adding your first FAQ.'}
              </p>
              {!filterCategory && (
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Add Your First FAQ
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 py-3 px-4"></th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Question</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-32">Category</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Order</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFaqs.map((faq) => (
                    <tr
                      key={faq.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, faq)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, faq)}
                      className={`hover:bg-slate-50 transition-colors cursor-move ${
                        draggedItem?.id === faq.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                          <GripVertical size={20} />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-slate-800 font-medium">{truncateText(faq.question, 80)}</p>
                        <p className="text-slate-500 text-sm mt-1">{truncateText(faq.answer, 100)}</p>
                      </td>
                      <td className="py-4 px-4">
                        {faq.category ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                            {faq.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-slate-500">{faq.sort_order}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            faq.is_active
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {faq.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(faq)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(faq.id)}
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
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span>{faqs.length} total FAQs</span>
          <span>{faqs.filter(f => f.is_active).length} active</span>
          <span>{faqs.filter(f => !f.is_active).length} inactive</span>
        </div>
      </div>

      <FAQEditModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingFaq(null);
        }}
        onSave={handleSave}
        faq={editingFaq}
        categories={categories}
      />
    </AdminPageWrapper>
  );
};

export default FAQPage;
