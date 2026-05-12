import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import {
  ShoppingCart,
  Search,
  Filter,
  Clock,
  Mail,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
} from 'lucide-react';
import {
  useAbandonedCarts,
  useAbandonedCartStats,
  AbandonedCart,
  AbandonedCartStatus,
} from '../hooks/useAbandonedCarts';

interface AbandonedCartsPageProps {
  onViewCustomer?: (customerId: string) => void;
}

type StatusFilter = AbandonedCartStatus | 'all';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  reminded: 'Reminder Sent',
  converted: 'Converted',
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function StatusBadge({ status }: { status: AbandonedCartStatus }) {
  const config = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', Icon: Clock, label: 'Pending' },
    reminded: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', Icon: Mail, label: 'Reminded' },
    converted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', Icon: CheckCircle, label: 'Converted' },
  }[status];
  const Icon = config.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function CartItemsList({ items }: { items: AbandonedCart['cart_items'] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400 italic">No item details</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item, idx) => {
        const name = item.name || 'Unnamed item';
        const qty = item.quantity ?? 1;
        const price = Number(item.price) || 0;
        return (
          <li key={item.id || `${name}-${idx}`} className="flex items-baseline justify-between gap-2">
            <span className="text-slate-700">
              <span className="font-medium">{name}</span>
              <span className="text-slate-400"> × {qty}</span>
            </span>
            <span className="text-slate-500 tabular-nums whitespace-nowrap">{formatCurrency(price * qty)}</span>
          </li>
        );
      })}
    </ul>
  );
}

