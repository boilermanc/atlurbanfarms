import React, { useState, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import BulkInventoryPage from './BulkInventoryPage';
import { supabase } from '../../lib/supabase';
import { Printer } from 'lucide-react';
import InventoryPrintReport, { InventoryReportRow } from '../components/InventoryPrintReport';

const UNFULFILLED_ORDER_STATUSES = ['pending_payment', 'processing', 'on_hold'];

interface InventoryPageProps {
  onNavigateToBatchEdit?: (batchId?: string) => void;
  onEditProduct?: (productId: string) => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onEditProduct }) => {
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [printReportLoading, setPrintReportLoading] = useState(false);
  const [printReportError, setPrintReportError] = useState<string | null>(null);
  const [printReportRows, setPrintReportRows] = useState<InventoryReportRow[]>([]);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null);

  const fetchInventoryPrintReport = useCallback(async () => {
    try {
      setPrintReportLoading(true);
      setPrintReportError(null);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          compare_at_price,
          quantity_available,
          category:product_categories(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;

      const mappedProducts = (productsData || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        compare_at_price:
          product.compare_at_price !== null && product.compare_at_price !== undefined
            ? Number(product.compare_at_price)
            : null,
        quantity_available: Number(product.quantity_available) || 0,
        category: product.category?.name || 'Uncategorized',
      }));

      const productIds = mappedProducts.map((product) => product.id);
      const pendingMap = new Map<string, number>();

      if (productIds.length > 0) {
        const { data: pendingData, error: pendingError } = await supabase
          .from('order_items')
          .select('product_id, quantity, orders!inner(status)')
          .in('product_id', productIds)
          .in('orders.status', UNFULFILLED_ORDER_STATUSES);

        if (pendingError) throw pendingError;

        (pendingData || []).forEach((item: any) => {
          const qty = Number(item.quantity) || 0;
          const current = pendingMap.get(item.product_id) || 0;
          pendingMap.set(item.product_id, current + qty);
        });
      }

      const rows: InventoryReportRow[] = mappedProducts
        .map((product) => ({
          id: product.id,
          category: product.category,
          name: product.name,
          price: product.compare_at_price,
          salePrice: product.price,
          pendingOrders: pendingMap.get(product.id) || 0,
          currentInventory: product.quantity_available,
        }))
        .sort((a, b) => {
          const categoryCompare = a.category.localeCompare(b.category);
          if (categoryCompare !== 0) return categoryCompare;
          return a.name.localeCompare(b.name);
        });

      setPrintReportRows(rows);
      setReportGeneratedAt(new Date());
    } catch (err: any) {
      console.error('Error building inventory print report:', err);
      setPrintReportError(err.message || 'Failed to load inventory report');
    } finally {
      setPrintReportLoading(false);
    }
  }, []);

  const handleOpenPrintReport = () => {
    setShowPrintReport(true);
    fetchInventoryPrintReport();
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6 no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Inventory</h1>
            <p className="text-slate-500 text-sm mt-1">Update stock levels for your products</p>
          </div>
          <button
            onClick={handleOpenPrintReport}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            <Printer size={18} />
            Print Report
          </button>
        </div>

        <BulkInventoryPage onEditProduct={onEditProduct} />
      </div>

      <InventoryPrintReport
        isOpen={showPrintReport}
        loading={printReportLoading}
        error={printReportError}
        rows={printReportRows}
        generatedAt={reportGeneratedAt}
        onClose={() => setShowPrintReport(false)}
        onRefresh={fetchInventoryPrintReport}
        onPrint={handlePrint}
      />
    </AdminPageWrapper>
  );
};

export default InventoryPage;
