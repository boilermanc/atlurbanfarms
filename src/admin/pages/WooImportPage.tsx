import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import WooImportDashboard from '../components/woo-import/WooImportDashboard';
import WooImportHistory from '../components/woo-import/WooImportHistory';
import WooImportSetupGuide from '../components/woo-import/WooImportSetupGuide';
import { LayoutDashboard, History, BookOpen } from 'lucide-react';

type WooImportTabType = 'dashboard' | 'history' | 'setup';

interface TabConfig {
  id: WooImportTabType;
  label: string;
  icon: React.ReactNode;
}

const WooImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WooImportTabType>('dashboard');

  const tabs: TabConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'history', label: 'History', icon: <History size={20} /> },
    { id: 'setup', label: 'Setup Guide', icon: <BookOpen size={20} /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <WooImportDashboard onViewHistory={() => setActiveTab('history')} />;
      case 'history':
        return <WooImportHistory />;
      case 'setup':
        return <WooImportSetupGuide />;
      default:
        return null;
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">WooCommerce Import</h1>
          <p className="text-slate-500 text-sm mt-1">
            Import and sync customers and orders from the legacy WooCommerce site
          </p>
        </div>

        <div className="border-b border-slate-200">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeWooImportTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default WooImportPage;
