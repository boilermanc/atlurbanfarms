import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Receipt, Loader2, AlertCircle, Download } from 'lucide-react';

// --- Types ---

interface SalesTaxRow {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  shipping_state: string | null;
  total_seedlings: number;
  total_products: number;
  total_shipping: number;
  total_tax: number;
  total_order: number;
  paid_date: string;
  is_guest: boolean;
}

type Quarter = 1 | 2 | 3 | 4;

interface QuarterRange {
  start: string;          // YYYY-MM-DD, inclusive period start
  endExclusive: string;   // YYYY-MM-DD, first day of next quarter (sent to RPC)
  label: string;          // "Q1 2026 (Jan 1 – Mar 31)"
}

// --- Helpers ---

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// US Eastern offset for a YYYY-MM-DD date.
// DST: 2nd Sunday of March → 1st Sunday of November. Matches the verification
// SQL ('2026-01-01 00:00:00-05', '2026-04-01 00:00:00-04') exactly.
function easternOffset(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dateMs = Date.UTC(y, m - 1, d, 12);
  const marchFirst = new Date(Date.UTC(y, 2, 1));
  const firstSundayMarch = 1 + ((7 - marchFirst.getUTCDay()) % 7);
  const dstStart = Date.UTC(y, 2, firstSundayMarch + 7);
  const novFirst = new Date(Date.UTC(y, 10, 1));
  const firstSundayNov = 1 + ((7 - novFirst.getUTCDay()) % 7);
  const dstEnd = Date.UTC(y, 10, firstSundayNov);
  return dateMs >= dstStart && dateMs < dstEnd ? '-04:00' : '-05:00';
}

function quarterRange(year: number, q: Quarter): QuarterRange {
  const startMonth = (q - 1) * 3;
  const endMonthExclusive = startMonth + 3;
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endYear = endMonthExclusive === 12 ? year + 1 : year;
  const endMonthAdj = endMonthExclusive === 12 ? 0 : endMonthExclusive;
  const endExclusive = `${endYear}-${String(endMonthAdj + 1).padStart(2, '0')}-01`;
  const inclusiveEndMonth = startMonth + 2;
  const lastDay = new Date(year, inclusiveEndMonth + 1, 0).getDate();
  const label = `Q${q} ${year} (${MONTH_NAMES[startMonth]} 1 – ${MONTH_NAMES[inclusiveEndMonth]} ${lastDay})`;
  return { start, endExclusive, label };
}

function currentQuarter(): { year: number; q: Quarter } {
  const now = new Date();
  return { year: now.getFullYear(), q: (Math.floor(now.getMonth() / 3) + 1) as Quarter };
}

function previousQuarter(): { year: number; q: Quarter } {
  const { year, q } = currentQuarter();
  if (q === 1) return { year: year - 1, q: 4 };
  return { year, q: (q - 1) as Quarter };
}

function dateMinusOneDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatPaidDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'America/New_York',
  });
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// --- Component ---

