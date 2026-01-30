import React, { useState } from 'react';
import { useCreateGiftCard } from '../hooks/useGiftCards';
import {
  GiftCardFormData,
  DEFAULT_GIFT_CARD_FORM,
  formatCurrency,
} from '../types/giftCards';
import {
  X,
  Gift,
  DollarSign,
  Mail,
  User,
  MessageSquare,
  Calendar,
  Check,
  Copy,
} from 'lucide-react';

interface GiftCardCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (giftCardId: string, code: string) => void;
}

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200];

const GiftCardCreateModal: React.FC<GiftCardCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<GiftCardFormData>(DEFAULT_GIFT_CARD_FORM);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const { createGiftCard, loading, error } = useCreateGiftCard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createGiftCard(formData);
    if (result.success && result.code) {
      setCreatedCode(result.code);
    }
  };

  const handleCopyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDone = () => {
    if (createdCode) {
      // Find the ID from result (we need to pass it back)
      onSuccess('', createdCode);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData(DEFAULT_GIFT_CARD_FORM);
    setCreatedCode(null);
    setCopiedCode(false);
    onClose();
  };

  const handlePresetAmount = (amount: number) => {
    setFormData({ ...formData, initial_balance: amount.toString() });
  };

  if (!isOpen) return null;

  // Success state - show the created code
  if (createdCode) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Gift Card Created!</h3>
            <p className="text-slate-500 mb-6">
              The gift card has been successfully issued for {formatCurrency(parseFloat(formData.initial_balance))}.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-500 mb-2">Gift Card Code</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-2xl font-mono font-bold text-slate-800">{createdCode}</code>
                <button
                  onClick={handleCopyCode}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? (
                    <Check size={20} className="text-emerald-500" />
                  ) : (
                    <Copy size={20} />
                  )}
                </button>
              </div>
              {formData.recipient_email && (
                <p className="text-sm text-slate-500 mt-3">
                  Recipient: {formData.recipient_email}
                </p>
              )}
            </div>

            <button
              onClick={handleDone}
              className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Gift size={20} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Issue Gift Card</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <DollarSign size={16} />
                Amount <span className="text-red-500">*</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handlePresetAmount(amount)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.initial_balance === amount.toString()
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                placeholder="Custom amount"
                className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Recipient Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <User size={16} />
                Recipient Name
              </span>
            </label>
            <input
              type="text"
              value={formData.recipient_name}
              onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              placeholder="e.g., John Smith"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Recipient Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Mail size={16} />
                Recipient Email
              </span>
            </label>
            <input
              type="email"
              value={formData.recipient_email}
              onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
              placeholder="e.g., john@example.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional - Used for record keeping. Email notification will be Phase 2.
            </p>
          </div>

          {/* Personal Message */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={16} />
                Personal Message
              </span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="e.g., Happy Birthday! Enjoy some fresh produce."
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Calendar size={16} />
                Expiration Date
              </span>
            </label>
            <input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave blank for no expiration
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.initial_balance || parseFloat(formData.initial_balance) <= 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Issue Gift Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GiftCardCreateModal;
