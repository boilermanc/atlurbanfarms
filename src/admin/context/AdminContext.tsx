import React, { createContext, useContext } from 'react';

interface AdminContextValue {
  isInsideLayout: boolean;
  currentPage: string;
  navigate: (page: string) => void;
}

const AdminContext = createContext<AdminContextValue>({
  isInsideLayout: false,
  currentPage: 'dashboard',
  navigate: () => {},
});

export const useAdminContext = () => useContext(AdminContext);

export const AdminProvider: React.FC<{
  children: React.ReactNode;
  currentPage: string;
  navigate: (page: string) => void;
}> = ({ children, currentPage, navigate }) => {
  return (
    <AdminContext.Provider value={{ isInsideLayout: true, currentPage, navigate }}>
      {children}
    </AdminContext.Provider>
  );
};

export default AdminContext;
