import React from 'react';

interface AdminHeaderProps {
  title: string;
  onMenuClick: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title, onMenuClick }) => {
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

      {/* Right side - user menu placeholder */}
      <div className="ml-auto flex items-center gap-4">
        {/* Placeholder for user menu */}
        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
          <span className="text-slate-300 text-sm font-medium">A</span>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
