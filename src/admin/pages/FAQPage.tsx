import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import FAQEditModal from '../components/FAQEditModal';
import { supabase } from '../../lib/supabase';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Manage FAQs</h1>
            <p className="text-slate-400 mt-1">
              Drag and drop to reorder. Click to edit.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add FAQ
          </button>
        </div>

        {/* Filters */}
        {categories.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-300">Filter by Category:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategory('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !filterCategory
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filterCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-500 text-5xl mb-4">?</div>
              <h3 className="text-lg font-medium text-white mb-2">No FAQs Found</h3>
              <p className="text-slate-400 mb-6">
                {filterCategory
                  ? `No FAQs in the "${filterCategory}" category.`
                  : 'Get started by adding your first FAQ.'}
              </p>
              {!filterCategory && (
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Add Your First FAQ
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="w-10 py-4 px-4"></th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Question</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 w-32">Category</th>
                    <th className="text-center py-4 px-4 text-sm font-medium text-slate-400 w-24">Order</th>
                    <th className="text-center py-4 px-4 text-sm font-medium text-slate-400 w-24">Status</th>
                    <th className="text-right py-4 px-4 text-sm font-medium text-slate-400 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaqs.map((faq) => (
                    <tr
                      key={faq.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, faq)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, faq)}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-move ${
                        draggedItem?.id === faq.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
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
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-white font-medium">{truncateText(faq.question, 80)}</p>
                        <p className="text-slate-400 text-sm mt-1">{truncateText(faq.answer, 100)}</p>
                      </td>
                      <td className="py-4 px-4">
                        {faq.category ? (
                          <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-lg">
                            {faq.category}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-slate-400">{faq.sort_order}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-lg ${
                            faq.is_active
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-600/50 text-slate-400'
                          }`}
                        >
                          {faq.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(faq)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(faq.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
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
        <div className="mt-6 flex items-center gap-6 text-sm text-slate-400">
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
