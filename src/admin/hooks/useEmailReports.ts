import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Types
export interface EmailSummary {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  uniqueRecipients: number;
}

export interface DailyEmailVolume {
  date: string;
  sent: number;
  failed: number;
}

export interface TemplateBreakdown {
  templateKey: string;
  category: string | null;
  sent: number;
  failed: number;
}

export interface DomainBreakdown {
  domain: string;
  count: number;
  failedCount: number;
}

export interface EmailFailure {
  id: string;
  recipientEmail: string;
  templateKey: string | null;
  subject: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmailReportData {
  summary: EmailSummary;
  dailyVolume: DailyEmailVolume[];
  templateBreakdown: TemplateBreakdown[];
  domainBreakdown: DomainBreakdown[];
  recentFailures: EmailFailure[];
}

// Helper to format dates for Supabase queries
const formatDateForQuery = (date: string): string => {
  return new Date(date).toISOString();
};

const getEndOfDay = (date: string): string => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export function useEmailReport(startDate: string, endDate: string) {
  const [data, setData] = useState<EmailReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const startISO = formatDateForQuery(startDate);
      const endISO = getEndOfDay(endDate);

      const { data: logs, error: fetchError } = await supabase
        .from('email_logs')
        .select('id, recipient_email, recipient_domain, template_key, template_category, subject, status, error_message, created_at')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const rows = logs || [];

      // Summary
      const totalSent = rows.filter(r => r.status === 'sent').length;
      const totalFailed = rows.filter(r => r.status === 'failed').length;
      const total = totalSent + totalFailed;
      const successRate = total > 0 ? (totalSent / total) * 100 : 0;
      const uniqueRecipients = new Set(rows.map(r => r.recipient_email)).size;

      // Daily volume - initialize all days in range
      const dailyMap = new Map<string, { sent: number; failed: number }>();
      const current = new Date(startDate);
      const end = new Date(endDate);
      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        dailyMap.set(dateKey, { sent: 0, failed: 0 });
        current.setDate(current.getDate() + 1);
      }
      rows.forEach(row => {
        const dateKey = new Date(row.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(dateKey) || { sent: 0, failed: 0 };
        if (row.status === 'sent') {
          existing.sent++;
        } else {
          existing.failed++;
        }
        dailyMap.set(dateKey, existing);
      });
      const dailyVolume: DailyEmailVolume[] = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));

      // Template breakdown
      const templateMap = new Map<string, { category: string | null; sent: number; failed: number }>();
      rows.forEach(row => {
        const key = row.template_key || '(no template)';
        const existing = templateMap.get(key) || { category: row.template_category, sent: 0, failed: 0 };
        if (row.status === 'sent') {
          existing.sent++;
        } else {
          existing.failed++;
        }
        templateMap.set(key, existing);
      });
      const templateBreakdown: TemplateBreakdown[] = Array.from(templateMap.entries())
        .map(([templateKey, stats]) => ({ templateKey, ...stats }))
        .sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));

      // Domain breakdown
      const domainMap = new Map<string, { count: number; failedCount: number }>();
      rows.forEach(row => {
        const domain = row.recipient_domain || 'unknown';
        const existing = domainMap.get(domain) || { count: 0, failedCount: 0 };
        existing.count++;
        if (row.status === 'failed') existing.failedCount++;
        domainMap.set(domain, existing);
      });
      const domainBreakdown: DomainBreakdown[] = Array.from(domainMap.entries())
        .map(([domain, stats]) => ({ domain, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent failures
      const recentFailures: EmailFailure[] = rows
        .filter(r => r.status === 'failed')
        .slice(0, 20)
        .map(r => ({
          id: r.id,
          recipientEmail: r.recipient_email,
          templateKey: r.template_key,
          subject: r.subject,
          errorMessage: r.error_message,
          createdAt: r.created_at,
        }));

      setData({
        summary: { totalSent, totalFailed, successRate, uniqueRecipients },
        dailyVolume,
        templateBreakdown,
        domainBreakdown,
        recentFailures,
      });
    } catch (err: any) {
      console.error('Email report fetch error:', err);
      setError(err.message || 'Failed to fetch email report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, error, refetch: fetchReport };
}
