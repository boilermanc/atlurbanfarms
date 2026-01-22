import React from 'react';
import { motion } from 'framer-motion';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'orders', label: 'Orders', icon: '📦' },
      { id: 'products', label: 'Products', icon: '🌱' },
      { id: 'categories', label: 'Categories', icon: '📁' },
      { id: 'inventory', label: 'Inventory', icon: '📋' },
      { id: 'customers', label: 'Customers', icon: '👥' },
    ],
  },
  {
    title: 'SHIPPING',
    items: [
      { id: 'fulfillment', label: 'Fulfillment', icon: '🚚' },
      { id: 'zones', label: 'Zones & Rules', icon: '🗺️' },
      { id: 'calendar', label: 'Calendar', icon: '📅' },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      { id: 'faqs', label: 'FAQs', icon: '❓' },
      { id: 'content-pages', label: 'Content Pages', icon: '📄' },
      { id: 'attribution', label: 'Attribution', icon: '📣' },
    ],
  },
  {
    title: 'CONFIGURATION',
    items: [
      { id: 'settings', label: 'Settings', icon: '⚙️' },
      { id: 'feature-flags', label: 'Feature Flags', icon: '🎚️' },
      { id: 'integrations', label: 'Integrations', icon: '🔌' },
      { id: 'email-templates', label: 'Email Templates', icon: '✉️' },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { id: 'reports', label: 'Reports', icon: '📈' },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { id: 'users-roles', label: 'Users & Roles', icon: '🛡️' },
      { id: 'audit-log', label: 'Audit Log', icon: '📝' },
    ],
  },
];

const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <aside className="w-[280px] h-screen bg-slate-800 flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
            A
          </div>
          <div>
            <span className="font-bold text-white text-lg tracking-tight">
              ATL <span className="text-emerald-400">Urban Farms</span>
            </span>
            <p className="text-xs text-slate-400 font-medium">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex > 0 ? 'mt-8' : ''}>
            <h3 className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <li key={item.id}>
                    <motion.button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      whileHover={{ x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <span className="text-lg" role="img" aria-label={item.label}>
                        {item.icon}
                      </span>
                      <span className="font-medium text-sm">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"
                          initial={false}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-[10px] text-slate-500 text-center">
          Built by <span className="text-slate-400">Sweetwater Technologies</span>
        </p>
      </div>
    </aside>
  );
};

export default AdminSidebar;
