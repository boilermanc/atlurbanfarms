import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  GraduationCap,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface SchoolProfile {
  id: string;
  customer_id: string;
  school_name: string;
  school_district: string | null;
  grade_levels: string[] | null;
  growing_system: string | null;
  experience_level: string | null;
  program_notes: string | null;
  is_title1: boolean;
  status: 'pending' | 'approved' | 'denied';
  imported_from_mailchimp: boolean;
  created_at: string;
  customers: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

type StatusFilter = 'pending' | 'approved' | 'denied' | 'all';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  denied: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SchoolPartnersPage: React.FC = () => {
  const [profiles, setProfiles] = useState<SchoolProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('school_profiles')
        .select('*, customers(first_name, last_name, email)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setProfiles((data as SchoolProfile[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch school profiles');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleApprove = async (profile: SchoolProfile) => {
    setActionLoading(profile.id);
    try {
      // 1. Update school_profiles status
      const { error: profileError } = await supabase
        .from('school_profiles')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // 2. Update customers account_type
      const { error: customerError } = await supabase
        .from('customers')
        .update({ account_type: 'school_partner' })
        .eq('id', profile.customer_id);

      if (customerError) throw customerError;

      setToast({ message: `${profile.school_name} approved successfully`, type: 'success' });
      fetchProfiles();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to approve', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (profile: SchoolProfile) => {
    setActionLoading(profile.id);
    try {
      const { error: profileError } = await supabase
        .from('school_profiles')
        .update({ status: 'denied', updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      setToast({ message: `${profile.school_name} denied`, type: 'success' });
      fetchProfiles();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to deny', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const getContactName = (profile: SchoolProfile) => {
    const { first_name, last_name } = profile.customers;
    return [first_name, last_name].filter(Boolean).join(' ') || '—';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const pendingCount = profiles.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">School Partners</h1>
          <p className="text-slate-500 text-sm mt-1">Review and manage school partner applications</p>
        </div>
        <button
          onClick={fetchProfiles}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 border rounded-2xl flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'denied', 'all'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-emerald-500 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-3">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-2xl shadow-sm border border-slate-200/60">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">No Applications</h3>
          <p className="text-slate-500">
            {filter === 'pending'
              ? 'No pending school partner applications to review.'
              : `No ${filter === 'all' ? '' : filter + ' '}applications found.`}
          </p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">School Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Submitted</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => (
                  <React.Fragment key={profile.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{profile.school_name}</span>
                          {profile.is_title1 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                              Title I
                            </span>
                          )}
                        </div>
                        {profile.school_district && (
                          <p className="text-xs text-slate-400 mt-0.5">{profile.school_district}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-700">{getContactName(profile)}</td>
                      <td className="py-4 px-4 text-sm text-slate-500">{profile.customers.email}</td>
                      <td className="py-4 px-4 text-sm text-slate-500">{formatDate(profile.created_at)}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${STATUS_STYLES[profile.status]}`}>
                          {profile.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          {profile.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(profile)}
                                disabled={actionLoading === profile.id}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                {actionLoading === profile.id ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleDeny(profile)}
                                disabled={actionLoading === profile.id}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-medium rounded-lg border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-50"
                              >
                                Deny
                              </button>
                            </>
                          )}
                          {profile.status === 'denied' && (
                            <button
                              onClick={() => handleApprove(profile)}
                              disabled={actionLoading === profile.id}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionLoading === profile.id ? '...' : 'Approve'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Details Row */}
                    {expandedId === profile.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {profile.grade_levels && profile.grade_levels.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Programs</p>
                                <p className="text-slate-700">{profile.grade_levels.join(', ')}</p>
                              </div>
                            )}
                            {profile.growing_system && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Aeroponic Systems</p>
                                <p className="text-slate-700">{profile.growing_system}</p>
                              </div>
                            )}
                            {profile.experience_level && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Experience</p>
                                <p className="text-slate-700">{profile.experience_level.replace(/_/g, ' ')}</p>
                              </div>
                            )}
                            {profile.program_notes && (
                              <div className="col-span-2 md:col-span-4">
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Notes</p>
                                <p className="text-slate-700">{profile.program_notes}</p>
                              </div>
                            )}
                            {profile.imported_from_mailchimp && (
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Source</p>
                                <p className="text-slate-700">Imported from Mailchimp</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolPartnersPage;
