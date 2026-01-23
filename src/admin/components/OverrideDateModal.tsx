import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface OverrideDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: string, customCutoffTime: string | null, reason: string) => void;
  initialDate?: string | null;
}

const OverrideDateModal: React.FC<OverrideDateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDate,
}) => {
  const [date, setDate] = useState('');
  const [customCutoffTime, setCustomCutoffTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate || '');
      setCustomCutoffTime('');
      setReason('');
      setSaving(false);
    }
  }, [isOpen, initialDate]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    setSaving(true);
    try {
      await onSave(date, customCutoffTime || null, reason);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">Add Override Date</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Custom Cutoff Time
                  <span className="text-slate-400 font-normal ml-2">(optional)</span>
                </label>
                <input
                  type="time"
                  value={customCutoffTime}
                  onChange={(e) => setCustomCutoffTime(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to use the default cutoff time
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Special delivery day, Extended hours"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!date || saving}
                className="px-6 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Add Override'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default OverrideDateModal;
