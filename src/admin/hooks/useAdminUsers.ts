import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

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

interface UseAdminUsersReturn {
  users: AdminUser[];
  roles: AdminRole[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  inviteAdmin: (email: string, roleId: string) => Promise<{ success: boolean; error?: string }>;
  updateAdminRole: (userId: string, roleId: string) => Promise<{ success: boolean; error?: string }>;
  toggleAdminStatus: (userId: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
  removeAdmin: (userId: string) => Promise<{ success: boolean; error?: string }>;
  createRole: (role: Omit<AdminRole, 'id' | 'user_count' | 'created_at'>) => Promise<{ success: boolean; error?: string; role?: AdminRole }>;
  updateRole: (roleId: string, updates: Partial<AdminRole>) => Promise<{ success: boolean; error?: string }>;
  deleteRole: (roleId: string) => Promise<{ success: boolean; error?: string }>;
}

export function useAdminUsers(): UseAdminUsersReturn {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch admin roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('admin_roles')
        .select('*')
        .order('name');

      if (rolesError) throw rolesError;

      // Fetch admin user roles with customer info
      // Use explicit foreign key reference to disambiguate the relationship
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('admin_user_roles')
        .select(`
          id,
          customer_id,
          role_id,
          is_active,
          customers!customer_id (
            id,
            email,
            first_name,
            last_name,
            created_at
          ),
          admin_roles (
            id,
            name
          )
        `);

      if (userRolesError) throw userRolesError;

      // Count users per role
      const roleCounts: Record<string, number> = {};
      (userRolesData || []).forEach((ur: any) => {
        if (ur.is_active && ur.role_id) {
          roleCounts[ur.role_id] = (roleCounts[ur.role_id] || 0) + 1;
        }
      });

      // Format roles with user counts
      const formattedRoles: AdminRole[] = (rolesData || []).map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || [],
        is_system_role: role.is_system_role || false,
        user_count: roleCounts[role.id] || 0,
        created_at: role.created_at,
      }));

      // Format users
      const formattedUsers: AdminUser[] = (userRolesData || []).map((ur: any) => {
        const customer = ur.customers;
        const role = ur.admin_roles;
        const fullName = customer
          ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email
          : 'Unknown';

        return {
          id: ur.id,
          user_id: ur.customer_id,
          email: customer?.email || 'Unknown',
          full_name: fullName,
          role_id: ur.role_id,
          role_name: role?.name || 'Unknown',
          is_active: ur.is_active,
          assigned_at: customer?.created_at || new Date().toISOString(),
        };
      });

      setRoles(formattedRoles);
      setUsers(formattedUsers);
    } catch (err) {
      console.error('Error fetching admin users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inviteAdmin = useCallback(async (email: string, roleId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // First, find the customer by email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single();

      if (customerError || !customer) {
        return { success: false, error: 'No customer found with that email address. The user must create an account first.' };
      }

      // Check if user already has an admin role
      const { data: existing } = await supabase
        .from('admin_user_roles')
        .select('id')
        .eq('customer_id', customer.id)
        .single();

      if (existing) {
        return { success: false, error: 'This user already has an admin role assigned.' };
      }

      // Create the admin user role
      const { error: insertError } = await supabase
        .from('admin_user_roles')
        .insert({
          customer_id: customer.id,
          role_id: roleId,
          is_active: true,
        });

      if (insertError) throw insertError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error inviting admin:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to invite admin' };
    }
  }, [fetchData]);

  const updateAdminRole = useCallback(async (userId: string, roleId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('admin_user_roles')
        .update({ role_id: roleId })
        .eq('id', userId);

      if (updateError) throw updateError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error updating admin role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update role' };
    }
  }, [fetchData]);

  const toggleAdminStatus = useCallback(async (userId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('admin_user_roles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (updateError) throw updateError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error toggling admin status:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update status' };
    }
  }, [fetchData]);

  const removeAdmin = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('admin_user_roles')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error removing admin:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove admin' };
    }
  }, [fetchData]);

  const createRole = useCallback(async (role: Omit<AdminRole, 'id' | 'user_count' | 'created_at'>): Promise<{ success: boolean; error?: string; role?: AdminRole }> => {
    try {
      const { data, error: insertError } = await supabase
        .from('admin_roles')
        .insert({
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          is_system_role: role.is_system_role,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchData();
      return {
        success: true,
        role: {
          ...data,
          user_count: 0,
        },
      };
    } catch (err) {
      console.error('Error creating role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create role' };
    }
  }, [fetchData]);

  const updateRole = useCallback(async (roleId: string, updates: Partial<AdminRole>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('admin_roles')
        .update({
          name: updates.name,
          description: updates.description,
          permissions: updates.permissions,
        })
        .eq('id', roleId);

      if (updateError) throw updateError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error updating role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update role' };
    }
  }, [fetchData]);

  const deleteRole = useCallback(async (roleId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if any users have this role
      const role = roles.find(r => r.id === roleId);
      if (role?.is_system_role) {
        return { success: false, error: 'Cannot delete a system role' };
      }
      if (role && role.user_count > 0) {
        return { success: false, error: 'Cannot delete a role that has users assigned. Please reassign users first.' };
      }

      const { error: deleteError } = await supabase
        .from('admin_roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) throw deleteError;

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error deleting role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete role' };
    }
  }, [fetchData, roles]);

  return {
    users,
    roles,
    loading,
    error,
    refetch: fetchData,
    inviteAdmin,
    updateAdminRole,
    toggleAdminStatus,
    removeAdmin,
    createRole,
    updateRole,
    deleteRole,
  };
}

export default useAdminUsers;
