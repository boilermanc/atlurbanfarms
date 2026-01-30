import React, { useState } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useGiftCard, useToggleGiftCardStatus, useAdjustGiftCardBalance } from '../hooks/useGiftCards';
import {
  GiftCard,
  GiftCardTransaction,
  GIFT_CARD_STATUS_CONFIG,
  GIFT_CARD_TRANSACTION_TYPE_CONFIG,
  formatCurrency,
  isGiftCardExpired,
  GiftCardAdjustmentFormData,
  DEFAULT_ADJUSTMENT_FORM,
} from '../types/giftCards';
import {
  ArrowLeft,
  Gift,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Plus,
  Minus,
  RefreshCw,
  Edit2,
  Mail,
  User,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Clock,
  ShoppingCart,
} from 'lucide-react';

interface GiftCardDetailPageProps {
  giftCardId: string;
  onBack: () => void;
}

const GiftCardDetailPage: React.FC<GiftCardDetailPageProps> = ({ giftCardId, onBack }) => {
  const { giftCard, transactions, loading, error, refetch } = useGiftCard(giftCardId);
  const { toggleStatus, loading: togglingStatus } = useToggleGiftCardStatus();
  const { adjustBalance, loading: adjustingBalance } = useAdjustGiftCardBalance();

  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState<GiftCardAdjustmentFormData>(DEFAULT_ADJUSTMENT_FORM);

  const handleCopyCode = () => {
    if (!giftCard) return;
    navigator.clipboard.writeText(giftCard.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleToggleStatus = async () => {
    if (!giftCard) return;
    const newStatus = giftCard.status === 'active' ? 'disabled' : 'active';
    const result = await toggleStatus(giftCard.id, newStatus);
    if (result.success) {
      refetch();
    }
  };

  const handleAdjustBalance = async () => {
    const result = await adjustBalance(giftCardId, adjustForm);
    if (result.success) {
      setShowAdjustModal(false);
      setAdjustForm(DEFAULT_ADJUSTMENT_FORM);
      refetch();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <Plus size={16} className="text-emerald-600" />;
      case 'redemption':
        return <Minus size={16} className="text-blue-600" />;
      case 'refund':
        return <RefreshCw size={16} className="text-amber-600" />;
      case 'adjustment':
        return <Edit2 size={16} className="text-purple-600" />;
      default:
        return <Clock size={16} className="text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  if (error || !giftCard) {
    return (
      <AdminPageWrapper>
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">Gift Card Not Found</h3>
          <p className="text-slate-500 mb-4">{error || 'The gift card could not be loaded.'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </AdminPageWrapper>
    );
  }

  const statusConfig = GIFT_CARD_STATUS_CONFIG[giftCard.status];
  const isExpired = isGiftCardExpired(giftCard);

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Gift Card Details</h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                  {isExpired && giftCard.status === 'active' ? 'Expired' : statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-lg bg-slate-100 px-3 py-1 rounded font-mono text-slate-700 font-semibold">
                  {giftCard.code}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? (
                    <Check size={18} className="text-emerald-500" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjustModal(true)}
              disabled={giftCard.status === 'disabled'}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit2 size={18} />
              Adjust Balance
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus || giftCard.status === 'depleted'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                giftCard.status === 'active'
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {giftCard.status === 'active' ? (
                <>
                  <ToggleLeft size={18} />
                  Disable
                </>
              ) : (
                <>
                  <ToggleRight size={18} />
                  Enable
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
              <p className="text-emerald-100 text-sm font-medium">Current Balance</p>
              <p className="text-4xl font-bold mt-1">{formatCurrency(giftCard.current_balance)}</p>
              <div className="mt-4 pt-4 border-t border-emerald-400/30">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-100">Initial Balance</span>
                  <span className="font-medium">{formatCurrency(giftCard.initial_balance)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-emerald-100">Total Used</span>
                  <span className="font-medium">{formatCurrency(giftCard.initial_balance - giftCard.current_balance)}</span>
                </div>
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Details</h3>
              <div className="space-y-4">
                {/* Recipient */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <User size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Recipient</p>
                    <p className="text-slate-800 font-medium">
                      {giftCard.recipient_name || 'Not specified'}
                    </p>
                  </div>
                </div>

                {/* Recipient Email */}
                {giftCard.recipient_email && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Mail size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Recipient Email</p>
                      <p className="text-slate-800">{giftCard.recipient_email}</p>
                    </div>
                  </div>
                )}

                {/* Purchaser Email */}
                {giftCard.purchaser_email && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Gift size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Purchased By</p>
                      <p className="text-slate-800">{giftCard.purchaser_email}</p>
                    </div>
                  </div>
                )}

                {/* Created Date */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Created</p>
                    <p className="text-slate-800">{formatDate(giftCard.created_at)}</p>
                  </div>
                </div>

                {/* Expiration */}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isExpired ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <Clock size={16} className={isExpired ? 'text-amber-600' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Expires</p>
                    <p className={isExpired ? 'text-amber-600 font-medium' : 'text-slate-800'}>
                      {giftCard.expires_at ? formatDate(giftCard.expires_at) : 'Never'}
                      {isExpired && ' (Expired)'}
                    </p>
                  </div>
                </div>

                {/* Message */}
                {giftCard.message && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <MessageSquare size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Message</p>
                      <p className="text-slate-800 italic">"{giftCard.message}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Transaction History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 font-admin-display">Transaction History</h3>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock size={24} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transactions.map((transaction) => {
                    const typeConfig = GIFT_CARD_TRANSACTION_TYPE_CONFIG[transaction.type];
                    return (
                      <div key={transaction.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${typeConfig.bgColor}`}>
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{typeConfig.label}</p>
                              <p className="text-sm text-slate-500">{formatDateTime(transaction.created_at)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${transaction.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-sm text-slate-500">
                              Balance: {formatCurrency(transaction.balance_after)}
                            </p>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-2 pl-12 space-y-1">
                          {transaction.notes && (
                            <p className="text-sm text-slate-500">{transaction.notes}</p>
                          )}
                          {transaction.order && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                              <ShoppingCart size={14} />
                              <span>Order #{transaction.order.order_number}</span>
                            </div>
                          )}
                          {transaction.created_by_user && (
                            <p className="text-xs text-slate-400">
                              By {transaction.created_by_user.first_name} {transaction.created_by_user.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Adjust Balance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Adjustment Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'add' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                      adjustForm.type === 'add'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Plus size={18} />
                    Add Funds
                  </button>
                  <button
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'remove' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                      adjustForm.type === 'remove'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Minus size={18} />
                    Remove Funds
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.amount}
                    onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Enter reason for adjustment..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              {adjustForm.type === 'remove' && parseFloat(adjustForm.amount) > giftCard.current_balance && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Amount exceeds current balance ({formatCurrency(giftCard.current_balance)})
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustForm(DEFAULT_ADJUSTMENT_FORM);
                }}
                disabled={adjustingBalance}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={
                  adjustingBalance ||
                  !adjustForm.amount ||
                  parseFloat(adjustForm.amount) <= 0 ||
                  (adjustForm.type === 'remove' && parseFloat(adjustForm.amount) > giftCard.current_balance)
                }
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adjustingBalance && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default GiftCardDetailPage;
