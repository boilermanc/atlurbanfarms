import React, { useState, useEffect } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import {
  useCreditLog,
  useCreditStats,
  useCheckCredit,
  useGrantCredit,
} from '../hooks/useSproutifyCredits';
import {
  ACTION_CONFIG,
  STATUS_CONFIG,
  type CreditLogAction,
  type SproutifyCreditStatus,
} from '../types/sproutifyCredits';
import {
  Search,
  Leaf,
  DollarSign,
  Users,
  Gift,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Eye,
} from 'lucide-react';

const ITEMS_PER_PAGE = 20;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const SproutifyCreditsPage: React.FC = () => {
  // Filters & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | CreditLogAction>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Check credit state
  const [checkEmail, setCheckEmail] = useState('');
  const { checkCredit, result: checkResult, loading: checkLoading, error: checkError } = useCheckCredit();

  // Grant credit state
  const [grantEmail, setGrantEmail] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantNotes, setGrantNotes] = useState('');
  const [grantSuccess, setGrantSuccess] = useState(false);
  const { grantCredit, loading: grantLoading, error: grantError } = useGrantCredit();

  // Data hooks
  const { entries, totalCount, totalPages, loading, error, refetch } = useCreditLog({
    action: actionFilter,
    search: searchQuery,
    page: currentPage,
    perPage: ITEMS_PER_PAGE,
  });

  const { stats, loading: statsLoading } = useCreditStats();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter]);

  const handleCheckCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkEmail.trim()) return;
    await checkCredit(checkEmail.trim());
  };

  const handleGrantCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim() || !grantAmount) return;
    const amount = parseFloat(grantAmount);
    if (isNaN(amount) || amount <= 0) return;

    setGrantSuccess(false);
    const success = await grantCredit(grantEmail.trim(), amount, grantNotes.trim() || undefined);
    if (success) {
      setGrantSuccess(true);
      setGrantEmail('');
      setGrantAmount('');
      setGrantNotes('');
      refetch();
      // Clear success message after 5s
      setTimeout(() => setGrantSuccess(false), 5000);
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Sproutify Credits</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track seedling credit usage and grant credits to customers
          </p>
        </div>

        {/* Stats Cards */}
        {!statsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <Leaf size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Credits Redeemed</p>
                  <p className="text-xl font-bold text-slate-800">{stats.totalRedeemed}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <DollarSign size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Customer Savings</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalSavings)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <Gift size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Credits Granted</p>
                  <p className="text-xl font-bold text-slate-800">{stats.totalGranted}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl">
                  <Users size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Unique Customers</p>
                  <p className="text-xl font-bold text-slate-800">{stats.uniqueCustomers}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions + Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel: Actions */}
          <div className="space-y-6">
            {/* Check Credit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="text-lg font-semibold text-slate-800 font-admin-display mb-4 flex items-center gap-2">
                <Eye size={20} className="text-blue-600" />
                Check Credit
              </h3>
              <form onSubmit={handleCheckCredit} className="space-y-3">
                <input
                  type="email"
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  placeholder="Customer email..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={checkLoading || !checkEmail.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  Check Credit
                </button>
              </form>

              {/* Check Result */}
              {checkError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {checkError}
                </div>
              )}
              {checkResult && (
                <CreditStatusCard result={checkResult} />
              )}
            </div>

            {/* Grant Credit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="text-lg font-semibold text-slate-800 font-admin-display mb-4 flex items-center gap-2">
                <Gift size={20} className="text-purple-600" />
                Grant Credit
              </h3>
              <form onSubmit={handleGrantCredit} className="space-y-3">
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="Customer email..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  required
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder="Amount"
                    min="0.01"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    required
                  />
                </div>
                <textarea
                  value={grantNotes}
                  onChange={(e) => setGrantNotes(e.target.value)}
                  placeholder="Notes (optional)..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
                />
                <button
                  type="submit"
                  disabled={grantLoading || !grantEmail.trim() || !grantAmount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grantLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Grant Credit
                </button>
              </form>

              {/* Grant Result */}
              {grantError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {grantError}
                </div>
              )}
              {grantSuccess && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Credit granted successfully
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Activity Log */}
          <div className="lg:col-span-2 space-y-4">
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
                    placeholder="Search by email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as any)}
                  className="w-full md:w-40 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="all">All Actions</option>
                  <option value="check">Checks</option>
                  <option value="redeem">Redemptions</option>
                  <option value="grant">Grants</option>
                </select>
              </div>
            </div>

            {/* Error */}
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
              ) : entries.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Leaf size={32} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No activity found</h3>
                  <p className="text-slate-500">
                    {searchQuery || actionFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Credit activity will appear here'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Date
                          </th>
                          <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Email
                          </th>
                          <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Action
                          </th>
                          <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Amount
                          </th>
                          <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Order
                          </th>
                          <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entries.map((entry) => {
                          const actionCfg = ACTION_CONFIG[entry.action];
                          const statusCfg = STATUS_CONFIG[entry.status];
                          return (
                            <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                                {formatDate(entry.created_at)}
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-sm text-slate-800 font-medium">
                                  {entry.customer_email}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${actionCfg.color} border ${actionCfg.borderColor}`}>
                                  {actionCfg.label}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                {entry.credit_amount > 0 ? (
                                  <span className="text-sm font-semibold text-slate-800">
                                    {formatCurrency(entry.credit_amount)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                {entry.order_number ? (
                                  <span className="text-sm text-emerald-600 font-medium">
                                    {entry.order_number}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <span className="inline-flex items-center gap-1">
                                  {entry.status === 'success' ? (
                                    <CheckCircle size={14} className="text-emerald-500" />
                                  ) : (
                                    <XCircle size={14} className="text-red-500" />
                                  )}
                                  <span className={`text-xs font-medium ${entry.status === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {statusCfg.label}
                                  </span>
                                </span>
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
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
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
        </div>
      </div>
    </AdminPageWrapper>
  );
};

/** Credit status result card shown after checking a customer */
const CreditStatusCard: React.FC<{ result: SproutifyCreditStatus }> = ({ result }) => {
  if (result.hasCredit) {
    return (
      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-emerald-600" />
          <span className="font-semibold text-emerald-800">Credit Available</span>
          {result.isLifetime && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
              Lifetime
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-emerald-700">{formatCurrency(result.creditAmount)}</p>
        {result.creditId && (
          <p className="text-xs text-emerald-600 mt-1">Credit ID: {result.creditId}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center gap-2">
        <XCircle size={18} className="text-slate-400" />
        <span className="font-medium text-slate-600">No credit available</span>
      </div>
    </div>
  );
};

export default SproutifyCreditsPage;
