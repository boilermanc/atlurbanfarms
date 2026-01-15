import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import LowStockAlert from '../components/LowStockAlert';
import InventoryAdjustmentModal from '../components/InventoryAdjustmentModal';
import { supabase } from '../../lib/supabase';
import {
  ProductInventorySummary,
  InventoryBatch,
  InventoryAdjustment,
  BatchStatus,
  BATCH_STATUS_CONFIG,
  ADJUSTMENT_TYPE_CONFIG,
} from '../types/inventory';

type TabType = 'by-product' | 'by-batch' | 'adjustments';

interface InventoryPageProps {
  onNavigateToBatchEdit?: (batchId?: string) => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onNavigateToBatchEdit }) => {
  const [activeTab, setActiveTab] = useState<TabType>('by-product');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [productInventory, setProductInventory] = useState<ProductInventorySummary[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Modal state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedBatchForAdjustment, setSelectedBatchForAdjustment] = useState<InventoryBatch | null>(null);

  // Fetch inventory by product
  const fetchProductInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_by_product')
        .select('*')
        .order('product_name');

      if (error) throw error;
      setProductInventory(data || []);
    } catch (err) {
      console.error('Error fetching product inventory:', err);
      setError('Failed to load product inventory');
    }
  };

  // Fetch all batches
  const fetchBatches = async () => {
    try {
      let query = supabase
        .from('inventory_batches')
        .select(`
          *,
          products (name)
        `)
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

  // Fetch adjustments
  const fetchAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select(`
          *,
          inventory_batches (
            batch_number,
            products (name)
          )
        `)
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

  // Get unique products for filter dropdown
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
    { id: 'by-product', label: 'By Product' },
    { id: 'by-batch', label: 'By Batch' },
    { id: 'adjustments', label: 'Adjustments' },
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          {activeTab === 'by-batch' && (
            <button
              onClick={handleAddBatch}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
            >
              + Add Batch
            </button>
          )}
        </div>

        {/* Low Stock Alert */}
        <LowStockAlert products={productInventory.filter((p) => p.is_low_stock)} />

        {/* Tabs */}
        <div className="border-b border-slate-700">
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
                    ? 'text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Selected Product Filter Badge */}
        {selectedProductId && activeTab === 'by-batch' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Showing batches for:</span>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium flex items-center gap-2">
              {batches.find((b) => b.product_id === selectedProductId)?.product_name || 'Selected Product'}
              <button
                onClick={clearProductFilter}
                className="hover:text-white transition-colors"
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* By Product Tab */}
            {activeTab === 'by-product' && (
              <motion.div
                key="by-product"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Available
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Allocated
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Sold
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Batches
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {productInventory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                            No inventory data available
                          </td>
                        </tr>
                      ) : (
                        productInventory.map((product) => (
                          <tr
                            key={product.product_id}
                            onClick={() => handleProductRowClick(product.product_id)}
                            className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-white font-medium">{product.product_name}</p>
                                <p className="text-sm text-slate-400">{product.category}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-white">
                              {product.total_available}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-300">
                              {product.total_allocated}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-300">
                              {product.total_sold}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-300">
                              {product.batch_count}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {product.is_low_stock ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
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

            {/* By Batch Tab */}
            {activeTab === 'by-batch' && (
              <motion.div
                key="by-batch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Filters */}
                {!selectedProductId && (
                  <div className="flex gap-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as BatchStatus | 'all')}
                      className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">All Statuses</option>
                      {Object.entries(BATCH_STATUS_CONFIG).map(([status, config]) => (
                        <option key={status} value={status}>
                          {config.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">All Products</option>
                      {uniqueProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-slate-800 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Batch #
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Seeded
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Ready
                        </th>
                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Seeded
                        </th>
                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Expected
                        </th>
                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Actual
                        </th>
                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Available
                        </th>
                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Allocated
                        </th>
                        <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {batches.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                            No batches found
                          </td>
                        </tr>
                      ) : (
                        batches.map((batch) => (
                          <tr
                            key={batch.id}
                            className="hover:bg-slate-700/50 transition-colors"
                          >
                            <td className="px-4 py-4 text-white font-mono text-sm">
                              {batch.batch_number}
                            </td>
                            <td className="px-4 py-4 text-white">
                              {batch.product_name}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${
                                  BATCH_STATUS_CONFIG[batch.status]?.color || 'bg-slate-500'
                                }`}
                              >
                                {BATCH_STATUS_CONFIG[batch.status]?.label || batch.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-slate-300 text-sm">
                              {formatDate(batch.seeded_date)}
                            </td>
                            <td className="px-4 py-4 text-center text-slate-300 text-sm">
                              {formatDate(batch.ready_date)}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {batch.quantity_seeded}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {batch.quantity_expected}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {batch.quantity_actual}
                            </td>
                            <td className="px-4 py-4 text-right text-white font-medium">
                              {batch.quantity_available}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-300">
                              {batch.quantity_allocated}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditBatch(batch.id)}
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                                  title="Edit batch"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleAdjustClick(batch)}
                                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-600 rounded transition-colors"
                                  title="Adjust inventory"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                    />
                                  </svg>
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

            {/* Adjustments Tab */}
            {activeTab === 'adjustments' && (
              <motion.div
                key="adjustments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Batch
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Adjusted By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {adjustments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            No adjustments recorded
                          </td>
                        </tr>
                      ) : (
                        adjustments.map((adj) => (
                          <tr key={adj.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 text-slate-300 text-sm">
                              {new Date(adj.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-white font-mono text-sm">
                              {adj.batch_number}
                            </td>
                            <td className="px-6 py-4 text-white">
                              {adj.product_name}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`font-medium ${
                                  ADJUSTMENT_TYPE_CONFIG[adj.adjustment_type]?.color || 'text-slate-400'
                                }`}
                              >
                                {ADJUSTMENT_TYPE_CONFIG[adj.adjustment_type]?.label || adj.adjustment_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`font-medium ${
                                  adj.quantity > 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {adj.quantity > 0 ? '+' : ''}
                                {adj.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-sm">
                              {adj.reason_code?.replace(/_/g, ' ')}
                              {adj.notes && (
                                <p className="text-xs text-slate-500 mt-1">{adj.notes}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-sm">
                              {adj.adjusted_by_name || adj.adjusted_by}
                            </td>
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

      {/* Adjustment Modal */}
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
    </AdminPageWrapper>
  );
};

export default InventoryPage;
