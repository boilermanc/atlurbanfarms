import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import ReportChart from '../components/ReportChart';
import {
  useSalesReport,
  useProductsReport,
  useCustomersReport,
  useShippingReport,
} from '../hooks/useReports';

type ReportType = 'sales' | 'products' | 'customers' | 'shipping';
type DatePreset = 'today' | 'week' | 'month' | 'custom';

const REPORT_TYPES: { id: ReportType; label: string; icon: JSX.Element }[] = [
  {
    id: 'sales',
    label: 'Sales',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'products',
    label: 'Products',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'shipping',
    label: 'Shipping',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    ),
  },
];

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (datePreset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { startDate: weekAgo.toISOString().split('T')[0], endDate: todayStr };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return { startDate: monthAgo.toISOString().split('T')[0], endDate: todayStr };
      }
      case 'custom':
        return {
          startDate: customStartDate || todayStr,
          endDate: customEndDate || todayStr,
        };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch report data
  const salesReport = useSalesReport(dateRange.startDate, dateRange.endDate);
  const productsReport = useProductsReport(dateRange.startDate, dateRange.endDate);
  const customersReport = useCustomersReport(dateRange.startDate, dateRange.endDate);
  const shippingReport = useShippingReport(dateRange.startDate, dateRange.endDate);

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // CSV Export helpers
  const downloadCSV = (data: string[][], filename: string) => {
    const csvContent = data
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSalesCSV = () => {
    if (!salesReport.data) return;
    const headers = ['Date', 'Revenue', 'Orders'];
    const rows = salesReport.data.dailySales.map((d) => [
      d.date,
      d.revenue.toFixed(2),
      d.orders.toString(),
    ]);
    downloadCSV([headers, ...rows], 'sales-report');
  };

  const exportProductsCSV = () => {
    if (!productsReport.data) return;
    const headers = ['Product', 'Units Sold', 'Revenue'];
    const rows = productsReport.data.bestSellers.map((p) => [
      p.name,
      p.unitsSold.toString(),
      p.revenue.toFixed(2),
    ]);
    downloadCSV([headers, ...rows], 'products-report');
  };

  const exportCustomersCSV = () => {
    if (!customersReport.data) return;
    const headers = ['Name', 'Email', 'Orders', 'Total Spent'];
    const rows = customersReport.data.topCustomers.map((c) => [
      c.name,
      c.email,
      c.orders.toString(),
      c.totalSpent.toFixed(2),
    ]);
    downloadCSV([headers, ...rows], 'customers-report');
  };

  const exportShippingCSV = () => {
    if (!shippingReport.data) return;
    const headers = ['Status', 'Count'];
    const rows = shippingReport.data.statusBreakdown.map((s) => [
      s.status,
      s.count.toString(),
    ]);
    downloadCSV([headers, ...rows], 'shipping-report');
  };

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Error component
  const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
      {message}
    </div>
  );

  // Summary card component
  const SummaryCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
  }> = ({ title, value, subtitle }) => (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="text-sm text-slate-400 mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="text-slate-400 text-sm mt-1">
              Analytics and insights for your business
            </p>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeReport === report.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {report.icon}
              {report.label}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Preset Buttons */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      datePreset === preset.id
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}

            {/* Date Range Display */}
            <div className="text-sm text-slate-400">
              {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
            </div>
          </div>
        </div>

        {/* Report Content */}
        <AnimatePresence mode="wait">
          {/* Sales Report */}
          {activeReport === 'sales' && (
            <motion.div
              key="sales"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {salesReport.loading ? (
                <LoadingSpinner />
              ) : salesReport.error ? (
                <ErrorMessage message={salesReport.error} />
              ) : salesReport.data && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                      title="Total Revenue"
                      value={formatCurrency(salesReport.data.summary.totalRevenue)}
                    />
                    <SummaryCard
                      title="Total Orders"
                      value={salesReport.data.summary.totalOrders.toString()}
                    />
                    <SummaryCard
                      title="Average Order Value"
                      value={formatCurrency(salesReport.data.summary.averageOrderValue)}
                    />
                  </div>

                  {/* Revenue Chart */}
                  <div className="bg-slate-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Revenue by Day</h3>
                    </div>
                    <ReportChart
                      type="line"
                      data={salesReport.data.dailySales.map((d) => ({
                        label: formatDate(d.date),
                        value: d.revenue,
                      }))}
                      height={250}
                      formatValue={formatCurrency}
                    />
                  </div>

                  {/* Daily Sales Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Daily Summary</h3>
                      <button
                        onClick={exportSalesCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Orders</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {salesReport.data.dailySales.slice().reverse().map((day) => (
                            <tr key={day.date} className="hover:bg-slate-700/50">
                              <td className="px-6 py-3 text-slate-300">{formatDate(day.date)}</td>
                              <td className="px-6 py-3 text-right text-white">{day.orders}</td>
                              <td className="px-6 py-3 text-right text-emerald-400 font-medium">
                                {formatCurrency(day.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Products Report */}
          {activeReport === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {productsReport.loading ? (
                <LoadingSpinner />
              ) : productsReport.error ? (
                <ErrorMessage message={productsReport.error} />
              ) : productsReport.data && (
                <>
                  {/* Best Sellers Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Best Sellers</h3>
                      <button
                        onClick={exportProductsCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Product</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Units Sold</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {productsReport.data.bestSellers.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                No sales data available for this period
                              </td>
                            </tr>
                          ) : (
                            productsReport.data.bestSellers.map((product, i) => (
                              <tr key={product.id} className="hover:bg-slate-700/50">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-500 text-sm">#{i + 1}</span>
                                    <span className="text-white font-medium">{product.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right text-white">{product.unitsSold}</td>
                                <td className="px-6 py-3 text-right text-emerald-400 font-medium">
                                  {formatCurrency(product.revenue)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Low Stock Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Low Stock Alert</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Product</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Current Stock</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Threshold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {productsReport.data.lowStock.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                All products are well stocked
                              </td>
                            </tr>
                          ) : (
                            productsReport.data.lowStock.map((product) => (
                              <tr key={product.id} className="hover:bg-slate-700/50">
                                <td className="px-6 py-3 text-white font-medium">{product.name}</td>
                                <td className="px-6 py-3 text-right">
                                  <span className={`font-medium ${product.currentStock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                    {product.currentStock}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-right text-slate-400">{product.threshold}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Category Breakdown Chart */}
                  <div className="bg-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Category Breakdown</h3>
                    {productsReport.data.categoryBreakdown.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">
                        No category data available for this period
                      </div>
                    ) : (
                      <ReportChart
                        type="pie"
                        data={productsReport.data.categoryBreakdown.map((c) => ({
                          label: c.category,
                          value: c.revenue,
                        }))}
                        height={250}
                        formatValue={formatCurrency}
                      />
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Customers Report */}
          {activeReport === 'customers' && (
            <motion.div
              key="customers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {customersReport.loading ? (
                <LoadingSpinner />
              ) : customersReport.error ? (
                <ErrorMessage message={customersReport.error} />
              ) : customersReport.data && (
                <>
                  {/* New vs Returning Chart */}
                  <div className="bg-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">New vs Returning Customers</h3>
                    <ReportChart
                      type="pie"
                      data={[
                        { label: 'New Customers', value: customersReport.data.customerStats.newCustomers, color: '#10b981' },
                        { label: 'Returning Customers', value: customersReport.data.customerStats.returningCustomers, color: '#3b82f6' },
                      ]}
                      height={200}
                    />
                  </div>

                  {/* Top Customers Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Top Customers</h3>
                      <button
                        onClick={exportCustomersCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Email</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Orders</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Total Spent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {customersReport.data.topCustomers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                No customer data available for this period
                              </td>
                            </tr>
                          ) : (
                            customersReport.data.topCustomers.map((customer) => (
                              <tr key={customer.id} className="hover:bg-slate-700/50">
                                <td className="px-6 py-3 text-white font-medium">{customer.name}</td>
                                <td className="px-6 py-3 text-slate-300">{customer.email}</td>
                                <td className="px-6 py-3 text-right text-white">{customer.orders}</td>
                                <td className="px-6 py-3 text-right text-emerald-400 font-medium">
                                  {formatCurrency(customer.totalSpent)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Attribution Breakdown */}
                  <div className="bg-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Attribution Breakdown</h3>
                    {customersReport.data.attribution.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">
                        No attribution data available for this period
                      </div>
                    ) : (
                      <ReportChart
                        type="bar"
                        data={customersReport.data.attribution.map((a) => ({
                          label: a.source,
                          value: a.count,
                        }))}
                        height={200}
                      />
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Shipping Report */}
          {activeReport === 'shipping' && (
            <motion.div
              key="shipping"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {shippingReport.loading ? (
                <LoadingSpinner />
              ) : shippingReport.error ? (
                <ErrorMessage message={shippingReport.error} />
              ) : shippingReport.data && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SummaryCard
                      title="Average Transit Time"
                      value={shippingReport.data.avgTransitTime > 0
                        ? `${shippingReport.data.avgTransitTime.toFixed(1)} days`
                        : 'N/A'}
                    />
                    <SummaryCard
                      title="Delivery Exceptions"
                      value={shippingReport.data.deliveryExceptions.length.toString()}
                      subtitle="Orders requiring attention"
                    />
                  </div>

                  {/* Orders by Status Chart */}
                  <div className="bg-slate-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Orders by Status</h3>
                      <button
                        onClick={exportShippingCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    {shippingReport.data.statusBreakdown.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">
                        No shipping data available for this period
                      </div>
                    ) : (
                      <ReportChart
                        type="pie"
                        data={shippingReport.data.statusBreakdown.map((s) => ({
                          label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
                          value: s.count,
                        }))}
                        height={250}
                      />
                    )}
                  </div>

                  {/* Shipments by Carrier Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Shipments by Carrier</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Carrier</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Shipments</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Avg Transit (Days)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {shippingReport.data.carrierStats.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                No carrier data available for this period
                              </td>
                            </tr>
                          ) : (
                            shippingReport.data.carrierStats.map((carrier) => (
                              <tr key={carrier.carrier} className="hover:bg-slate-700/50">
                                <td className="px-6 py-3 text-white font-medium">{carrier.carrier}</td>
                                <td className="px-6 py-3 text-right text-white">{carrier.shipments}</td>
                                <td className="px-6 py-3 text-right text-slate-300">
                                  {carrier.avgTransitDays > 0 ? carrier.avgTransitDays.toFixed(1) : '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Delivery Exceptions Table */}
                  <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                      <h3 className="text-lg font-semibold text-white">Delivery Exceptions</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-700/30">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Order #</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Issue</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {shippingReport.data.deliveryExceptions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                No delivery exceptions
                              </td>
                            </tr>
                          ) : (
                            shippingReport.data.deliveryExceptions.map((exception) => (
                              <tr key={exception.orderId} className="hover:bg-slate-700/50">
                                <td className="px-6 py-3 font-mono text-white">{exception.orderNumber}</td>
                                <td className="px-6 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    exception.status === 'cancelled'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {exception.status}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-slate-300">{exception.issue}</td>
                                <td className="px-6 py-3 text-slate-400 text-sm">{formatDate(exception.date)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  );
};

export default ReportsPage;
