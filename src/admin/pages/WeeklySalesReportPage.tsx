import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';

// Note: Cell styling (bold, fill colors, alternating rows) requires xlsx-js-style.
// To enable: `npm install xlsx-js-style` and change the import above to:
//   import * as XLSX from 'xlsx-js-style';
// The API is identical — styles will then render in the output file.

// --- Helpers ---

const OTHER_KEYWORDS = ['clip', 'tag', 'kit', 'accessory', 'tool', 'pot', 'tray', 'soil', 'fertilizer'];

function isOtherItem(productName: string): boolean {
  const lower = (productName || '').toLowerCase();
  return OTHER_KEYWORDS.some(kw => lower.includes(kw));
}

function getCurrentWeekDates(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: toDateInputValue(monday),
    end: toDateInputValue(sunday),
  };
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// --- Types ---

interface OrderItem {
  quantity: number;
  product_name: string;
  line_total: number;
}

type OrderType = 'PICKUP' | 'REPLACEMENT' | 'SHIP';

interface NormalizedOrder {
  orderId: string;
  orderDate: Date;
  shippingIncome: number;
  seedlingQty: number;
  otherQty: number;
  seedlingIncome: number;
  discount: number;
  orderTotal: number;
  firstName: string;
  lastName: string;
  state: string;
  customerNote: string;
  tax: number;
  otherRevenue: number;
  shippingMethod: string;
  type: OrderType;
}

// --- Styles (render with xlsx-js-style) ---

const STYLE_HEADER: object = {
  font: { name: 'Arial', sz: 10, bold: true },
  fill: { fgColor: { rgb: 'C6EFCE' } },
};

const STYLE_SECTION: object = {
  font: { name: 'Arial', sz: 10, bold: true },
  fill: { fgColor: { rgb: 'FFEB9C' } },
};

const STYLE_BOLD: object = {
  font: { name: 'Arial', sz: 10, bold: true },
};

const STYLE_ROW_ALT: object = {
  fill: { fgColor: { rgb: 'F5F5F5' } },
};

const STYLE_DEFAULT: object = {
  font: { name: 'Arial', sz: 10 },
};

// --- Normalize helpers ---

function classifyLegacy(o: { shipping: number; subtotal: number }): OrderType {
  if (o.shipping === 0 && o.subtotal < 5) return 'REPLACEMENT';
  if (o.shipping === 0) return 'PICKUP';
  return 'SHIP';
}

function classifyNew(o: { is_pickup: boolean; promotion_code?: string }): OrderType {
  if ((o.promotion_code || '').toLowerCase().includes('replacement')) return 'REPLACEMENT';
  if (o.is_pickup) return 'PICKUP';
  return 'SHIP';
}

function tallyItems(items: OrderItem[]) {
  let seedlingQty = 0, otherQty = 0, seedlingIncome = 0, otherRevenue = 0;
  for (const item of items) {
    if (isOtherItem(item.product_name)) {
      otherQty += item.quantity;
      otherRevenue += item.line_total;
    } else {
      seedlingQty += item.quantity;
      seedlingIncome += item.line_total;
    }
  }
  return { seedlingQty, otherQty, seedlingIncome, otherRevenue };
}

// --- Component ---

