import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
}

interface AdminUserRole {
  admin_roles: AdminRole;
}

interface UseAdminAuthReturn {
  isAdmin: boolean;
  adminUser: User | null;
  role: string | null;
  permissions: string[];
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAuth() {
      try {
        setLoading(true);
        setError(null);

        // First check session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            setAdminUser(null);
            setRole(null);
            setPermissions([]);
            setLoading(false);
          }
          return;
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (isMounted) {
            setAdminUser(null);
            setRole(null);
            setPermissions([]);
            setLoading(false);
          }
          return;
        }

        // Query admin_user_roles joined with admin_roles for current user
        const { data: userRoles, error: rolesError } = await supabase
          .from('admin_user_roles')
          .select(`
            admin_roles (
              id,
              name,
              permissions
            )
          `)
          .eq('customer_id', user.id)
          .single();

        if (rolesError) {
          // No admin role found is not necessarily an error
          if (rolesError.code === 'PGRST116') {
            if (isMounted) {
              setAdminUser(user);
              setRole(null);
              setPermissions([]);
              setLoading(false);
            }
            return;
          }
          throw rolesError;
        }

        if (isMounted) {
          setAdminUser(user);
          const adminRole = (userRoles as unknown as AdminUserRole)?.admin_roles;
          setRole(adminRole?.name || null);
          setPermissions(adminRole?.permissions || []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          setLoading(false);
        }
      }
    }

    checkAdminAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminAuth();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    // Wildcard permission grants access to everything
    if (permissions.includes('*')) {
      return true;
    }
    return permissions.includes(permission);
  }, [permissions]);

  const isAdmin = Boolean(adminUser && role);

  return {
    isAdmin,
    adminUser,
    role,
    permissions,
    loading,
    error,
    hasPermission,
  };
}

export default useAdminAuth;
