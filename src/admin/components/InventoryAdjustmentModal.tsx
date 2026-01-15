import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  InventoryBatch,
  AdjustmentFormData,
  AdjustmentType,
  ADJUSTMENT_TYPE_CONFIG,
  REASON_CODE_OPTIONS,
} from '../types/inventory';

interface InventoryAdjustmentModalProps {
  batch: InventoryBatch;
  onClose: () => void;
  onSave: () => void;
}

const InventoryAdjustmentModal: React.FC<InventoryAdjustmentModalProps> = ({
  batch,
  onClose,
  onSave,
}) => {
  const { adminUser } = useAdminAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AdjustmentFormData>({
    batch_id: batch.id,
    adjustment_type: 'correction',
    quantity: 0,
    reason_code: 'data_correction',
    notes: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.quantity === 0) {
      setError('Quantity cannot be zero');
      return;
    }

    try {
      setSaving(true);

      // Create adjustment record
      const { error: adjError } = await supabase.from('inventory_adjustments').insert([
        {
          batch_id: batch.id,
          adjustment_type: formData.adjustment_type,
          quantity: formData.quantity,
          reason_code: formData.reason_code,
          notes: formData.notes || null,
          adjusted_by: adminUser?.id || 'unknown',
        },
      ]);

      if (adjError) throw adjError;

      // Update batch quantities
      const newActual = batch.quantity_actual + formData.quantity;
      const newAvailable = batch.quantity_available + formData.quantity;

      const { error: batchError } = await supabase
        .from('inventory_batches')
        .update({
          quantity_actual: Math.max(0, newActual),
          quantity_available: Math.max(0, newAvailable),
        })
        .eq('id', batch.id);

      if (batchError) throw batchError;

      onSave();
    } catch (err: any) {
      console.error('Error saving adjustment:', err);
      setError(err.message || 'Failed to save adjustment');
    } finally {
      setSaving(false);
    }
  };

  const adjustmentTypes: AdjustmentType[] = ['loss', 'damage', 'correction', 'count', 'return'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-md bg-slate-800 rounded-xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Adjust Inventory</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              {/* Batch Info */}
              <div className="p-4 bg-slate-900 rounded-lg">
                <div className="text-sm text-slate-400 mb-1">Batch</div>
                <div className="text-white font-mono">{batch.batch_number}</div>
                <div className="text-sm text-slate-400 mt-2">
                  {batch.product_name} &middot; Current Available: {batch.quantity_available}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Adjustment Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {adjustmentTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, adjustment_type: type }))}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        formData.adjustment_type === type
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {ADJUSTMENT_TYPE_CONFIG[type].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quantity Adjustment
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: Math.min(0, prev.quantity - 1),
                      }))
                    }
                    className="w-10 h-10 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-xl font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className={`flex-1 px-4 py-2.5 bg-slate-900 text-white text-center text-lg font-mono border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formData.quantity > 0
                        ? 'text-emerald-400'
                        : formData.quantity < 0
                        ? 'text-red-400'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: Math.max(0, prev.quantity + 1),
                      }))
                    }
                    className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-xl font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  {formData.quantity > 0
                    ? `Adding ${formData.quantity} units`
                    : formData.quantity < 0
                    ? `Removing ${Math.abs(formData.quantity)} units`
                    : 'Enter quantity to adjust'}
                </p>
              </div>

              {/* Reason Code */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reason
                </label>
                <select
                  name="reason_code"
                  value={formData.reason_code}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {REASON_CODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Additional details..."
                />
              </div>

              {/* Preview */}
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">Result After Adjustment</div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Available Quantity:</span>
                  <span className="text-white font-mono">
                    {batch.quantity_available} → {Math.max(0, batch.quantity_available + formData.quantity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || formData.quantity === 0}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Save Adjustment
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InventoryAdjustmentModal;