const WeeklySalesReportPage: React.FC = () => {
  const defaults = getCurrentWeekDates();
  const [weekStart, setWeekStart] = useState(defaults.start);
  const [weekEnd, setWeekEnd] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<NormalizedOrder[] | null>(null);

  // --- Fetch orders ---
  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOrders(null);

    try {
      const startISO = new Date(weekStart + 'T00:00:00').toISOString();
      const endExclusive = new Date(weekEnd);
      endExclusive.setDate(endExclusive.getDate() + 1);
      const endISO = new Date(endExclusive.toISOString().split('T')[0] + 'T00:00:00').toISOString();

      const [legacyResult, newResult] = await Promise.all([
        supabase
          .from('legacy_orders')
          .select(`
            id, woo_order_id, order_date, shipping, subtotal, tax, total,
            shipping_first_name, shipping_last_name, shipping_state, status,
            legacy_order_items ( quantity, product_name, line_total )
          `)
          .gte('order_date', startISO)
          .lt('order_date', endISO)
          .eq('status', 'completed')
          .order('order_date', { ascending: true }),
        supabase
          .from('orders')
          .select(`
            id, order_number, created_at, shipping_cost, subtotal, tax, total,
            shipping_first_name, shipping_last_name, shipping_state,
            shipping_method_name, discount_amount, promotion_code, is_pickup, status,
            order_items ( quantity, product_name, line_total )
          `)
          .gte('created_at', startISO)
          .lt('created_at', endISO)
          .not('status', 'in', '("cancelled","pending")')
          .order('created_at', { ascending: true }),
      ]);

      if (legacyResult.error) throw legacyResult.error;
      if (newResult.error) throw newResult.error;

      const normalized: NormalizedOrder[] = [];

      // Legacy orders
      for (const o of legacyResult.data || []) {
        const items: OrderItem[] = o.legacy_order_items || [];
        const tally = tallyItems(items);
        normalized.push({
          orderId: String(o.woo_order_id || o.id),
          orderDate: new Date(o.order_date),
          shippingIncome: o.shipping || 0,
          ...tally,
          discount: 0,
          orderTotal: o.total || 0,
          firstName: o.shipping_first_name || '',
          lastName: o.shipping_last_name || '',
          state: o.shipping_state || '',
          customerNote: '',
          tax: o.tax || 0,
          shippingMethod: '',
          type: classifyLegacy(o),
        });
      }

      // New orders
      for (const o of newResult.data || []) {
        const items: OrderItem[] = o.order_items || [];
        const tally = tallyItems(items);
        normalized.push({
          orderId: String(o.order_number || o.id),
          orderDate: new Date(o.created_at),
          shippingIncome: o.shipping_cost || 0,
          ...tally,
          discount: o.discount_amount || 0,
          orderTotal: o.total || 0,
          firstName: o.shipping_first_name || '',
          lastName: o.shipping_last_name || '',
          state: o.shipping_state || '',
          customerNote: '',
          tax: o.tax || 0,
          shippingMethod: o.shipping_method_name || '',
          type: classifyNew(o),
        });
      }

      // Sort by date
      normalized.sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime());

      if (normalized.length === 0) {
        setError('No orders found for this date range.');
      }
      setOrders(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load orders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  // --- Summary ---
  const summary = useMemo(() => {
    if (!orders || orders.length === 0) return null;

    const pickups = orders.filter(o => o.type === 'PICKUP');
    const replacements = orders.filter(o => o.type === 'REPLACEMENT');
    const shipped = orders.filter(o => o.type === 'SHIP');

    return {
      totalOrders: orders.length,
      totalSeedlings: orders.reduce((s, o) => s + o.seedlingQty, 0),
      totalShipping: orders.reduce((s, o) => s + o.shippingIncome, 0),
      totalSeedlingIncome: orders.reduce((s, o) => s + o.seedlingIncome, 0),
      totalRevenue: orders.reduce((s, o) => s + o.orderTotal, 0),
      pickupCount: pickups.length,
      replacementCount: replacements.length,
      shippedCount: shipped.length,
    };
  }, [orders]);

  // --- Excel export ---
  const downloadExcel = useCallback(() => {
    if (!orders || orders.length === 0) return;

    const pickups = orders.filter(o => o.type === 'PICKUP');
    const replacements = orders.filter(o => o.type === 'REPLACEMENT');
    const shipped = orders.filter(o => o.type === 'SHIP');

    // Order size distribution (shipped orders only)
    const sizeCount = (min: number, max: number) =>
      shipped.filter(o => o.seedlingQty >= min && o.seedlingQty <= max).length;
    const small = sizeCount(1, 10);
    const med = sizeCount(11, 20);
    const lrg = sizeCount(21, 40);
    const fortyPlus = shipped.filter(o => o.seedlingQty > 40).length;

    // Totals across ALL orders
    const totalSeedlings = orders.reduce((s, o) => s + o.seedlingQty, 0);
    const totalShipping = orders.reduce((s, o) => s + o.shippingIncome, 0);
    const totalSubtotal = orders.reduce((s, o) => s + o.seedlingIncome + o.otherRevenue, 0);
    const totalSeedlingIncome = orders.reduce((s, o) => s + o.seedlingIncome, 0);
    const totalDiscounts = orders.reduce((s, o) => s + o.discount, 0);
    const totalRevenue = orders.reduce((s, o) => s + o.orderTotal, 0);
    const avgPerSeedling = totalSeedlings > 0 ? totalSeedlingIncome / totalSeedlings : 0;

    // Build rows
    const data: (string | number | null)[][] = [];

    // Row 0: Order size summary
    data.push([small, 'small (1-10)', med, 'med (11-20)', lrg, 'lrg (21-40)', fortyPlus, 'more 40']);

    // Row 1: Total orders + avg $/seedling
    data.push([orders.length, '', '', '', '', '', '', avgPerSeedling]);

    // Row 2: Totals
    data.push([
      orders.length, '', totalShipping, totalSubtotal, '', totalSeedlings, '',
      totalSeedlingIncome, totalDiscounts, totalRevenue, '',
      pickups.length, replacements.length, shipped.length,
    ]);

    // Row 3: Column headers
    const HEADERS = [
      'Order ID', 'Order Date', 'Shipping Income', '#Seedlings', '#Other',
      'Seedling Income', 'Discount', 'Order Total', 'Customer First', 'Customer Last',
      'State', 'Customer Note', 'Tax', '$Other', 'Shipping Method',
    ];
    data.push(HEADERS);

    // Track which rows are section headers and order data for styling
    const sectionRows: number[] = [];
    const orderDataStartRow = data.length; // after headers
    let totalDataRows = 0;

    const addSection = (label: string, list: NormalizedOrder[]) => {
      sectionRows.push(data.length);
      const sectionRow: (string | number | null)[] = new Array(15).fill('');
      sectionRow[0] = label;
      data.push(sectionRow);

      for (const o of list) {
        data.push([
          o.orderId,
          formatDateDisplay(o.orderDate),
          o.shippingIncome,
          o.seedlingQty,
          o.otherQty,
          o.seedlingIncome,
          o.discount,
          o.orderTotal,
          o.firstName,
          o.lastName,
          o.state,
          o.customerNote,
          o.tax,
          o.otherRevenue,
          o.shippingMethod,
        ]);
        totalDataRows++;
      }
    };

    addSection('PICKUPS', pickups);
    addSection('REPLACE, ETC.', replacements);
    addSection('SHIP', shipped);

    // Summary rows after all order data
    const sumShipping = orders.reduce((s, o) => s + o.shippingIncome, 0);
    const sumSeedlings = orders.reduce((s, o) => s + o.seedlingQty, 0);
    const sumOtherQty = orders.reduce((s, o) => s + o.otherQty, 0);
    const sumSeedlingIncome = orders.reduce((s, o) => s + o.seedlingIncome, 0);
    const sumDiscount = orders.reduce((s, o) => s + o.discount, 0);
    const sumTotal = orders.reduce((s, o) => s + o.orderTotal, 0);
    const sumTax = orders.reduce((s, o) => s + o.tax, 0);
    const sumOtherRev = orders.reduce((s, o) => s + o.otherRevenue, 0);
    const summaryStartRow = data.length;

    // Totals row
    data.push([
      'TOTALS', '', sumShipping, sumSeedlings, sumOtherQty,
      sumSeedlingIncome, sumDiscount, sumTotal, '', '', '', '', sumTax, sumOtherRev, '',
    ]);

    const avgShipPerOrder = shipped.length > 0 ? sumShipping / shipped.length : 0;
    data.push(['Avg Shipping/Order', '', avgShipPerOrder, '', '', '', '', '', '', '', '', '', '', '', '']);

    const sevenTimesShipped = 7 * shipped.length;
    data.push(['$7 x Shipped Orders', '', sevenTimesShipped, '', '', '', '', '', '', '', '', '', '', '', '']);

    const weeklyIncome = sumSeedlingIncome - sumDiscount;
    data.push(['Weekly Income', '', weeklyIncome, '', '', '', '', '', '', '', '', '', '', '', '']);

    const avgShipCost = shipped.length > 0 ? sumShipping / shipped.length : 0;
    data.push(['Avg Ship/Order Cost', '', avgShipCost, '', '', '', '', '', '', '', '', '', '', '', '']);

    // --- Create worksheet ---
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
      { wch: 8 },  { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
    ];

    // Merged cells for section headers
    const merges: XLSX.Range[] = [];
    for (const r of sectionRows) {
      merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
    }
    ws['!merges'] = merges;

    // Apply number formats and styles
    const CURRENCY_COLS = [2, 5, 6, 7, 12, 13];
    const NUMBER_COLS = [3, 4];

    // Helper to set cell properties
    const setCell = (r: number, c: number, style?: object, numFmt?: string) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) return;
      if (numFmt) ws[ref].z = numFmt;
      if (style) ws[ref].s = style;
    };

    // Row 3 (header row) — bold green
    for (let c = 0; c < 15; c++) {
      setCell(3, c, STYLE_HEADER);
    }

    // Section header rows — bold yellow
    for (const r of sectionRows) {
      for (let c = 0; c < 15; c++) {
        setCell(r, c, STYLE_SECTION);
      }
    }

    // Order data rows — number formats + alternating colors
    let altIndex = 0;
    for (let r = orderDataStartRow; r < summaryStartRow; r++) {
      if (sectionRows.includes(r)) {
        altIndex = 0;
        continue;
      }
      const rowStyle = altIndex % 2 === 1 ? STYLE_ROW_ALT : STYLE_DEFAULT;
      for (let c = 0; c < 15; c++) {
        setCell(r, c, rowStyle);
      }
      for (const c of CURRENCY_COLS) {
        setCell(r, c, undefined, '$#,##0.00');
      }
      for (const c of NUMBER_COLS) {
        setCell(r, c, undefined, '#,##0');
      }
      altIndex++;
    }

    // Summary rows — bold + currency format on col C
    for (let r = summaryStartRow; r < data.length; r++) {
      setCell(r, 0, STYLE_BOLD);
      setCell(r, 2, STYLE_BOLD, '$#,##0.00');
    }
    // Totals row — all numeric cols get currency/number format
    for (const c of CURRENCY_COLS) {
      setCell(summaryStartRow, c, STYLE_BOLD, '$#,##0.00');
    }
    for (const c of NUMBER_COLS) {
      setCell(summaryStartRow, c, STYLE_BOLD, '#,##0');
    }

    // Row 1 col H — avg $/seedling
    setCell(1, 7, STYLE_BOLD, '$#,##0.00');

    // Row 2 — currency formatting
    for (const c of [2, 3, 7, 8, 9]) {
      setCell(2, c, STYLE_BOLD, c === 3 || c === 5 ? '#,##0' : '$#,##0.00');
    }
    setCell(2, 5, STYLE_BOLD, '#,##0');

    // Auto-filter on header row
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3, c: 14 } }) };

    // Freeze top 4 rows (works with xlsx-js-style; community xlsx may ignore)
    if (!ws['!freeze']) {
      (ws as Record<string, unknown>)['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', state: 'frozen' };
    }

    // --- Write file ---
    const startDateObj = new Date(weekStart + 'T00:00:00');
    const mm = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(startDateObj.getDate()).padStart(2, '0');
    const sheetName = `${mm}${dd}`;
    const fileName = `ATL_Weekly_Sales_${mm}${dd}_${startDateObj.getFullYear()}.xlsx`;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  }, [orders, weekStart]);

  // --- Render ---
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="text-green-600" size={28} />
        <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Weekly Sales Report</h1>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Week Start</label>
            <input
              type="date"
              value={weekStart}
              onChange={e => setWeekStart(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Week End</label>
            <input
              type="date"
              value={weekEnd}
              onChange={e => setWeekEnd(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            Generate Report
          </button>
        </div>
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

      {/* Summary + Download */}
      {summary && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Report Summary</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500">Total Orders</div>
              <div className="text-2xl font-bold text-slate-800">{summary.totalOrders}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500">Total Seedlings</div>
              <div className="text-2xl font-bold text-slate-800">{summary.totalSeedlings.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500">Shipping Income</div>
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalShipping)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalRevenue)}</div>
            </div>
          </div>

          <div className="flex gap-6 mb-6 text-sm">
            <span className="text-slate-600">
              <span className="font-semibold text-blue-600">{summary.pickupCount}</span> Pickups
            </span>
            <span className="text-slate-600">
              <span className="font-semibold text-orange-600">{summary.replacementCount}</span> Replacements
            </span>
            <span className="text-slate-600">
              <span className="font-semibold text-green-600">{summary.shippedCount}</span> Shipped
            </span>
          </div>

          <button
            onClick={downloadExcel}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            Download Excel
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklySalesReportPage;
