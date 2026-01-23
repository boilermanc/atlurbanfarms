import React, { useState } from 'react';
import { X, Trash2, Check, Loader2 } from 'lucide-react';
import { AdminUser, AdminRole } from '../hooks/useAdminUsers';

interface EditAdminUserModalProps {
  user: AdminUser;
  roles: AdminRole[];
  onSave: (user: AdminUser) => Promise<{ success: boolean; error?: string }>;
  onRemove: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

const EditAdminUserModal: React.FC<EditAdminUserModalProps> = ({
  user,
  roles,
  onSave,
  onRemove,
  onClose,
}) => {
  const [roleId, setRoleId] = useState(user.role_id);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const selectedRole = roles.find(r => r.id === roleId);
      const updatedUser: AdminUser = {
        ...user,
        role_id: roleId,
        role_name: selectedRole?.name || user.role_name,
        is_active: isActive,
      };
      const result = await onSave(updatedUser);
      if (!result.success) {
        setError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await onRemove(user.id);
      if (!result.success) {
        setError(result.error || 'Failed to remove admin');
        setShowRemoveConfirm(false);
      }
    } catch (err) {
      setError('Failed to remove admin. Please try again.');
      setShowRemoveConfirm(false);
    } finally {
      setSaving(false);
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200/60">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Admin User</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage user role and access</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-semibold">
              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-slate-800 font-semibold text-lg">{user.full_name}</h3>
              <p className="text-slate-500 text-sm">{user.email}</p>
            </div>
          </div>

          {/* User Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Assigned</span>
              <p className="text-slate-700">{formatDate(user.assigned_at)}</p>
            </div>
            <div>
              <span className="text-slate-500">Last Login</span>
              <p className="text-slate-700">{formatDateTime(user.last_login)}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

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

          {/* Active/Inactive Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <h4 className="text-slate-800 font-medium">Account Status</h4>
              <p className="text-sm text-slate-500">
                {isActive ? 'User can access admin panel' : 'User access is disabled'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => {
                  setIsActive(e.target.checked);
                  setError(null);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Remove Access Section */}
          {!showRemoveConfirm ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="w-full px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              Remove Admin Access
            </button>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 mb-4">
                Are you sure you want to remove admin access for <strong>{user.full_name}</strong>?
                They will no longer be able to access the admin panel.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Removing...
                    </>
                  ) : (
                    'Yes, Remove Access'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditAdminUserModal;