const AbandonedCartsPage: React.FC<AbandonedCartsPageProps> = ({ onViewCustomer }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [daysBack, setDaysBack] = useState(7);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  const { carts, loading, error, refetch } = useAbandonedCarts({
    status: statusFilter,
    search,
    daysBack,
  });
  const { stats } = useAbandonedCartStats(daysBack);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const totals = useMemo(() => {
    return carts.reduce(
      (acc, cart) => {
        acc.count += 1;
        acc.value += cart.cart_total;
        return acc;
      },
      { count: 0, value: 0 }
    );
  }, [carts]);

  return (
    <AdminPageWrapper>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 font-admin-display">Abandoned Carts</h1>
            <p className="text-slate-500 text-sm mt-1">
              Customers who started checkout but didn't complete their order
            </p>
          </div>
          <button
            onClick={refetch}
            className="self-start sm:self-auto px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 font-admin-display">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                <Mail size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Reminded</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 font-admin-display">{stats.reminded}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-emerald-100 rounded-xl flex-shrink-0">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Recovered</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 font-admin-display">{stats.converted}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-emerald-100 rounded-xl flex-shrink-0">
                <ShoppingCart size={18} className="text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Potential Revenue</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-800 font-admin-display truncate">
                  {formatCurrency(stats.pendingValue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full sm:w-auto pl-9 pr-8 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer text-sm"
              >
                {(Object.entries(STATUS_LABELS) as [StatusFilter, string][]).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-auto">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="w-full sm:w-auto pl-9 pr-8 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer text-sm"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email or name…"
                className="w-full pl-9 pr-3 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 text-sm"
              />
            </div>
          </div>
          {!loading && (
            <p className="text-xs text-slate-500 mt-3">
              Showing <span className="font-semibold text-slate-700">{totals.count}</span> cart{totals.count === 1 ? '' : 's'}
              {totals.value > 0 && (
                <> · <span className="font-semibold text-slate-700">{formatCurrency(totals.value)}</span> total value</>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-start gap-3">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : carts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 py-12 sm:py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No abandoned carts found</p>
            <p className="text-slate-500 text-sm mt-1">
              {statusFilter !== 'all' || search ? 'Try adjusting your filters.' : 'Nothing in the window yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards (< md) */}
            <div className="md:hidden space-y-3">
              {carts.map((cart) => {
                const expanded = expandedId === cart.id;
                return (
                  <div
                    key={cart.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(cart.id)}
                      className="w-full text-left p-4 active:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate">
                            {cart.first_name || <span className="text-slate-400 italic">No name</span>}
                          </p>
                          <p className="text-sm text-slate-500 truncate">{cart.email}</p>
                        </div>
                        <StatusBadge status={cart.status} />
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="text-slate-600">
                          <span className="font-medium">{cart.item_count}</span> item{cart.item_count === 1 ? '' : 's'}
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-500">{relativeTime(cart.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 tabular-nums">
                            {formatCurrency(cart.cart_total)}
                          </span>
                          {expanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Cart Items
                          </p>
                          <CartItemsList items={cart.cart_items} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-slate-500">Created</p>
                            <p className="text-slate-700 font-medium">{new Date(cart.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Last Activity</p>
                            <p className="text-slate-700 font-medium">{new Date(cart.updated_at).toLocaleString()}</p>
                          </div>
                          {cart.reminder_sent_at && (
                            <div className="col-span-2">
                              <p className="text-slate-500">Reminder Sent</p>
                              <p className="text-slate-700 font-medium">{new Date(cart.reminder_sent_at).toLocaleString()}</p>
                            </div>
                          )}
                          {cart.converted_at && (
                            <div className="col-span-2">
                              <p className="text-slate-500">Converted</p>
                              <p className="text-emerald-700 font-medium">{new Date(cart.converted_at).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                        {cart.customer_id && onViewCustomer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewCustomer(cart.customer_id!);
                            }}
                            className="w-full px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors inline-flex items-center justify-center gap-2"
                          >
                            <UserIcon size={14} />
                            View Customer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tablet / Desktop: table (md+) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Age</th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 lg:px-6 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {carts.map((cart) => {
                      const expanded = expandedId === cart.id;
                      return (
                        <React.Fragment key={cart.id}>
                          <tr
                            onClick={() => toggleExpand(cart.id)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 lg:px-6 py-4">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate max-w-[200px] lg:max-w-none">
                                  {cart.first_name || <span className="text-slate-400 italic">No name</span>}
                                </p>
                                <p className="text-xs text-slate-500 truncate max-w-[200px] lg:max-w-none">{cart.email}</p>
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center text-slate-700 tabular-nums">{cart.item_count}</td>
                            <td className="px-4 lg:px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                              {formatCurrency(cart.cart_total)}
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-slate-600 text-sm whitespace-nowrap hidden lg:table-cell">
                              {relativeTime(cart.updated_at)}
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-center">
                              <StatusBadge status={cart.status} />
                            </td>
                            <td className="px-4 lg:px-6 py-4 text-slate-400">
                              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-slate-50/60">
                              <td colSpan={6} className="px-4 lg:px-6 py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  <div className="lg:col-span-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                      Cart Items
                                    </p>
                                    <CartItemsList items={cart.cart_items} />
                                  </div>
                                  <div className="space-y-3 text-sm">
                                    <div>
                                      <p className="text-xs text-slate-500">Created</p>
                                      <p className="text-slate-700">{new Date(cart.created_at).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500">Last Activity</p>
                                      <p className="text-slate-700">{new Date(cart.updated_at).toLocaleString()}</p>
                                    </div>
                                    {cart.reminder_sent_at && (
                                      <div>
                                        <p className="text-xs text-slate-500">Reminder Sent</p>
                                        <p className="text-slate-700">{new Date(cart.reminder_sent_at).toLocaleString()}</p>
                                      </div>
                                    )}
                                    {cart.converted_at && (
                                      <div>
                                        <p className="text-xs text-slate-500">Converted</p>
                                        <p className="text-emerald-700 font-medium">{new Date(cart.converted_at).toLocaleString()}</p>
                                      </div>
                                    )}
                                    {cart.customer_id && onViewCustomer && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onViewCustomer(cart.customer_id!);
                                        }}
                                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors inline-flex items-center gap-2"
                                      >
                                        <UserIcon size={14} />
                                        View Customer
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPageWrapper>
  );
};

export default AbandonedCartsPage;
