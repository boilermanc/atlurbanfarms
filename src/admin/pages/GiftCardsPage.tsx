import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useGiftCards, useGiftCardStats, useToggleGiftCardStatus } from '../hooks/useGiftCards';
import {
  GiftCard,
  GiftCardStatus,
  GIFT_CARD_STATUS_CONFIG,
  formatCurrency,
  isGiftCardExpired,
} from '../types/giftCards';
import {
  Plus,
  Search,
  Gift,
  Eye,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface GiftCardsPageProps {
  onViewGiftCard: (giftCardId: string) => void;
  onCreateGiftCard: () => void;
}

const ITEMS_PER_PAGE = 20;

const GiftCardsPage: React.FC<GiftCardsPageProps> = ({ onViewGiftCard, onCreateGiftCard }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GiftCardStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { giftCards, totalCount, totalPages, loading, error, refetch } = useGiftCards({
    status: statusFilter,
    search: searchQuery,
    page: currentPage,
    perPage: ITEMS_PER_PAGE,
  });

  const { stats, loading: statsLoading } = useGiftCardStats();
  const { toggleStatus } = useToggleGiftCardStatus();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleStatus = async (giftCard: GiftCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = giftCard.status === 'active' ? 'disabled' : 'active';
    const result = await toggleStatus(giftCard.id, newStatus);
    if (result.success) {
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

  const getStatusBadge = (giftCard: GiftCard) => {
    const isExpired = isGiftCardExpired(giftCard);
    if (isExpired && giftCard.status === 'active') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
          Expired
        </span>
      );
    }
    const config = GIFT_CARD_STATUS_CONFIG[giftCard.status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color} border ${config.borderColor}`}>
        {config.label}
      </span>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Gift Cards</h1>
            <p className="text-slate-500 text-sm mt-1">
              Issue and manage gift cards for your store
            </p>
          </div>
          <button
            onClick={onCreateGiftCard}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} />
            Issue Gift Card
          </button>
        </div>

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <CreditCard size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active Cards</p>
                  <p className="text-xl font-bold text-slate-800">{stats.totalActive}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <DollarSign size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Outstanding Balance</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalActiveBalance)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <Gift size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Issued</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalIssued)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <DollarSign size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Redeemed</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalRedeemed)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, email, or recipient name..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full md:w-40 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="depleted">Depleted</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : giftCards.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No gift cards found</h3>
              <p className="text-slate-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by issuing your first gift card'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <button
                  onClick={onCreateGiftCard}
                  className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Issue Gift Card
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Code
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Recipient
                      </th>
                      <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Initial
                      </th>
                      <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Balance
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Expires
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </th>
                      <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {giftCards.map((giftCard) => (
                      <tr
                        key={giftCard.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => onViewGiftCard(giftCard.id)}
                      >
                        {/* Code */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-slate-100 px-2.5 py-1 rounded font-mono text-slate-700 font-medium">
                              {giftCard.code}
                            </code>
                            <button
                              onClick={(e) => handleCopyCode(giftCard.code, e)}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === giftCard.code ? (
                                <Check size={16} className="text-emerald-500" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Recipient */}
                        <td className="py-4 px-6">
                          <div>
                            {giftCard.recipient_name && (
                              <p className="text-slate-800 font-medium">{giftCard.recipient_name}</p>
                            )}
                            {giftCard.recipient_email && (
                              <p className="text-sm text-slate-500">{giftCard.recipient_email}</p>
                            )}
                            {!giftCard.recipient_name && !giftCard.recipient_email && (
                              <span className="text-slate-400 italic">Not specified</span>
                            )}
                          </div>
                        </td>

                        {/* Initial Balance */}
                        <td className="py-4 px-6 text-right">
                          <span className="text-slate-600">{formatCurrency(giftCard.initial_balance)}</span>
                        </td>

                        {/* Current Balance */}
                        <td className="py-4 px-6 text-right">
                          <span className={`font-semibold ${giftCard.current_balance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {formatCurrency(giftCard.current_balance)}
                          </span>
                        </td>

                        {/* Expires */}
                        <td className="py-4 px-6">
                          {giftCard.expires_at ? (
                            <div className="flex items-center gap-1.5">
                              {isGiftCardExpired(giftCard) && (
                                <AlertTriangle size={14} className="text-amber-500" />
                              )}
                              <span className={isGiftCardExpired(giftCard) ? 'text-amber-600' : 'text-slate-600'}>
                                {formatDate(giftCard.expires_at)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Never</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          {getStatusBadge(giftCard)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleToggleStatus(giftCard, e)}
                              disabled={giftCard.status === 'depleted'}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={giftCard.status === 'active' ? 'Disable' : 'Enable'}
                            >
                              {giftCard.status === 'active' ? (
                                <ToggleRight size={18} className="text-emerald-500" />
                              ) : (
                                <ToggleLeft size={18} />
                              )}
                            </button>
                            <button
                              onClick={() => onViewGiftCard(giftCard.id)}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                              title="View Details"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} gift cards
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span className="text-sm text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default GiftCardsPage;
