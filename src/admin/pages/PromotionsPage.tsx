import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { usePromotions, useDeletePromotion, useTogglePromotion } from '../hooks/usePromotions';
import {
  Promotion,
  DISCOUNT_TYPE_CONFIG,
  SCOPE_CONFIG,
  PROMOTION_STATUS_CONFIG,
  getPromotionStatus,
  formatDiscountBadge,
} from '../types/promotions';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PromotionsPageProps {
  onEditPromotion: (promotionId: string) => void;
}

const ITEMS_PER_PAGE = 20;

const PromotionsPage: React.FC<PromotionsPageProps> = ({ onEditPromotion }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalPromotion, setDeleteModalPromotion] = useState<Promotion | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { promotions, totalCount, totalPages, loading, error, refetch } = usePromotions({
    status: statusFilter as any,
    scope: scopeFilter as any,
    search: searchQuery,
    page: currentPage,
    perPage: ITEMS_PER_PAGE,
  });

  const { deletePromotion, loading: deleting } = useDeletePromotion();
  const { togglePromotion } = useTogglePromotion();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, scopeFilter]);

  const handleDelete = async () => {
    if (!deleteModalPromotion) return;
    const result = await deletePromotion(deleteModalPromotion.id);
    if (result.success) {
      setDeleteModalPromotion(null);
      refetch();
    }
  };

  const handleToggleActive = async (promotion: Promotion) => {
    const result = await togglePromotion(promotion.id, !promotion.is_active);
    if (result.success) {
      refetch();
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = (promotion: Promotion) => {
    const start = formatDate(promotion.starts_at);
    const end = promotion.ends_at ? formatDate(promotion.ends_at) : 'No end';
    return `${start} - ${end}`;
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Promotions</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage discounts, coupons, and sales campaigns
            </p>
          </div>
          <button
            onClick={() => onEditPromotion('')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} />
            Create Promotion
          </button>
        </div>

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
                placeholder="Search promotions or codes..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-40 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="w-full md:w-40 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">All Scopes</option>
              <option value="site_wide">Site-wide</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
              <option value="customer">Customer</option>
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
          ) : promotions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No promotions found</h3>
              <p className="text-slate-500">
                {searchQuery || statusFilter !== 'all' || scopeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first promotion'}
              </p>
              {!searchQuery && statusFilter === 'all' && scopeFilter === 'all' && (
                <button
                  onClick={() => onEditPromotion('')}
                  className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Create Promotion
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
                        Promotion
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Discount
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Scope
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Schedule
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Usage
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
                    {promotions.map((promotion) => {
                      const status = getPromotionStatus(promotion);
                      const statusConfig = PROMOTION_STATUS_CONFIG[status];
                      const discountConfig = DISCOUNT_TYPE_CONFIG[promotion.discount_type];
                      const scopeConfig = SCOPE_CONFIG[promotion.scope];

                      return (
                        <tr
                          key={promotion.id}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => onEditPromotion(promotion.id)}
                        >
                          {/* Promotion Name & Code */}
                          <td className="py-4 px-6">
                            <div>
                              <p className="text-slate-800 font-medium">{promotion.name}</p>
                              {promotion.code && (
                                <div className="flex items-center gap-2 mt-1">
                                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-600">
                                    {promotion.code}
                                  </code>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCode(promotion.code!);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Copy code"
                                  >
                                    {copiedCode === promotion.code ? (
                                      <Check size={14} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                </div>
                              )}
                              {promotion.activation_type === 'automatic' && (
                                <span className="text-xs text-slate-400 mt-1 block">
                                  Auto-applies
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Discount */}
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${discountConfig.color}`}
                            >
                              {formatDiscountBadge(promotion)}
                            </span>
                          </td>

                          {/* Scope */}
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${scopeConfig.color}`}
                            >
                              {scopeConfig.label}
                            </span>
                            {promotion.scope === 'category' && promotion.categories && promotion.categories.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {promotion.categories.length} categor{promotion.categories.length === 1 ? 'y' : 'ies'}
                              </p>
                            )}
                            {promotion.scope === 'product' && promotion.products && promotion.products.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {promotion.products.length} product{promotion.products.length === 1 ? '' : 's'}
                              </p>
                            )}
                          </td>

                          {/* Schedule */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar size={14} className="text-slate-400" />
                              <span>{formatDateRange(promotion)}</span>
                            </div>
                          </td>

                          {/* Usage */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Users size={14} className="text-slate-400" />
                              <span>
                                {promotion.usage_count}
                                {promotion.usage_limit_total && (
                                  <span className="text-slate-400">
                                    {' '}
                                    / {promotion.usage_limit_total}
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.color} ${statusConfig.borderColor}`}
                            >
                              {statusConfig.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleToggleActive(promotion)}
                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                title={promotion.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {promotion.is_active ? (
                                  <ToggleRight size={18} className="text-emerald-500" />
                                ) : (
                                  <ToggleLeft size={18} />
                                )}
                              </button>
                              <button
                                onClick={() => onEditPromotion(promotion.id)}
                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => setDeleteModalPromotion(promotion)}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} promotions
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

      {/* Delete Confirmation Modal */}
      {deleteModalPromotion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Promotion</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete{' '}
              <strong className="text-slate-800">{deleteModalPromotion.name}</strong>?
              {deleteModalPromotion.usage_count > 0 && (
                <span className="block mt-2 text-amber-600 text-sm">
                  This promotion has been used {deleteModalPromotion.usage_count} time
                  {deleteModalPromotion.usage_count === 1 ? '' : 's'}.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalPromotion(null)}
                disabled={deleting}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default PromotionsPage;
