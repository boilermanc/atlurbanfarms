import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import LowStockAlert from '../components/LowStockAlert';
import InventoryAdjustmentModal from '../components/InventoryAdjustmentModal';
import BulkInventoryPage from './BulkInventoryPage';
import { supabase } from '../../lib/supabase';
import { Plus, Package, Edit2, PlusCircle, Printer } from 'lucide-react';
import InventoryPrintReport, { InventoryReportRow } from '../components/InventoryPrintReport';

const UNFULFILLED_ORDER_STATUSES = ['pending_payment', 'processing', 'on_hold'];
import {
  ProductInventorySummary,
  InventoryBatch,
  InventoryAdjustment,
  BatchStatus,
  BATCH_STATUS_CONFIG,
  ADJUSTMENT_TYPE_CONFIG,
} from '../types/inventory';

type TabType = 'bulk-update' | 'by-product' | 'by-batch' | 'adjustments';

interface InventoryPageProps {
  onNavigateToBatchEdit?: (batchId?: string) => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onNavigateToBatchEdit }) => {
  const [activeTab, setActiveTab] = useState<TabType>('bulk-update');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productInventory, setProductInventory] = useState<ProductInventorySummary[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);

  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedBatchForAdjustment, setSelectedBatchForAdjustment] = useState<InventoryBatch | null>(null);

  const [showPrintReport, setShowPrintReport] = useState(false);
  const [printReportLoading, setPrintReportLoading] = useState(false);
  const [printReportError, setPrintReportError] = useState<string | null>(null);
  const [printReportRows, setPrintReportRows] = useState<InventoryReportRow[]>([]);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null);

  const fetchProductInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_by_product')
        .select('*')
        .order('name');

      if (error) throw error;

      // Map data to include backward-compatible field names used by the component
      const mappedData = (data || []).map(item => ({
        ...item,
        product_id: item.id,
        product_name: item.name,
        total_available: item.quantity_available,
        // These fields may not exist in the view - provide defaults
        total_allocated: 0,
        total_sold: 0,
        batch_count: 0,
        category: '',
        is_low_stock: item.stock_status === 'low_stock',
      }));

      setProductInventory(mappedData);
    } catch (err) {
      console.error('Error fetching product inventory:', err);
      setError('Failed to load product inventory');
    }
  };

  const fetchBatches = async () => {
    try {
      let query = supabase
        .from('inventory_batches')
        .select(`*, products (name)`)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (productFilter !== 'all') {
        query = query.eq('product_id', productFilter);
      }

      if (selectedProductId) {
        query = query.eq('product_id', selectedProductId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedBatches = (data || []).map((batch: any) => ({
        ...batch,
        product_name: batch.products?.name || 'Unknown Product',
      }));

      setBatches(formattedBatches);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError('Failed to load batches');
    }
  };

  const fetchAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select(`*, inventory_batches (batch_number, products (name))`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedAdjustments = (data || []).map((adj: any) => ({
        ...adj,
        batch_number: adj.inventory_batches?.batch_number || 'N/A',
        product_name: adj.inventory_batches?.products?.name || 'Unknown',
      }));

      setAdjustments(formattedAdjustments);
    } catch (err) {
      console.error('Error fetching adjustments:', err);
      setError('Failed to load adjustments');
    }
  };

  const uniqueProducts = Array.from(
    new Set(batches.map((b) => JSON.stringify({ id: b.product_id, name: b.product_name })))
  ).map((str) => JSON.parse(str));

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      if (activeTab === 'by-product') {
        await fetchProductInventory();
      } else if (activeTab === 'by-batch') {
        await fetchBatches();
      } else {
        await fetchAdjustments();
      }

      setLoading(false);
    };

    loadData();
  }, [activeTab, statusFilter, productFilter, selectedProductId]);

  const handleProductRowClick = (productId: string) => {
    setSelectedProductId(productId);
    setActiveTab('by-batch');
  };

  const handleAddBatch = () => {
    onNavigateToBatchEdit?.();
  };

  const handleEditBatch = (batchId: string) => {
    onNavigateToBatchEdit?.(batchId);
  };

  const handleAdjustClick = (batch: InventoryBatch) => {
    setSelectedBatchForAdjustment(batch);
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSaved = () => {
    setShowAdjustmentModal(false);
    setSelectedBatchForAdjustment(null);
    fetchBatches();
    fetchAdjustments();
  };

  const clearProductFilter = () => {
    setSelectedProductId(null);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'bulk-update', label: 'Bulk Update' },
    { id: 'by-product', label: 'By Product' },
    { id: 'by-batch', label: 'By Batch' },
    { id: 'adjustments', label: 'Adjustments' },
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

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
          price: product.price,
          salePrice: product.compare_at_price,
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
            <p className="text-slate-500 text-sm mt-1">Track stock levels and batch inventory</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenPrintReport}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              <Printer size={18} />
              Print Report
            </button>
            {activeTab === 'by-batch' && (
              <button
                onClick={handleAddBatch}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
              >
                <Plus size={20} />
                Add Batch
              </button>
            )}
          </div>
        </div>

        <LowStockAlert products={productInventory.filter((p) => p.is_low_stock)} />

        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'by-batch') {
                    setSelectedProductId(null);
                  }
                }}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {selectedProductId && activeTab === 'by-batch' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Showing batches for:</span>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-2">
              {batches.find((b) => b.product_id === selectedProductId)?.product_name ||
                productInventory.find((p) => p.product_id === selectedProductId)?.product_name ||
                'Selected Product'}
              <button
                onClick={clearProductFilter}
                className="hover:text-emerald-900 transition-colors"
              >
                ×
              </button>
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'bulk-update' && (
              <motion.div
                key="bulk-update"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <BulkInventoryPage />
              </motion.div>
            )}

            {activeTab === 'by-product' && (
              <motion.div
                key="by-product"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Available</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocated</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Sold</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Batches</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productInventory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Package size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500">No inventory data available</p>
                          </td>
                        </tr>
                      ) : (
                        productInventory.map((product) => (
                          <tr
                            key={product.product_id}
                            onClick={() => handleProductRowClick(product.product_id)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-slate-800 font-medium">{product.product_name}</p>
                                <p className="text-sm text-slate-500">{product.category}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-800 font-semibold">{product.total_available}</td>
                            <td className="px-6 py-4 text-right text-slate-600">{product.total_allocated}</td>
                            <td className="px-6 py-4 text-right text-slate-600">{product.total_sold}</td>
                            <td className="px-6 py-4 text-right text-slate-600">{product.batch_count}</td>
                            <td className="px-6 py-4 text-center">
                              {product.total_available === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-200">
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                  Out of Stock
                                </span>
                              ) : product.is_low_stock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-200">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                  In Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'by-batch' && (
              <motion.div
                key="by-batch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {!selectedProductId && (
                  <div className="flex gap-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as BatchStatus | 'all')}
                      className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="all">All Statuses</option>
                      {Object.entries(BATCH_STATUS_CONFIG).map(([status, config]) => (
                        <option key={status} value={status}>{config.label}</option>
                      ))}
                    </select>

                    <select
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      className="px-4 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="all">All Products</option>
                      {uniqueProducts.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Seeded</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Ready</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Seeded</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Expected</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Available</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocated</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batches.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                <Package size={32} className="text-slate-400" />
                              </div>
                              <div>
                                <p className="text-slate-700 font-medium">
                                  {selectedProductId ? 'No batches for this product yet' : 'No batches found'}
                                </p>
                                <p className="text-slate-500 text-sm mt-1">
                                  {selectedProductId
                                    ? 'Create a batch to start tracking inventory for this product'
                                    : 'Create your first batch to start tracking inventory'}
                                </p>
                              </div>
                              <button
                                onClick={handleAddBatch}
                                className="mt-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                              >
                                + Add First Batch
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        batches.map((batch) => (
                          <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-slate-800 font-mono text-sm">{batch.batch_number}</td>
                            <td className="px-4 py-4 text-slate-800">{batch.product_name}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold text-white ${BATCH_STATUS_CONFIG[batch.status]?.color || 'bg-slate-500'}`}>
                                {BATCH_STATUS_CONFIG[batch.status]?.label || batch.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-slate-600 text-sm">{formatDate(batch.seeded_date)}</td>
                            <td className="px-4 py-4 text-center text-slate-600 text-sm">{formatDate(batch.ready_date)}</td>
                            <td className="px-4 py-4 text-right text-slate-600">{batch.quantity_seeded}</td>
                            <td className="px-4 py-4 text-right text-slate-600">{batch.quantity_expected}</td>
                            <td className="px-4 py-4 text-right text-slate-600">{batch.quantity_actual}</td>
                            <td className="px-4 py-4 text-right text-slate-800 font-semibold">{batch.quantity_available}</td>
                            <td className="px-4 py-4 text-right text-slate-600">{batch.quantity_allocated}</td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditBatch(batch.id)}
                                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                  title="Edit batch"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleAdjustClick(batch)}
                                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                                  title="Adjust inventory"
                                >
                                  <PlusCircle size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'adjustments' && (
              <motion.div
                key="adjustments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjusted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adjustments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                            No adjustments recorded
                          </td>
                        </tr>
                      ) : (
                        adjustments.map((adj) => (
                          <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-600 text-sm">
                              {new Date(adj.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-800 font-mono text-sm">{adj.batch_number}</td>
                            <td className="px-6 py-4 text-slate-800">{adj.product_name}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`font-medium ${ADJUSTMENT_TYPE_CONFIG[adj.adjustment_type]?.color || 'text-slate-500'}`}>
                                {ADJUSTMENT_TYPE_CONFIG[adj.adjustment_type]?.label || adj.adjustment_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-semibold ${adj.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">
                              {adj.reason_code?.replace(/_/g, ' ')}
                              {adj.notes && <p className="text-xs text-slate-400 mt-1">{adj.notes}</p>}
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">{adj.adjusted_by_name || adj.adjusted_by}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {showAdjustmentModal && selectedBatchForAdjustment && (
        <InventoryAdjustmentModal
          batch={selectedBatchForAdjustment}
          onClose={() => {
            setShowAdjustmentModal(false);
            setSelectedBatchForAdjustment(null);
          }}
          onSave={handleAdjustmentSaved}
        />
      )}
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
