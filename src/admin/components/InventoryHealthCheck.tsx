import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldAlert, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface InventoryDriftRow {
  id: string;
  name: string;
  slug: string | null;
  category_name: string | null;
  track_inventory: boolean;
  quantity_available: number;
  stock_status: string | null;
  drift_reason: 'tracking_disabled' | 'stale_stock_status' | null;
}

interface InventoryHealthCheckProps {
  onEditProduct?: (productId: string) => void;
}

const InventoryHealthCheck: React.FC<InventoryHealthCheckProps> = ({ onEditProduct }) => {
  const [rows, setRows] = useState<InventoryDriftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDrift = async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('v_inventory_drift')
        .select('id, name, slug, category_name, track_inventory, quantity_available, stock_status, drift_reason')
        .order('category_name', { ascending: true })
        .order('name', { ascending: true });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        setRows((data as InventoryDriftRow[]) ?? []);
      }
      setLoading(false);
    };

    fetchDrift();
    return () => {
      cancelled = true;
    };
  }, []);

  const untracked = rows.filter((r) => r.drift_reason === 'tracking_disabled');
  const stale = rows.filter((r) => r.drift_reason === 'stale_stock_status');

  const handleRowClick = (productId: string) => {
    if (onEditProduct) {
      onEditProduct(productId);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100">
            <ShieldAlert size={20} className="text-slate-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 font-admin-display">
              Inventory Health Check
            </h3>
            <p className="text-sm text-slate-500">
              Catches products misconfigured in a way that silently breaks stock checks.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 brand-spinner rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Couldn't load inventory drift data.</p>
            <p className="text-xs text-red-600 mt-1 font-mono break-all">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              If this is a missing-view error, run the SQL in
              <code className="mx-1 px-1 py-0.5 bg-red-100 rounded">supabase/manual_fixes/2026-05-11_inventory_drift_view.sql</code>
              in the Supabase SQL Editor.
            </p>
          </div>
        </div>
      ) : untracked.length === 0 && stale.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">
            All inventory configurations look healthy.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <DriftSection
            tone="warning"
            title="Untracked products (review periodically)"
            note="If a seedling appears here, enable Track Inventory on its product edit page."
            rows={untracked}
            emptyLabel="No untracked products."
            onRowClick={handleRowClick}
          />
          <DriftSection
            tone="info"
            title="Stale stock status (cosmetic)"
            note="These products are out of stock but stock_status still says in_stock. Storefront is unaffected; this is admin-display cleanup only."
            rows={stale}
            emptyLabel="No stale stock statuses."
            onRowClick={handleRowClick}
          />
        </div>
      )}
    </div>
  );
};

interface DriftSectionProps {
  tone: 'warning' | 'info';
  title: string;
  note: string;
  rows: InventoryDriftRow[];
  emptyLabel: string;
  onRowClick: (productId: string) => void;
}

const DriftSection: React.FC<DriftSectionProps> = ({ tone, title, note, rows, emptyLabel, onRowClick }) => {
  const toneStyles =
    tone === 'warning'
      ? {
          headerBg: 'bg-amber-50 border-amber-200',
          headerText: 'text-amber-800',
          headerNote: 'text-amber-700',
          icon: <AlertTriangle size={16} className="text-amber-600" />,
          countBadge: 'bg-amber-100 text-amber-700 border-amber-200',
        }
      : {
          headerBg: 'bg-blue-50 border-blue-200',
          headerText: 'text-blue-800',
          headerNote: 'text-blue-700',
          icon: <Info size={16} className="text-blue-600" />,
          countBadge: 'bg-blue-100 text-blue-700 border-blue-200',
        };

  if (rows.length === 0) {
    return (
      <div>
        <div className={`flex items-start gap-2 p-3 rounded-xl border ${toneStyles.headerBg}`}>
          {toneStyles.icon}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${toneStyles.headerText}`}>{title}</p>
            <p className={`text-xs mt-0.5 ${toneStyles.headerNote}`}>{note}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 italic mt-2 ml-1">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={`flex items-start gap-2 p-3 rounded-xl border ${toneStyles.headerBg}`}>
        {toneStyles.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold ${toneStyles.headerText}`}>{title}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${toneStyles.countBadge}`}>
              {rows.length}
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${toneStyles.headerNote}`}>{note}</p>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onRowClick(row.id)}
              className="w-full flex items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{row.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {row.category_name || 'Uncategorized'}
                  {tone === 'info' && (
                    <span className="ml-2 text-slate-400">
                      qty {row.quantity_available} · status {row.stock_status}
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InventoryHealthCheck;
