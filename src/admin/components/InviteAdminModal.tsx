import React, { useState } from 'react';
import { X, Mail, Info, Loader2 } from 'lucide-react';
import { AdminRole } from '../hooks/useAdminUsers';

interface InviteAdminModalProps {
  roles: AdminRole[];
  onInvite: (email: string, roleId: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

const InviteAdminModal: React.FC<InviteAdminModalProps> = ({ roles, onInvite, onClose }) => {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!roleId) {
      setError('Please select a role');
      return;
    }

    setSending(true);
    try {
      const result = await onInvite(email.toLowerCase().trim(), roleId);
      if (!result.success) {
        setError(result.error || 'Failed to send invitation');
      }
      // If successful, the parent will close the modal
    } catch (err) {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/60">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Invite Admin</h2>
            <p className="text-slate-500 text-sm mt-0.5">Add a user to the admin team</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                The user must have an existing customer account
              </p>
            </div>

            {/* Role Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Role
              </label>
              <select
                value={roleId}
                onChange={(e) => {
                  setRoleId(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Select a role...</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {roleId && (
                <p className="text-xs text-slate-500 mt-1.5">
                  {roles.find(r => r.id === roleId)?.description}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex gap-3">
                <Info size={20} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-500">
                  <p className="font-medium text-slate-600 mb-1">How admin access works</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>User will be added to the admin team with the selected role</li>
                    <li>They can sign in with their existing account credentials</li>
                    <li>Access is granted immediately</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Add Admin
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteAdminModal;
