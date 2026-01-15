import React from 'react';

interface AdminHeaderProps {
  title: string;
  onMenuClick?: () => void;
  onLogout?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title, onMenuClick, onLogout }) => {
  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-4 flex-shrink-0">
      {/* Left side - hamburger and title */}
      <div className="flex items-center gap-4">
        {/* Hamburger menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Page title */}
        <h1 className="text-white font-semibold text-lg">{title}</h1>
      </div>

      {/* Right side - logout button */}
      <div className="ml-auto flex items-center gap-4">
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span className="text-sm font-medium">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default AdminHeader;
