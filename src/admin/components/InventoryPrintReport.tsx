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

  return (
    <div className="inventory-print-overlay" role="dialog" aria-modal="true">
      <div className="inventory-print-surface print-surface">
        <div className="inventory-print-controls no-print">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Inventory Print Report</h2>
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
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Inventory Report</h1>
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
            <table className="inventory-print-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Product Name</th>
                  <th>Price</th>
                  <th>Sale Price</th>
                  <th>Pending Orders</th>
                  <th>Current Inventory</th>
                  <th>Counted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index, array) => {
                  const prevCategory = index > 0 ? array[index - 1].category : null;
                  const isNewCategory = row.category !== prevCategory;
                  return (
                    <tr
                      key={row.id}
                      className={isNewCategory ? 'inventory-print-row category-break' : 'inventory-print-row'}
                    >
                      <td className="category-cell">
                        {row.category}
                      </td>
                      <td>
                        <span className="product-name">{row.name}</span>
                      </td>
                      <td>{formatCurrency(row.price)}</td>
                      <td>{formatCurrency(row.salePrice)}</td>
                      <td className="numeric-cell">{row.pendingOrders || 0}</td>
                      <td className="numeric-cell">{row.currentInventory}</td>
                      <td className="counted-cell" aria-label="Counted blanks">
                        <div className="counted-box" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPrintReport;