const SalesTaxReportPage: React.FC = () => {
  const initial = useMemo(() => {
    const { year, q } = previousQuarter();
    return quarterRange(year, q);
  }, []);

  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.endExclusive); // exclusive upper bound passed to RPC
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [activeLabel, setActiveLabel] = useState(initial.label);
  const [rows, setRows] = useState<SalesTaxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = useCallback(async (start: string, endExclusive: string, exclude: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_sales_tax_report', {
        p_start_date: `${start}T00:00:00${easternOffset(start)}`,
        p_end_date: `${endExclusive}T00:00:00${easternOffset(endExclusive)}`,
        p_exclude_internal: exclude,
      });
      if (rpcError) throw rpcError;
      setRows((data || []) as SalesTaxRow[]);
    } catch (err: unknown) {
      console.error('SalesTaxReport error:', err);
      const message = err instanceof Error ? err.message : 'Failed to load sales tax report.';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: previous quarter
  useEffect(() => {
    runReport(initial.start, initial.endExclusive, excludeInternal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectQuarter = (year: number, q: Quarter) => {
    const r = quarterRange(year, q);
    setStartDate(r.start);
    setEndDate(r.endExclusive);
    setActiveLabel(r.label);
    runReport(r.start, r.endExclusive, excludeInternal);
  };

  const handleRunReport = () => {
    const incEnd = dateMinusOneDay(endDate);
    setActiveLabel(`${startDate} – ${incEnd}`);
    runReport(startDate, endDate, excludeInternal);
  };

  const handleToggleInternal = () => {
    const next = !excludeInternal;
    setExcludeInternal(next);
    runReport(startDate, endDate, next);
  };

  const summary = useMemo(() => {
    return {
      orderCount: rows.length,
      totalSeedlings: rows.reduce((s, r) => s + (Number(r.total_seedlings) || 0), 0),
      totalProducts: rows.reduce((s, r) => s + (Number(r.total_products) || 0), 0),
      totalShipping: rows.reduce((s, r) => s + (Number(r.total_shipping) || 0), 0),
      totalTax: rows.reduce((s, r) => s + (Number(r.total_tax) || 0), 0),
      totalOrder: rows.reduce((s, r) => s + (Number(r.total_order) || 0), 0),
    };
  }, [rows]);

  const downloadCsv = () => {
    if (rows.length === 0) return;
    const headers = ['Order Number', 'Paid Date', 'Customer Name', 'Customer Email', 'Shipping State', 'Total Seedlings', 'Total Products', 'Total Shipping', 'Total Tax'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        escapeCsv(r.order_number),
        escapeCsv(formatPaidDate(r.paid_date)),
        escapeCsv(r.customer_name),
        escapeCsv(r.customer_email),
        escapeCsv(r.shipping_state),
        String(r.total_seedlings ?? 0),
        (Number(r.total_products) || 0).toFixed(2),
        (Number(r.total_shipping) || 0).toFixed(2),
        (Number(r.total_tax) || 0).toFixed(2),
      ].join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-tax-${startDate}-to-${dateMinusOneDay(endDate)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Preset button definitions
  const { year: curYear, q: curQ } = currentQuarter();
  const { year: prevYear, q: prevQ } = previousQuarter();
  const prevYearYear = curYear - 1;

  const presets: Array<{ label: string; year: number; q: Quarter }> = [
    { label: 'Previous Quarter', year: prevYear, q: prevQ },
    { label: 'Current Quarter', year: curYear, q: curQ },
    { label: `${prevYearYear} Q1`, year: prevYearYear, q: 1 },
    { label: `${prevYearYear} Q2`, year: prevYearYear, q: 2 },
    { label: `${prevYearYear} Q3`, year: prevYearYear, q: 3 },
    { label: `${prevYearYear} Q4`, year: prevYearYear, q: 4 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <Receipt className="text-green-600" size={28} />
        <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Sales Tax Report</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Georgia DOR quarterly filings are due Apr 20, Jul 20, Oct 20, Jan 20.
      </p>

      {/* Quarter presets */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quick Select</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const r = quarterRange(p.year, p.q);
              const isActive = startDate === r.start && endDate === r.endExclusive;
              return (
                <button
                  key={p.label}
                  onClick={() => selectQuarter(p.year, p.q)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom date range */}
        <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              End Date <span className="text-slate-400 font-normal">(exclusive)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleRunReport}
            disabled={loading || !startDate || !endDate}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
            Run Report
          </button>

          <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={handleToggleInternal}
              className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
            />
            <span className="text-sm text-slate-700">Exclude internal (@atlurbanfarms.com) orders</span>
          </label>
        </div>
      </div>

      {/* Active period label */}
      <div className="mb-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Reporting period:</span> {activeLabel}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-green-600" size={32} />
        </div>
      )}

      {/* Summary */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Orders</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{summary.orderCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Seedlings</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{summary.totalSeedlings.toLocaleString()}</div>
            </div>
            <div className="bg-green-50 rounded-xl border-2 border-green-500 p-4 ring-1 ring-green-200 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-green-700 font-bold">Total Products</div>
              <div className="text-3xl font-extrabold text-green-700 mt-1">{formatCurrency(summary.totalProducts)}</div>
              <div className="text-[11px] text-green-700/80 font-medium mt-1">Filing base (GA DOR)</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Shipping</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.totalShipping)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Tax Collected</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalTax)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6 text-xs">
            <p className="text-slate-600 italic">
              Georgia sales tax is filed on the <span className="font-semibold text-slate-800">Total Products</span> amount only.
              Shipping is an optional service and is not taxed.
            </p>
            <p className="text-slate-500">
              Grand total incl. shipping &amp; tax:{' '}
              <span className="font-semibold text-slate-700">{formatCurrency(summary.totalOrder)}</span>
            </p>
          </div>
        </>
      )}

      {/* Results */}
      {!loading && !error && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          No orders with tax in this period.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800 font-admin-display">Orders ({rows.length})</h2>
            <button
              onClick={downloadCsv}
              className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Order #</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Paid Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">State</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Seedlings</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Products</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Shipping</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Tax</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const stateCode = (r.shipping_state || '').trim().toUpperCase();
                  const isNonGA = stateCode !== '' && stateCode !== 'GA';
                  return (
                    <tr key={r.order_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-3 px-4">
                        <a
                          href={`/admin/orders/${r.order_id}`}
                          className="text-green-700 hover:text-green-900 font-medium font-mono text-xs"
                        >
                          {r.order_number}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{formatPaidDate(r.paid_date)}</td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{r.customer_name || '—'}</div>
                        {r.customer_email && (
                          <div className="text-xs text-slate-500">{r.customer_email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.shipping_state ? (
                          isNonGA ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold"
                              title="Non-GA order — verify before filing"
                            >
                              <AlertCircle size={12} />
                              {r.shipping_state}
                            </span>
                          ) : (
                            <span className="text-slate-700">{r.shipping_state}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">{(Number(r.total_seedlings) || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(Number(r.total_products) || 0)}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(Number(r.total_shipping) || 0)}</td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(Number(r.total_tax) || 0)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-800 font-bold bg-slate-50">
                  <td className="py-3 px-4 text-slate-900" colSpan={4}>TOTALS</td>
                  <td className="py-3 px-4 text-right text-slate-900">{summary.totalSeedlings.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-green-700">{formatCurrency(summary.totalProducts)}</td>
                  <td className="py-3 px-4 text-right text-slate-900">{formatCurrency(summary.totalShipping)}</td>
                  <td className="py-3 px-4 text-right text-green-700">{formatCurrency(summary.totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTaxReportPage;
