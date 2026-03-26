import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface SchoolPortalProps {
  userId: string;
  isTitle1: boolean;
}

interface SchoolProfile {
  customer_id: string;
  school_name: string;
  school_district: string;
  grade_levels: string[];
  student_count: number | null;
  growing_system: string;
  experience_level: string;
  program_notes: string;
  is_title1: boolean;
}

interface StorageFile {
  name: string;
  id: string | null;
  metadata: { mimetype?: string; size?: number } | null;
}

const GRADE_LEVEL_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

const GROWING_SYSTEM_OPTIONS = [
  { value: 'tower_garden', label: 'Tower Garden' },
  { value: 'raised_bed', label: 'Raised Bed' },
  { value: 'container', label: 'Container Garden' },
  { value: 'indoor_hydro', label: 'Indoor Hydroponics' },
  { value: 'other', label: 'Other' },
];

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'new', label: 'New Program' },
  { value: 'beginner', label: 'Beginner (1-2 years)' },
  { value: 'intermediate', label: 'Intermediate (3-5 years)' },
  { value: 'established', label: 'Established (5+ years)' },
];

const EMPTY_FORM: Omit<SchoolProfile, 'customer_id' | 'is_title1'> = {
  school_name: '',
  school_district: '',
  grade_levels: [],
  student_count: null,
  growing_system: '',
  experience_level: '',
  program_notes: '',
};

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (['doc', 'docx'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SchoolPortal: React.FC<SchoolPortalProps> = ({ userId, isTitle1 }) => {
  // ── School Profile State ──
  const [profileLoading, setProfileLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [profileIsTitle1, setProfileIsTitle1] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Resource Library State ──
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // ── Fetch school profile ──
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('school_profiles')
        .select('*')
        .eq('customer_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasExistingProfile(true);
        setProfileIsTitle1(data.is_title1 ?? false);
        setFormData({
          school_name: data.school_name || '',
          school_district: data.school_district || '',
          grade_levels: data.grade_levels || [],
          student_count: data.student_count,
          growing_system: data.growing_system || '',
          experience_level: data.experience_level || '',
          program_notes: data.program_notes || '',
        });
      } else {
        // No school profile yet — prepopulate school_name from customers.company
        const { data: customer } = await supabase
          .from('customers')
          .select('company')
          .eq('id', userId)
          .maybeSingle();
        if (customer?.company) {
          setFormData(prev => ({ ...prev, school_name: customer.company }));
        }
      }
    } catch (err: any) {
      console.error('Error fetching school profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  // ── Fetch resource files ──
  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const { data, error } = await supabase.storage
        .from('school-resources')
        .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

      if (error) throw error;

      // Filter out folder placeholder files
      const realFiles = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
      setFiles(realFiles as StorageFile[]);
    } catch (err: any) {
      console.error('Error fetching school resources:', err);
      setFilesError('Unable to load resources. Please try again later.');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchFiles();
  }, [fetchProfile, fetchFiles]);

  // ── Save school profile ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const payload = {
        customer_id: userId,
        school_name: formData.school_name,
        school_district: formData.school_district,
        grade_levels: formData.grade_levels,
        student_count: formData.student_count,
        growing_system: formData.growing_system,
        experience_level: formData.experience_level,
        program_notes: formData.program_notes,
      };

      const { error } = await supabase
        .from('school_profiles')
        .upsert(payload, { onConflict: 'customer_id' });

      if (error) throw error;

      // Sync school_name → customers.company
      await supabase
        .from('customers')
        .update({ company: formData.school_name })
        .eq('id', userId);

      setHasExistingProfile(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save school profile');
    } finally {
      setSaving(false);
    }
  };

  // ── Download file ──
  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const { data, error } = await supabase.storage
        .from('school-resources')
        .createSignedUrl(fileName, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error generating download URL:', err);
      alert('Unable to download this file. Please try again.');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleGradeLevelToggle = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      grade_levels: prev.grade_levels.includes(grade)
        ? prev.grade_levels.filter(g => g !== grade)
        : [...prev.grade_levels, grade],
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'student_count' ? (value === '' ? null : parseInt(value, 10)) : value,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Derive title1 from prop or fetched profile
  const showTitle1Badge = isTitle1 || profileIsTitle1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          School Portal
        </h1>
        <p className="text-gray-500">
          Manage your school partnership resources and orders.
        </p>
      </div>

      {/* ── SECTION 1: My School Profile ── */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-bold text-gray-900">My School Profile</h2>
          {showTitle1Badge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Title I School
            </span>
          )}
        </div>

        {profileLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="text-sm text-emerald-600 font-medium">School profile saved!</p>
              </motion.div>
            )}
            {saveError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-100 rounded-xl"
              >
                <p className="text-sm text-red-600 font-medium">{saveError}</p>
              </motion.div>
            )}

            {/* School Name & District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  School Name
                </label>
                <input
                  type="text"
                  name="school_name"
                  value={formData.school_name}
                  onChange={handleInputChange}
                  placeholder="Enter school name"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  School District
                </label>
                <input
                  type="text"
                  name="school_district"
                  value={formData.school_district}
                  onChange={handleInputChange}
                  placeholder="Enter district name"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Grade Levels */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Grade Levels
              </label>
              <div className="flex flex-wrap gap-2">
                {GRADE_LEVEL_OPTIONS.map(grade => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => handleGradeLevelToggle(grade)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      formData.grade_levels.includes(grade)
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Count, Growing System, Experience */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Student Count
                </label>
                <input
                  type="number"
                  name="student_count"
                  value={formData.student_count ?? ''}
                  onChange={handleInputChange}
                  placeholder="# of students"
                  min="0"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Growing System
                </label>
                <select
                  name="growing_system"
                  value={formData.growing_system}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                >
                  <option value="">Select system</option>
                  {GROWING_SYSTEM_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Experience Level
                </label>
                <select
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                >
                  <option value="">Select level</option>
                  {EXPERIENCE_LEVEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Program Notes */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                Program Notes
              </label>
              <textarea
                name="program_notes"
                value={formData.program_notes}
                onChange={handleInputChange}
                placeholder="Tell us about your school garden program, goals, or special needs..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all resize-none"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
                  saving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : hasExistingProfile ? (
                  'Update Profile'
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── SECTION 2: Resource Library ── */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-heading font-bold text-gray-900 mb-4">Resource Library</h2>

        {filesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filesError ? (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-sm text-amber-700">{filesError}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              Resources coming soon — check back after your first order ships.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => (
              <div
                key={file.name}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                  {getFileIcon(file.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  {file.metadata?.size && (
                    <p className="text-xs text-gray-400">{formatFileSize(file.metadata.size)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(file.name)}
                  disabled={downloadingFile === file.name}
                  className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {downloadingFile === file.name ? (
                    <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 3: PO Order Management (Placeholder) ── */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-heading font-bold text-gray-900 mb-4">Purchase Order Management</h2>
        <div className="py-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium text-sm mb-1">Purchase Order ordering is coming soon.</p>
          <p className="text-gray-500 text-sm">
            Contact{' '}
            <a href="mailto:sheree@atlurbanfarms.com" className="text-emerald-600 hover:underline font-medium">
              sheree@atlurbanfarms.com
            </a>
            {' '}to place a PO order.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchoolPortal;
