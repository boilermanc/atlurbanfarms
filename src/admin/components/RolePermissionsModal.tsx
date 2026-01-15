import React, { useState, useMemo } from 'react';
import { AdminRole, ALL_PERMISSIONS } from '../pages/AdminUsersPage';

interface RolePermissionsModalProps {
  role: AdminRole | null;
  onSave: (role: AdminRole) => void;
  onDelete?: (roleId: string) => void;
  onClose: () => void;
}

const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({
  role,
  onSave,
  onDelete,
  onClose,
}) => {
  const isNewRole = role === null;
  const isSystemRole = role?.is_system_role ?? false;

  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || []);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof ALL_PERMISSIONS> = {};
    ALL_PERMISSIONS.forEach(permission => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = [];
      }
      grouped[permission.category].push(permission);
    });
    return grouped;
  }, []);

  const handlePermissionToggle = (permissionKey: string) => {
    if (isSystemRole) return;

    setPermissions(prev => {
      if (prev.includes(permissionKey)) {
        return prev.filter(p => p !== permissionKey);
      } else {
        return [...prev, permissionKey];
      }
    });
  };

  const handleCategoryToggle = (category: string) => {
    if (isSystemRole) return;

    const categoryPermissions = permissionsByCategory[category].map(p => p.key);
    const allSelected = categoryPermissions.every(p => permissions.includes(p));

    if (allSelected) {
      setPermissions(prev => prev.filter(p => !categoryPermissions.includes(p)));
    } else {
      setPermissions(prev => [...new Set([...prev, ...categoryPermissions])]);
    }
  };

  const isCategoryFullySelected = (category: string): boolean => {
    const categoryPermissions = permissionsByCategory[category].map(p => p.key);
    return categoryPermissions.every(p => permissions.includes(p));
  };

  const isCategoryPartiallySelected = (category: string): boolean => {
    const categoryPermissions = permissionsByCategory[category].map(p => p.key);
    const selectedCount = categoryPermissions.filter(p => permissions.includes(p)).length;
    return selectedCount > 0 && selectedCount < categoryPermissions.length;
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    if (permissions.length === 0) {
      setError('Please select at least one permission');
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedRole: AdminRole = {
        id: role?.id || `role-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        permissions,
        is_system_role: role?.is_system_role || false,
        user_count: role?.user_count || 0,
        created_at: role?.created_at || new Date().toISOString(),
      };

      onSave(updatedRole);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!role || isSystemRole || !onDelete) return;

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onDelete(role.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {isNewRole ? 'Add Role' : isSystemRole ? 'View Role' : 'Edit Role'}
              </h2>
              {isSystemRole && (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                  System Role
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {isSystemRole ? 'System roles cannot be modified' : 'Configure role permissions'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* Role Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              disabled={isSystemRole}
              placeholder="e.g., Store Manager"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSystemRole}
              placeholder="Describe what this role can do..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Permissions
            </label>

            <div className="space-y-4">
              {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
                <div key={category} className="bg-slate-700/30 rounded-xl border border-slate-600 overflow-hidden">
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    disabled={isSystemRole}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors disabled:cursor-default"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isCategoryFullySelected(category)
                          ? 'bg-emerald-500 border-emerald-500'
                          : isCategoryPartiallySelected(category)
                          ? 'bg-emerald-500/50 border-emerald-500'
                          : 'border-slate-500'
                      }`}>
                        {(isCategoryFullySelected(category) || isCategoryPartiallySelected(category)) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isCategoryFullySelected(category) ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                            )}
                          </svg>
                        )}
                      </div>
                      <span className="text-white font-medium">{category}</span>
                    </div>
                    <span className="text-sm text-slate-400">
                      {categoryPermissions.filter(p => permissions.includes(p.key)).length} / {categoryPermissions.length}
                    </span>
                  </button>

                  {/* Permission List */}
                  <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryPermissions.map(permission => (
                      <label
                        key={permission.key}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isSystemRole ? 'cursor-default' : 'cursor-pointer hover:bg-slate-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(permission.key)}
                          onChange={() => handlePermissionToggle(permission.key)}
                          disabled={isSystemRole}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          permissions.includes(permission.key)
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-500'
                        }`}>
                          {permissions.includes(permission.key) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-300 text-sm">{permission.label}</span>
                          <span className="ml-2 text-slate-500 text-xs font-mono">{permission.key}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Delete Section (only for non-system, existing roles) */}
          {!isNewRole && !isSystemRole && onDelete && (
            <>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Role
                </button>
              ) : (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400 mb-4">
                    Are you sure you want to delete the <strong>{role?.name}</strong> role?
                    {role && role.user_count > 0 && (
                      <span className="block mt-2 text-red-300">
                        Warning: This role has {role.user_count} user(s) assigned. You must reassign them first.
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={saving || (role && role.user_count > 0)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        'Yes, Delete Role'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-800/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            {isSystemRole ? 'Close' : 'Cancel'}
          </button>
          {!isSystemRole && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isNewRole ? 'Create Role' : 'Save Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolePermissionsModal;
