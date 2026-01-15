import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import InviteAdminModal from '../components/InviteAdminModal';
import EditAdminUserModal from '../components/EditAdminUserModal';
import RolePermissionsModal from '../components/RolePermissionsModal';

type TabType = 'users' | 'roles';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  assigned_at: string;
  last_login?: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  user_count: number;
  created_at: string;
}

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

const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: '1',
    user_id: 'user-1',
    email: 'admin@atlurbanfarms.com',
    full_name: 'John Admin',
    role_id: 'role-1',
    role_name: 'Super Admin',
    is_active: true,
    assigned_at: '2024-01-15T10:00:00Z',
    last_login: '2025-01-15T08:30:00Z',
  },
  {
    id: '2',
    user_id: 'user-2',
    email: 'manager@atlurbanfarms.com',
    full_name: 'Sarah Manager',
    role_id: 'role-2',
    role_name: 'Store Manager',
    is_active: true,
    assigned_at: '2024-03-20T14:00:00Z',
    last_login: '2025-01-14T16:45:00Z',
  },
  {
    id: '3',
    user_id: 'user-3',
    email: 'fulfillment@atlurbanfarms.com',
    full_name: 'Mike Fulfillment',
    role_id: 'role-3',
    role_name: 'Fulfillment Staff',
    is_active: true,
    assigned_at: '2024-06-10T09:00:00Z',
    last_login: '2025-01-15T07:00:00Z',
  },
  {
    id: '4',
    user_id: 'user-4',
    email: 'old.staff@atlurbanfarms.com',
    full_name: 'Former Employee',
    role_id: 'role-3',
    role_name: 'Fulfillment Staff',
    is_active: false,
    assigned_at: '2024-02-01T10:00:00Z',
    last_login: '2024-12-01T12:00:00Z',
  },
];

const MOCK_ADMIN_ROLES: AdminRole[] = [
  {
    id: 'role-1',
    name: 'Super Admin',
    description: 'Full access to all system features and settings',
    permissions: ['orders.*', 'products.*', 'inventory.*', 'customers.*', 'shipping.*', 'settings.view', 'settings.edit', 'reports.view'],
    is_system_role: true,
    user_count: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    name: 'Store Manager',
    description: 'Manage products, orders, and daily operations',
    permissions: ['orders.*', 'products.*', 'inventory.*', 'customers.view', 'shipping.view', 'reports.view'],
    is_system_role: false,
    user_count: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-3',
    name: 'Fulfillment Staff',
    description: 'Process and fulfill customer orders',
    permissions: ['orders.view', 'orders.fulfill', 'inventory.view', 'shipping.view'],
    is_system_role: false,
    user_count: 2,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-4',
    name: 'Customer Service',
    description: 'View orders and customer information',
    permissions: ['orders.view', 'customers.view'],
    is_system_role: false,
    user_count: 0,
    created_at: '2024-03-15T00:00:00Z',
  },
];

const AdminUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<AdminUser[]>(MOCK_ADMIN_USERS);
  const [roles, setRoles] = useState<AdminRole[]>(MOCK_ADMIN_ROLES);

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

  const handleInviteAdmin = useCallback((email: string, roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    const newUser: AdminUser = {
      id: `user-${Date.now()}`,
      user_id: `pending-${Date.now()}`,
      email,
      full_name: 'Pending Invitation',
      role_id: roleId,
      role_name: role?.name || 'Unknown',
      is_active: false,
      assigned_at: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    setShowInviteModal(false);
  }, [roles]);

  const handleUpdateUser = useCallback((updatedUser: AdminUser) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUser(null);
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    setEditingUser(null);
  }, []);

  const handleUpdateRole = useCallback((updatedRole: AdminRole) => {
    setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
    setEditingRole(null);
  }, []);

  const handleAddRole = useCallback((newRole: Omit<AdminRole, 'id' | 'user_count' | 'created_at'>) => {
    const role: AdminRole = {
      ...newRole,
      id: `role-${Date.now()}`,
      user_count: 0,
      created_at: new Date().toISOString(),
    };
    setRoles(prev => [...prev, role]);
    setShowAddRoleModal(false);
  }, []);

  const handleDeleteRole = useCallback((roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.is_system_role) return;
    if (role && role.user_count > 0) {
      alert('Cannot delete a role that has users assigned. Please reassign users first.');
      return;
    }
    setRoles(prev => prev.filter(r => r.id !== roleId));
    setEditingRole(null);
  }, [roles]);

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Admin Users</h1>
          {activeTab === 'users' ? (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite Admin
            </button>
          ) : (
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Role
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'roles'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
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
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-700/50">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Assigned</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {users.map(user => (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                        onClick={() => setEditingUser(user)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium">
                              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-white font-medium">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">
                            {user.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-600/50 text-slate-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              user.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                            }`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm">
                          {formatDate(user.assigned_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser(user);
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p>No admin users found</p>
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
                    className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{role.name}</h3>
                          {role.is_system_role && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                              System Role
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mb-4">{role.description}</p>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-slate-400">
                              {role.user_count} {role.user_count === 1 ? 'user' : 'users'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span className="text-slate-400">
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
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700">
                      {role.permissions.slice(0, 5).map(permission => (
                        <span
                          key={permission}
                          className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs font-mono"
                        >
                          {permission}
                        </span>
                      ))}
                      {role.permissions.length > 5 && (
                        <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                          +{role.permissions.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
