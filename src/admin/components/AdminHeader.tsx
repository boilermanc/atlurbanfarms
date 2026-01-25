import React from 'react';
import { LogOut, Menu } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  onMenuClick?: () => void;
  onLogout?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title, onMenuClick, onLogout }) => {
  return (
    <header className="h-16 bg-white/70 backdrop-blur-sm border-b border-slate-200/60 flex items-center px-6 flex-shrink-0 sticky top-0 z-10 font-admin-body print-hidden">
      {/* Left side - hamburger and title */}
      <div className="flex items-center gap-4">
        {/* Hamburger menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>

        {/* Page title */}
        <h1 className="text-slate-800 font-semibold text-lg font-admin-display">{title}</h1>
      </div>

      {/* Right side - logout button */}
      <div className="ml-auto flex items-center gap-4">
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default AdminHeader;
