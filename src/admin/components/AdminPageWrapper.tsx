import React from 'react';
import { useAdminContext } from '../context/AdminContext';
import AdminLayout from './AdminLayout';

interface AdminPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that conditionally wraps content in AdminLayout.
 * If already inside AdminLayout (detected via context), just renders children.
 * If standalone, wraps in AdminLayout for proper sidebar/header.
 */
const AdminPageWrapper: React.FC<AdminPageWrapperProps> = ({ children }) => {
  const { isInsideLayout } = useAdminContext();

  if (isInsideLayout) {
    return <>{children}</>;
  }

  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
};

export default AdminPageWrapper;
