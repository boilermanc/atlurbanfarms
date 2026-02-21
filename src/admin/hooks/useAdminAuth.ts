import { useState, useEffect, useCallback, useRef } from 'react';
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
  const initialCheckDoneRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAuth(isInitial: boolean) {
      try {
        // Only show loading spinner on the initial check.
        // Subsequent checks (e.g. TOKEN_REFRESHED) run silently
        // so the admin UI isn't unmounted mid-edit.
        if (isInitial) {
          setLoading(true);
        }
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
        // Only include active roles
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
          .eq('is_active', true)
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

    checkAdminAuth(true).then(() => {
      initialCheckDoneRef.current = true;
    });

    // Listen for auth state changes (TOKEN_REFRESHED, SIGNED_OUT, etc.)
    // Only re-check on SIGNED_OUT (session lost) — token refreshes
    // don't need a full re-query since the user hasn't changed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        checkAdminAuth(false);
      }
      // TOKEN_REFRESHED and SIGNED_IN with same user don't need re-auth
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
