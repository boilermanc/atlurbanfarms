import React, { useState, useMemo } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import ReportChart from '../components/ReportChart';
import { useEmailReport } from '../hooks/useEmailReports';
import { Mail, CheckCircle, XCircle, Users, Download, AlertTriangle } from 'lucide-react';

type DatePreset = 'today' | 'week' | 'month' | 'custom';

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

const EmailReportsPage: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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

  const { data, loading, error } = useEmailReport(dateRange.startDate, dateRange.endDate);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTemplateName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // CSV Export
  const downloadCSV = (rows: string[][], filename: string) => {
    const csvContent = rows
      .map(row => row.map(cell => `"${cell}"`).join(','))
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

  const exportTemplateCSV = () => {
    if (!data) return;
    const headers = ['Template', 'Category', 'Sent', 'Failed', 'Failure Rate'];
    const rows = data.templateBreakdown.map(t => [
      t.templateKey,
      t.category || 'N/A',
      t.sent.toString(),
      t.failed.toString(),
      `${((t.sent + t.failed) > 0 ? (t.failed / (t.sent + t.failed) * 100) : 0).toFixed(1)}%`,
    ]);
    downloadCSV([headers, ...rows], 'email-template-report');
  };

  const exportAllCSV = () => {
    if (!data) return;
    const headers = ['Date', 'Sent', 'Failed'];
    const rows = data.dailyVolume.map(d => [
      d.date,
      d.sent.toString(),
      d.failed.toString(),
    ]);
    downloadCSV([headers, ...rows], 'email-daily-report');
  };

  // Shared components
  const SummaryCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, subtitle, icon, color = 'text-emerald-500' }) => (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-sm text-slate-500">{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      {message}
    </div>
  );

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Email Reports</h1>
            <p className="text-slate-500 text-sm mt-1">
              Email delivery analytics and insights
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportAllCSV}
              disabled={!data}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      datePreset === preset.id
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {error && <ErrorMessage message={error} />}

        {loading ? (
          <LoadingSpinner />
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Sent"
                value={data.summary.totalSent.toLocaleString()}
                icon={<Mail size={16} />}
              />
              <SummaryCard
                title="Failed"
                value={data.summary.totalFailed.toLocaleString()}
                icon={<XCircle size={16} />}
                color="text-red-500"
              />
              <SummaryCard
                title="Success Rate"
                value={`${data.summary.successRate.toFixed(1)}%`}
                icon={<CheckCircle size={16} />}
                color={data.summary.successRate >= 95 ? 'text-emerald-500' : 'text-amber-500'}
              />
              <SummaryCard
                title="Unique Recipients"
                value={data.summary.uniqueRecipients.toLocaleString()}
                icon={<Users size={16} />}
                color="text-blue-500"
              />
            </div>

            {/* Send Volume Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Send Volume</h2>
              <ReportChart
                type="line"
                data={data.dailyVolume.map(d => ({
                  label: formatDate(d.date),
                  value: d.sent + d.failed,
                }))}
                height={220}
              />
              {data.dailyVolume.some(d => d.failed > 0) && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-red-600 mb-2">Failed Sends</h3>
                  <ReportChart
                    type="bar"
                    data={data.dailyVolume
                      .filter(d => d.failed > 0)
                      .map(d => ({
                        label: formatDate(d.date),
                        value: d.failed,
                        color: '#ef4444',
                      }))}
                    height={120}
                  />
                </div>
              )}
            </div>

            {/* Template Breakdown & Domain Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-800">By Template</h2>
                  <button
                    onClick={exportTemplateCSV}
                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Download size={14} />
                    CSV
                  </button>
                </div>
                {data.templateBreakdown.length > 0 ? (
                  <>
                    <ReportChart
                      type="pie"
                      data={data.templateBreakdown.map(t => ({
                        label: formatTemplateName(t.templateKey),
                        value: t.sent + t.failed,
                      }))}
                      height={180}
                    />
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-2 text-slate-500 font-medium">Template</th>
                            <th className="text-left py-2 text-slate-500 font-medium">Category</th>
                            <th className="text-right py-2 text-slate-500 font-medium">Sent</th>
                            <th className="text-right py-2 text-slate-500 font-medium">Failed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.templateBreakdown.map(t => (
                            <tr key={t.templateKey} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-2 text-slate-700">{formatTemplateName(t.templateKey)}</td>
                              <td className="py-2">
                                {t.category && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                                    {t.category}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-right text-slate-700">{t.sent}</td>
                              <td className="py-2 text-right">
                                <span className={t.failed > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                                  {t.failed}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm py-8 text-center">No email data for this period</p>
                )}
              </div>

              {/* Domain Distribution */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Recipient Domains</h2>
                {data.domainBreakdown.length > 0 ? (
                  <ReportChart
                    type="bar"
                    data={data.domainBreakdown.map(d => ({
                      label: d.domain,
                      value: d.count,
                    }))}
                    height={280}
                  />
                ) : (
                  <p className="text-slate-400 text-sm py-8 text-center">No email data for this period</p>
                )}
              </div>
            </div>

            {/* Recent Failures */}
            {data.recentFailures.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={18} className="text-red-500" />
                  <h2 className="text-lg font-semibold text-slate-800">Recent Failures</h2>
                  <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {data.recentFailures.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-slate-500 font-medium">Date</th>
                        <th className="text-left py-2 text-slate-500 font-medium">Recipient</th>
                        <th className="text-left py-2 text-slate-500 font-medium">Template</th>
                        <th className="text-left py-2 text-slate-500 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentFailures.map(f => (
                        <tr key={f.id} className="border-b border-slate-50 hover:bg-red-50/30">
                          <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(f.createdAt)}</td>
                          <td className="py-2 text-slate-700">{f.recipientEmail}</td>
                          <td className="py-2">
                            {f.templateKey ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                                {formatTemplateName(f.templateKey)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 text-red-600 text-xs max-w-xs truncate" title={f.errorMessage || ''}>
                            {f.errorMessage || 'Unknown error'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.summary.totalSent === 0 && data.summary.totalFailed === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
                <Mail size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No emails logged yet</h3>
                <p className="text-slate-400 text-sm">
                  Email data will appear here once the send-email function starts logging.
                  Deploy the updated edge function to begin collecting data.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminPageWrapper>
  );
};

export default EmailReportsPage;
