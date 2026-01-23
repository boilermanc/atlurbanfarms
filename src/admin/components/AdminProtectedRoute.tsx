import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  const { isAdmin, adminUser, loading, error } = useAdminAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  // Authenticated but not an admin - show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6">
            You do not have permission to access the admin area.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // Show error if there was one (but user is still admin)
  if (error) {
    console.error('Admin auth error:', error);
  }

  // Authorized - render children
  return <>{children}</>;
};

export default AdminProtectedRoute;
