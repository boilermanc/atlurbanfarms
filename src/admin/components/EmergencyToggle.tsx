import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Ban, Loader2 } from 'lucide-react';

interface EmergencyToggleProps {
  name: string;
  description?: string;
  enabled: boolean;
  lastUpdated?: string;
  onToggle: (enabled: boolean, reason?: string) => Promise<boolean>;
  loading?: boolean;
}

const EmergencyToggle: React.FC<EmergencyToggleProps> = ({
  name,
  description,
  enabled,
  lastUpdated,
  onToggle,
  loading = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleClick = () => {
    if (enabled) {
      // Show confirmation modal before disabling
      setShowModal(true);
    } else {
      // Enable directly without confirmation
      onToggle(true);
    }
  };

  const handleConfirmDisable = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    const success = await onToggle(false, reason.trim());
    setIsSubmitting(false);

    if (success) {
      setShowModal(false);
      setReason('');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setReason('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <>
      <div
        className={`p-5 rounded-xl border-2 transition-all ${
          enabled
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div
                className={`w-3 h-3 rounded-full ${
                  enabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <h3 className="text-lg font-semibold text-slate-800 truncate">{name}</h3>
            </div>
            {description && (
              <p className="text-sm text-slate-500 mt-1 ml-6">{description}</p>
            )}
            {lastUpdated && (
              <p className="text-xs text-slate-400 mt-2 ml-6">
                Last updated: {formatDate(lastUpdated)}
              </p>
            )}
          </div>

          {/* Large toggle switch */}
          <button
            onClick={handleToggleClick}
            disabled={loading}
            className={`relative w-20 h-10 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 ${
              enabled
                ? 'bg-emerald-500 focus:ring-emerald-500/30'
                : 'bg-red-500 focus:ring-red-500/30'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <motion.div
              className="absolute top-1 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center"
              animate={{ left: enabled ? '44px' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              {loading ? (
                <Loader2 size={16} className="text-slate-400 animate-spin" />
              ) : enabled ? (
                <Check size={20} className="text-emerald-500" />
              ) : (
                <X size={20} className="text-red-500" />
              )}
            </motion.div>
          </button>
        </div>

        {/* Status badge */}
        <div className="mt-3 ml-6">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              enabled
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            {enabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200/60 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-red-50 border-b border-red-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Disable {name}?</h3>
                    <p className="text-sm text-red-600 mt-1">This affects live operations</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <p className="text-slate-600">
                  Disabling this control will immediately affect the live site. Please provide a reason for this change.
                </p>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600">
                    Reason for disabling <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Maintenance window, Payment processor issue, etc."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500">
                    This reason will be stored in the audit log.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDisable}
                  disabled={!reason.trim() || isSubmitting}
                  className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    <>
                      <Ban size={16} />
                      Disable {name}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmergencyToggle;
