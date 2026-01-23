import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import InviteAdminModal from '../components/InviteAdminModal';
import EditAdminUserModal from '../components/EditAdminUserModal';
import RolePermissionsModal from '../components/RolePermissionsModal';
import { UserPlus, Plus, Users, Edit2, Shield, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAdminUsers, AdminUser, AdminRole } from '../hooks/useAdminUsers';

type TabType = 'users' | 'roles';

export type { AdminUser, AdminRole };

export const ALL_PERMISSIONS = [
  { key: 'orders.view', label: 'View Orders', category: 'Orders' },
  { key: 'orders.edit', label: 'Edit Orders', category: 'Orders' },
  { key: 'orders.fulfill', label: 'Fulfill Orders', category: 'Orders' },
  { key: 'orders.*', label: 'Full Order Access', category: 'Orders' },
  { key: 'products.view', label: 'View Products', category: 'Products' },
  { key: 'products.edit', label: 'Edit Products', category: 'Products' },
  { key: 'products.*', label: 'Full Product Access', category: 'Products' },
  { key: 'inventory.view', label: 'View Inventory', category: 'Inventory' },
  { key: 'inventory.adjust', label: 'Adjust Inventory', category: 'Inventory' },
  { key: 'inventory.*', label: 'Full Inventory Access', category: 'Inventory' },
  { key: 'customers.view', label: 'View Customers', category: 'Customers' },
  { key: 'customers.*', label: 'Full Customer Access', category: 'Customers' },
  { key: 'shipping.view', label: 'View Shipping', category: 'Shipping' },
  { key: 'shipping.edit', label: 'Edit Shipping', category: 'Shipping' },
  { key: 'shipping.*', label: 'Full Shipping Access', category: 'Shipping' },
  { key: 'settings.view', label: 'View Settings', category: 'Settings' },
  { key: 'settings.edit', label: 'Edit Settings', category: 'Settings' },
  { key: 'reports.view', label: 'View Reports', category: 'Reports' },
];

const AdminUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const {
    users,
    roles,
    loading,
    error,
    refetch,
    inviteAdmin,
    updateAdminRole,
    toggleAdminStatus,
    removeAdmin,
    createRole,
    updateRole,
    deleteRole,
  } = useAdminUsers();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleInviteAdmin = useCallback(async (email: string, roleId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await inviteAdmin(email, roleId);
    if (result.success) {
      setShowInviteModal(false);
    }
    return result;
  }, [inviteAdmin]);

  const handleUpdateUser = useCallback(async (updatedUser: AdminUser): Promise<{ success: boolean; error?: string }> => {
    // Update role if changed
    const originalUser = users.find(u => u.id === updatedUser.id);
    if (originalUser && originalUser.role_id !== updatedUser.role_id) {
      const result = await updateAdminRole(updatedUser.id, updatedUser.role_id);
      if (!result.success) return result;
    }

    // Update active status if changed
    if (originalUser && originalUser.is_active !== updatedUser.is_active) {
      const result = await toggleAdminStatus(updatedUser.id, updatedUser.is_active);
      if (!result.success) return result;
    }

    setEditingUser(null);
    return { success: true };
  }, [users, updateAdminRole, toggleAdminStatus]);

  const handleRemoveUser = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await removeAdmin(userId);
    if (result.success) {
      setEditingUser(null);
    }
    return result;
  }, [removeAdmin]);

  const handleUpdateRole = useCallback(async (updatedRole: AdminRole): Promise<{ success: boolean; error?: string }> => {
    const result = await updateRole(updatedRole.id, updatedRole);
    if (result.success) {
      setEditingRole(null);
    }
    return result;
  }, [updateRole]);

  const handleAddRole = useCallback(async (newRole: Omit<AdminRole, 'id' | 'user_count' | 'created_at'>): Promise<{ success: boolean; error?: string }> => {
    const result = await createRole(newRole);
    if (result.success) {
      setShowAddRoleModal(false);
    }
    return result;
  }, [createRole]);

  const handleDeleteRole = useCallback(async (roleId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await deleteRole(roleId);
    if (result.success) {
      setEditingRole(null);
    }
    return result;
  }, [deleteRole]);

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </AdminPageWrapper>
    );
  }

  if (error) {
    return (
      <AdminPageWrapper>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">Error Loading Admin Users</h3>
              <p className="text-red-600 mt-1">{error}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Admin Users</h1>
            <p className="text-slate-500 text-sm mt-1">Manage admin users and their roles</p>
          </div>
          {activeTab === 'users' ? (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <UserPlus size={20} />
              Invite Admin
            </button>
          ) : (
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Add Role
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'roles'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            Roles
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(user => (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setEditingUser(user)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium">
                              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-slate-800 font-medium">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                            {user.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            user.is_active
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              user.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-sm">
                          {formatDate(user.assigned_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser(user);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 mb-4">No admin users found</p>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors inline-flex items-center gap-2"
                    >
                      <UserPlus size={18} />
                      Invite Your First Admin
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="roles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid gap-4">
                {roles.map(role => (
                  <div
                    key={role.id}
                    onClick={() => setEditingRole(role)}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-800">{role.name}</h3>
                          {role.is_system_role && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-xs font-medium">
                              System Role
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm mb-4">{role.description}</p>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-sm">
                            <Users size={16} className="text-slate-400" />
                            <span className="text-slate-500">
                              {role.user_count} {role.user_count === 1 ? 'user' : 'users'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Shield size={16} className="text-slate-400" />
                            <span className="text-slate-500">
                              {role.permissions.length} permissions
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRole(role);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200">
                      {role.permissions.slice(0, 5).map(permission => (
                        <span
                          key={permission}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono"
                        >
                          {permission}
                        </span>
                      ))}
                      {role.permissions.length > 5 && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded text-xs">
                          +{role.permissions.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {roles.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 mb-4">No roles defined yet</p>
                    <button
                      onClick={() => setShowAddRoleModal(true)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Create Your First Role
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showInviteModal && (
        <InviteAdminModal
          roles={roles}
          onInvite={handleInviteAdmin}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {editingUser && (
        <EditAdminUserModal
          user={editingUser}
          roles={roles}
          onSave={handleUpdateUser}
          onRemove={handleRemoveUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {editingRole && (
        <RolePermissionsModal
          role={editingRole}
          onSave={handleUpdateRole}
          onDelete={handleDeleteRole}
          onClose={() => setEditingRole(null)}
        />
      )}

      {showAddRoleModal && (
        <RolePermissionsModal
          role={null}
          onSave={(role) => {
            if (role) {
              handleAddRole({
                name: role.name,
                description: role.description,
                permissions: role.permissions,
                is_system_role: false,
              });
            }
          }}
          onClose={() => setShowAddRoleModal(false)}
        />
      )}
    </AdminPageWrapper>
  );
};

export default AdminUsersPage;
