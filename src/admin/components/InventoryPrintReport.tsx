import React from 'react';
import { Printer, RefreshCw, X } from 'lucide-react';

export interface InventoryReportRow {
  id: string;
  category: string;
  name: string;
  price: number;
  salePrice: number | null;
  pendingOrders: number;
  currentInventory: number;
  alertCount: number;
}

interface InventoryPrintReportProps {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  rows: InventoryReportRow[];
  generatedAt: Date | null;
  onClose: () => void;
  onRefresh: () => void;
  onPrint: () => void;
}

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPriceCell = (price: number, salePrice: number | null) => {
  if (salePrice !== null && !Number.isNaN(salePrice) && salePrice > 0) {
    return `${formatCurrency(price)} / ${formatCurrency(salePrice)}`;
  }
  return formatCurrency(price);
};

const formatTimestamp = (date: Date | null) => {
  if (!date) return 'Preparing latest snapshot...';
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface CategoryGroup {
  category: string;
  rows: InventoryReportRow[];
  varietyCount: number;
  totalInventory: number;
  totalPendingOrders: number;
  totalAlerts: number;
}

const groupByCategory = (rows: InventoryReportRow[]): CategoryGroup[] => {
  const groups: CategoryGroup[] = [];
  let currentCategory = '';
  let currentGroup: CategoryGroup | null = null;

  for (const row of rows) {
    if (row.category !== currentCategory) {
      if (currentGroup) groups.push(currentGroup);
      currentCategory = row.category;
      currentGroup = {
        category: currentCategory,
        rows: [],
        varietyCount: 0,
        totalInventory: 0,
        totalPendingOrders: 0,
        totalAlerts: 0,
      };
    }
    currentGroup!.rows.push(row);
    currentGroup!.varietyCount++;
    currentGroup!.totalInventory += row.currentInventory;
    currentGroup!.totalPendingOrders += row.pendingOrders || 0;
    currentGroup!.totalAlerts += row.alertCount || 0;
  }
  if (currentGroup) groups.push(currentGroup);

  return groups;
};

const InventoryPrintReport: React.FC<InventoryPrintReportProps> = ({
  isOpen,
  loading,
  error,
  rows,
  generatedAt,
  onClose,
  onRefresh,
  onPrint,
}) => {
  if (!isOpen) return null;

  const canPrint = !loading && rows.length > 0 && !error;
  const categoryGroups = groupByCategory(rows);

  const grandTotalVarieties = rows.length;
  const grandTotalInventory = rows.reduce((sum, r) => sum + r.currentInventory, 0);
  const grandTotalPending = rows.reduce((sum, r) => sum + (r.pendingOrders || 0), 0);

  return (
    <div className="inventory-print-overlay" role="dialog" aria-modal="true">
      <div className="inventory-print-surface print-surface">
        <div className="inventory-print-controls no-print">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Seedling Inventory Report</h2>
            <p className="text-sm text-slate-500">Live snapshot of active products</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={canPrint ? onPrint : undefined}
              disabled={!canPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-60"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close print report"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="inventory-print-content print-scroll">
          <div className="inventory-print-header">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">ATL Urban Farms</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Seedling Inventory Report</h1>
              {rows.length > 0 && (
                <p className="text-sm font-medium text-slate-700 mt-1">
                  Total Active Products: {rows.length}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Prepared</p>
              <p className="text-sm font-medium text-slate-700">{formatTimestamp(generatedAt)}</p>
            </div>
          </div>

          {loading ? (
            <div className="inventory-print-state">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm mt-3">Loading active products…</p>
            </div>
          ) : error ? (
            <div className="inventory-print-state">
              <p className="text-red-600 font-medium">{error}</p>
              <p className="text-slate-500 text-sm mt-1">Try refreshing to fetch the latest snapshot.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="inventory-print-state">
              <p className="text-slate-600 font-medium">No active products to show.</p>
              <p className="text-slate-500 text-sm mt-1">Activate products to include them in this report.</p>
            </div>
          ) : (
            <>
            <table className="inventory-print-table">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-left-col">Product Name</th>
                  <th>Online Inventory</th>
                  <th>New Inventory</th>
                  <th>Alerts</th>
                  <th>Price / Sale Price</th>
                </tr>
              </thead>
              <tbody>
                {categoryGroups.map((group) => (
                  <React.Fragment key={group.category}>
                    {group.rows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={index === 0 ? 'inventory-print-row category-break' : 'inventory-print-row'}
                      >
                        <td>{row.category}</td>
                        <td className="text-left-col">
                          <span className="product-name">{row.name}</span>
                        </td>
                        <td>{row.currentInventory}</td>
                        <td></td>
                        <td>{row.alertCount > 0 ? row.alertCount : ''}</td>
                        <td>{formatPriceCell(row.price, row.salePrice)}</td>
                      </tr>
                    ))}
                    <tr className="subtotal-row">
                      <td></td>
                      <td className="subtotal-label">
                        {group.category} Subtotal
                      </td>
                      <td className="subtotal-value">{group.totalInventory}</td>
                      <td></td>
                      <td className="subtotal-value">{group.totalAlerts || ''}</td>
                      <td className="subtotal-info">
                        {group.varietyCount} varieties &middot; {group.totalPendingOrders} pending
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <table className="inventory-print-table grand-total-table">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <tbody>
                <tr className="grand-total-row">
                  <td></td>
                  <td className="grand-total-label">GRAND TOTAL</td>
                  <td className="grand-total-value">{grandTotalInventory}</td>
                  <td></td>
                  <td></td>
                  <td className="grand-total-info">
                    {grandTotalVarieties} varieties &middot; {grandTotalPending} pending
                  </td>
                </tr>
              </tbody>
            </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPrintReport;
