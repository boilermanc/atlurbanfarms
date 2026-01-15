import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import {
  InventoryBatch,
  BatchFormData,
  BatchStatus,
  BATCH_STATUS_CONFIG,
} from '../types/inventory';

interface Product {
  id: string;
  name: string;
}

interface BatchEditPageProps {
  batchId?: string;
  onNavigateBack?: () => void;
}

const BatchEditPage: React.FC<BatchEditPageProps> = ({ batchId, onNavigateBack }) => {
  const isEditing = Boolean(batchId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState<BatchFormData>({
    product_id: '',
    batch_number: '',
    status: 'planned',
    quantity_seeded: 0,
    quantity_expected: 0,
    quantity_actual: 0,
    planned_date: '',
    seeded_date: '',
    ready_date: '',
    expiry_date: '',
    notes: '',
  });

  // Generate batch number
  const generateBatchNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `B${year}${month}${day}-${random}`;
  };

  // Fetch products for dropdown
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    }
  };

  // Fetch existing batch if editing
  const fetchBatch = async () => {
    if (!batchId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          product_id: data.product_id || '',
          batch_number: data.batch_number || '',
          status: data.status || 'planned',
          quantity_seeded: data.quantity_seeded || 0,
          quantity_expected: data.quantity_expected || 0,
          quantity_actual: data.quantity_actual || 0,
          planned_date: data.planned_date?.split('T')[0] || '',
          seeded_date: data.seeded_date?.split('T')[0] || '',
          ready_date: data.ready_date?.split('T')[0] || '',
          expiry_date: data.expiry_date?.split('T')[0] || '',
          notes: data.notes || '',
        });
      }
    } catch (err) {
      console.error('Error fetching batch:', err);
      setError('Failed to load batch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    if (isEditing) {
      fetchBatch();
    } else {
      // Generate batch number for new batch
      setFormData((prev) => ({
        ...prev,
        batch_number: generateBatchNumber(),
      }));
    }
  }, [batchId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleGenerateBatchNumber = () => {
    setFormData((prev) => ({
      ...prev,
      batch_number: generateBatchNumber(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.product_id) {
      setError('Please select a product');
      return;
    }

    if (!formData.batch_number) {
      setError('Batch number is required');
      return;
    }

    try {
      setSaving(true);

      const batchData = {
        product_id: formData.product_id,
        batch_number: formData.batch_number,
        status: formData.status,
        quantity_seeded: formData.quantity_seeded,
        quantity_expected: formData.quantity_expected,
        quantity_actual: formData.quantity_actual,
        quantity_available: formData.quantity_actual, // Initialize available to actual
        quantity_allocated: 0,
        planned_date: formData.planned_date || null,
        seeded_date: formData.seeded_date || null,
        ready_date: formData.ready_date || null,
        expiry_date: formData.expiry_date || null,
        notes: formData.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('inventory_batches')
          .update(batchData)
          .eq('id', batchId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_batches').insert([batchData]);

        if (error) throw error;
      }

      onNavigateBack?.();
    } catch (err: any) {
      console.error('Error saving batch:', err);
      setError(err.message || 'Failed to save batch');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onNavigateBack?.();
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
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Inventory
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Batch' : 'Add New Batch'}
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 space-y-6">
            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Product <span className="text-red-400">*</span>
              </label>
              <select
                name="product_id"
                value={formData.product_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Number */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Batch Number <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="batch_number"
                  value={formData.batch_number}
                  onChange={handleInputChange}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={handleGenerateBatchNumber}
                  className="px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(BATCH_STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Qty Seeded
                </label>
                <input
                  type="number"
                  name="quantity_seeded"
                  value={formData.quantity_seeded}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Qty Expected
                </label>
                <input
                  type="number"
                  name="quantity_expected"
                  value={formData.quantity_expected}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Qty Actual
                </label>
                <input
                  type="number"
                  name="quantity_actual"
                  value={formData.quantity_actual}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Planned Date
                </label>
                <input
                  type="date"
                  name="planned_date"
                  value={formData.planned_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Seeded Date
                </label>
                <input
                  type="date"
                  name="seeded_date"
                  value={formData.seeded_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ready Date
                </label>
                <input
                  type="date"
                  name="ready_date"
                  value={formData.ready_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Expiry Date
                </label>
                <input
                  type="date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Optional notes about this batch..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </AdminPageWrapper>
  );
};

export default BatchEditPage;
