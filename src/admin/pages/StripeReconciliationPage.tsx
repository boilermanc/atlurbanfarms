import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Download, AlertCircle, CreditCard } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReconciliationRow {
  payout_id: string;
  payout_date: string;
  payout_total: number;
  stripe_txn_id: string;
  stripe_gross: number;
  stripe_net: number;
  stripe_fee: number;
  txn_type: string;
  order_status: string;
  order_number: string | null;
  order_date: string | null;
  order_total: number | null;
  tax: number | null;
  shipping: number | null;
  discount: number | null;
  gift_card: number | null;
  refund_total: number | null;
  seedlings: number | null;
  products: number | null;
  billing_first_name: string | null;
  billing_last_name: string | null;
  note: string | null;
}

interface PayoutGroup {
  payout_id: string;
  payout_date: string;
  payout_total: number;
  rows: ReconciliationRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const fmt = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function sumField(rows: ReconciliationRow[], field: keyof ReconciliationRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

function groupByPayout(rows: ReconciliationRow[]): PayoutGroup[] {
  const map = new Map<string, PayoutGroup>();
  for (const row of rows) {
    if (!map.has(row.payout_id)) {
      map.set(row.payout_id, {
        payout_id: row.payout_id,
        payout_date: row.payout_date,
        payout_total: row.payout_total,
        rows: [],
      });
    }
    map.get(row.payout_id)!.rows.push(row);
  }
  // Sort by payout_date descending
  return Array.from(map.values()).sort((a, b) => b.payout_date.localeCompare(a.payout_date));
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-rose-50 text-rose-700 border-rose-200',
  on_hold: 'bg-purple-50 text-purple-700 border-purple-200',
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  UNMATCHED: 'bg-red-100 text-red-800 border-red-300',
  NO_LEGACY_MATCH: 'bg-slate-100 text-slate-500 border-slate-300',
  LEGACY_FUZZY: 'bg-orange-50 text-orange-700 border-orange-300',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`${cls} text-xs px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_COLUMNS: Array<{ label: string; key: keyof ReconciliationRow }> = [
  { label: 'Payout ID', key: 'payout_id' },
  { label: 'Payout Date', key: 'payout_date' },
  { label: 'Payout Total', key: 'payout_total' },
  { label: 'Stripe Txn ID', key: 'stripe_txn_id' },
  { label: 'Stripe Gross', key: 'stripe_gross' },
  { label: 'Stripe Net', key: 'stripe_net' },
  { label: 'Stripe Fee', key: 'stripe_fee' },
  { label: 'Txn Type', key: 'txn_type' },
  { label: 'Order Status', key: 'order_status' },
  { label: 'Order Number', key: 'order_number' },
  { label: 'Order Date', key: 'order_date' },
  { label: 'Order Total', key: 'order_total' },
  { label: 'Tax', key: 'tax' },
  { label: 'Shipping', key: 'shipping' },
  { label: 'Discount', key: 'discount' },
  { label: 'Gift Card', key: 'gift_card' },
  { label: 'Refund Total', key: 'refund_total' },
  { label: 'Seedlings', key: 'seedlings' },
  { label: 'Products', key: 'products' },
  { label: 'First Name', key: 'billing_first_name' },
  { label: 'Last Name', key: 'billing_last_name' },
  { label: 'Note', key: 'note' },
];

function exportCsv(rows: ReconciliationRow[], groups: PayoutGroup[], startDate: string, endDate: string) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const colCount = CSV_COLUMNS.length;
  const blankRow = Array(colCount).fill('').join(',');

  const header = CSV_COLUMNS.map(c => escape(c.label)).join(',');

  const bodyLines: string[] = [];
  for (const group of groups) {
    const groupNet = group.rows.reduce((acc, r) => acc + (r.stripe_net || 0), 0);
    // Payout header row
    const payoutCells = Array(colCount).fill('');
    payoutCells[0] = 'PAYOUT';
    payoutCells[1] = group.payout_id;
    payoutCells[2] = group.payout_date;
    payoutCells[4] = `Deposit: ${groupNet.toFixed(2)}`;
    bodyLines.push(payoutCells.map(escape).join(','));

    // Order rows
    for (const row of group.rows) {
      bodyLines.push(CSV_COLUMNS.map(c => escape(row[c.key])).join(','));
    }

    // Subtotal row
    const subCells = Array(colCount).fill('');
    subCells[0] = 'SUBTOTAL';
    subCells[4] = groupNet.toFixed(2);
    bodyLines.push(subCells.map(escape).join(','));

    // Blank separator
    bodyLines.push(blankRow);
  }

  const csv = `${header}\n${bodyLines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `stripe-reconciliation-${startDate}-to-${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Table column widths ──────────────────────────────────────────────────────

const COL_CLASSES = {
  status: 'px-3 py-2.5 whitespace-nowrap',
  orderNum: 'px-3 py-2.5 font-mono whitespace-nowrap',
  date: 'px-3 py-2.5 whitespace-nowrap text-slate-500',
  currency: 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap',
  name: 'px-3 py-2.5 whitespace-nowrap',
};

const TH = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';
const TH_R = 'px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';

// ─── Main component ───────────────────────────────────────────────────────────

const StripeReconciliationPage: React.FC = () => {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

  const runReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const resp = await fetch(
        `${supabaseUrl}/functions/v1/stripe-reconciliation?${params}`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Unknown error from edge function');
      }
      setRows(json.rows || []);
      setHasRun(true);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, supabaseUrl, supabaseAnonKey]);

  const groups = useMemo(() => groupByPayout(rows), [rows]);

  // Grand totals across all rows
  const grandTotals = useMemo(() => ({
    stripe_gross: sumField(rows, 'stripe_gross'),
    stripe_net: sumField(rows, 'stripe_net'),
    stripe_fee: sumField(rows, 'stripe_fee'),
    order_total: sumField(rows, 'order_total'),
    tax: sumField(rows, 'tax'),
    shipping: sumField(rows, 'shipping'),
    discount: sumField(rows, 'discount'),
    gift_card: sumField(rows, 'gift_card'),
    refund_total: sumField(rows, 'refund_total'),
    seedlings: sumField(rows, 'seedlings'),
    products: sumField(rows, 'products'),
  }), [rows]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <CreditCard size={22} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">
              Stripe Reconciliation
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Match Stripe payouts to Supabase orders
            </p>
          </div>
        </div>

        {rows.length > 0 && (
          <button
            onClick={() => exportCsv(rows, groups, startDate, endDate)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <button
            onClick={runReport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Running…
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Run Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Error running report</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && hasRun && rows.length === 0 && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 py-16 text-center text-slate-500">
          No Stripe payouts found for this date range.
        </div>
      )}

      {/* Report */}
      {!loading && rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className={TH}>Status</th>
                  <th className={TH}>Order #</th>
                  <th className={TH}>Order Date</th>
                  <th className={TH_R}>Order Total</th>
                  <th className={TH_R}>Stripe Deposit</th>
                  <th className={TH_R}>Stripe Fee</th>
                  <th className={TH_R}>Refund Total</th>
                  <th className={TH_R}>Discount</th>
                  <th className={TH_R}>Tax</th>
                  <th className={TH_R}>Gift Card</th>
                  <th className={TH_R}>Shipping</th>
                  <th className={TH_R}>Products</th>
                  <th className={TH_R}>Seedlings</th>
                  <th className={TH}>First Name</th>
                  <th className={TH}>Last Name</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>

              <tbody>
                {groups.map(group => {
                  const groupNet = sumField(group.rows, 'stripe_net');
                  const sub = {
                    stripe_gross: sumField(group.rows, 'stripe_gross'),
                    stripe_net: groupNet,
                    stripe_fee: sumField(group.rows, 'stripe_fee'),
                    order_total: sumField(group.rows, 'order_total'),
                    tax: sumField(group.rows, 'tax'),
                    shipping: sumField(group.rows, 'shipping'),
                    discount: sumField(group.rows, 'discount'),
                    gift_card: sumField(group.rows, 'gift_card'),
                    refund_total: sumField(group.rows, 'refund_total'),
                    seedlings: sumField(group.rows, 'seedlings'),
                    products: sumField(group.rows, 'products'),
                  };

                  return (
                    <React.Fragment key={group.payout_id}>
                      {/* Payout header */}
                      <tr className="bg-emerald-500">
                        <td
                          colSpan={3}
                          className="px-3 py-2.5 text-white font-bold"
                        >
                          <span className="font-mono text-xs opacity-80 mr-3">
                            {group.payout_id}
                          </span>
                          Payout — {fmtDate(group.payout_date)}
                        </td>
                        <td
                          colSpan={12}
                          className="px-3 py-2.5 text-right text-white font-bold tabular-nums"
                        >
                          Net deposit: {fmt(groupNet)}
                        </td>
                      </tr>

                      {/* Order rows */}
                      {group.rows.map(row => (
                        <tr
                          key={row.stripe_txn_id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            row.order_status === 'UNMATCHED' ? 'bg-red-50/40' :
                            row.order_status === 'LEGACY_FUZZY' ? 'bg-orange-50/40' :
                            row.order_status === 'NO_LEGACY_MATCH' ? 'bg-slate-50/60' : ''
                          }`}
                        >
                          <td className={COL_CLASSES.status}>
                            <StatusBadge status={row.order_status} />
                          </td>
                          <td className={COL_CLASSES.orderNum}>
                            {row.order_number ?? (
                              <span className="text-slate-400 text-xs font-mono">{row.stripe_txn_id}</span>
                            )}
                          </td>
                          <td className={COL_CLASSES.date}>
                            {row.order_date ? fmtDate(row.order_date) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {row.order_total != null ? fmt(row.order_total) : '—'}
                          </td>
                          <td className={`${COL_CLASSES.currency} font-medium`}>
                            {fmt(row.stripe_net)}
                          </td>
                          <td className={`${COL_CLASSES.currency} ${row.stripe_fee > 0 ? 'text-red-600' : ''}`}>
                            {row.stripe_fee !== 0 ? fmt(-row.stripe_fee) : '—'}
                          </td>
                          <td className={`${COL_CLASSES.currency} ${(row.refund_total ?? 0) > 0 ? 'text-red-600' : ''}`}>
                            {(row.refund_total ?? 0) > 0 ? fmt(-row.refund_total!) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {(row.discount ?? 0) > 0 ? fmt(row.discount!) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {row.tax != null && row.tax > 0 ? fmt(row.tax) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {(row.gift_card ?? 0) > 0 ? fmt(row.gift_card!) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {row.shipping != null && row.shipping > 0 ? fmt(row.shipping) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {row.products != null && row.products > 0 ? fmt(row.products) : '—'}
                          </td>
                          <td className={COL_CLASSES.currency}>
                            {row.seedlings != null && row.seedlings > 0 ? fmt(row.seedlings) : '—'}
                          </td>
                          <td className={COL_CLASSES.name}>{row.billing_first_name ?? '—'}</td>
                          <td className={COL_CLASSES.name}>{row.billing_last_name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[240px] truncate" title={row.note ?? undefined}>
                            {row.note ?? ''}
                          </td>
                        </tr>
                      ))}

                      {/* Payout subtotal */}
                      <tr className="bg-slate-100 border-b-2 border-slate-300">
                        <td colSpan={3} className="px-3 py-2.5 font-bold text-slate-700 text-xs uppercase tracking-wider">
                          Payout Subtotal ({group.rows.length} txns)
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {fmt(sub.order_total)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {fmt(sub.stripe_net)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-red-600">
                          {fmt(-sub.stripe_fee)}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${sub.refund_total > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {sub.refund_total > 0 ? fmt(-sub.refund_total) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.discount > 0 ? fmt(sub.discount) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.tax > 0 ? fmt(sub.tax) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.gift_card > 0 ? fmt(sub.gift_card) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.shipping > 0 ? fmt(sub.shipping) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.products > 0 ? fmt(sub.products) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                          {sub.seedlings > 0 ? fmt(sub.seedlings) : '—'}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total */}
                <tr className="bg-slate-800">
                  <td colSpan={3} className="px-3 py-3 font-bold text-white text-sm uppercase tracking-wider">
                    Grand Total — {rows.length} transactions across {groups.length} payouts
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {fmt(grandTotals.order_total)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {fmt(grandTotals.stripe_net)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-red-300 text-sm">
                    {fmt(-grandTotals.stripe_fee)}
                  </td>
                  <td className={`px-3 py-3 text-right font-bold tabular-nums text-sm ${grandTotals.refund_total > 0 ? 'text-red-300' : 'text-white'}`}>
                    {grandTotals.refund_total > 0 ? fmt(-grandTotals.refund_total) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.discount > 0 ? fmt(grandTotals.discount) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.tax > 0 ? fmt(grandTotals.tax) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.gift_card > 0 ? fmt(grandTotals.gift_card) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.shipping > 0 ? fmt(grandTotals.shipping) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.products > 0 ? fmt(grandTotals.products) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-white text-sm">
                    {grandTotals.seedlings > 0 ? fmt(grandTotals.seedlings) : '—'}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeReconciliationPage;
