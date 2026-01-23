import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface FAQ {
  id?: string;
  question: string;
  answer: string;
  category: string | null;
  is_active: boolean;
}

interface FAQEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (faq: FAQ) => Promise<void>;
  faq: FAQ | null;
  categories: string[];
}

const FAQ_CATEGORIES = [
  'General',
  'Orders',
  'Shipping',
  'Products',
  'Account',
  'Payment',
  'Returns',
];

const FAQEditModal: React.FC<FAQEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  faq,
  categories,
}) => {
  const [formData, setFormData] = useState<FAQ>({
    question: '',
    answer: '',
    category: null,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});

  const allCategories = [...new Set([...FAQ_CATEGORIES, ...categories])].filter(Boolean);

  useEffect(() => {
    if (faq) {
      setFormData({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        is_active: faq.is_active,
      });
    } else {
      setFormData({
        question: '',
        answer: '',
        category: null,
        is_active: true,
      });
    }
    setErrors({});
  }, [faq, isOpen]);

  const validate = (): boolean => {
    const newErrors: { question?: string; answer?: string } = {};

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'Answer is required';
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
      console.error('Error saving FAQ:', error);
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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {faq ? 'Edit FAQ' : 'Add New FAQ'}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Question <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    errors.question ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="Enter the question..."
                />
                {errors.question && (
                  <p className="mt-1 text-sm text-red-500">{errors.question}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Answer <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Supports basic Markdown: **bold**, *italic*, [links](url), and line breaks
                </p>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  rows={8}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none ${
                    errors.answer ? 'border-red-400' : 'border-slate-200'
                  }`}
                  placeholder="Enter the answer..."
                />
                {errors.answer && (
                  <p className="mt-1 text-sm text-red-500">{errors.answer}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Category
                </label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value || null }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">No Category</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-600">
                  Active (visible to customers)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : faq ? 'Update FAQ' : 'Add FAQ'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FAQEditModal;
