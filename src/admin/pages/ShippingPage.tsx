import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import ShippingOverviewTab from '../components/shipping/ShippingOverviewTab';
import ShippingZonesTab from '../components/shipping/ShippingZonesTab';
import ShippingCarriersTab from '../components/shipping/ShippingCarriersTab';
import ShippingPackagesTab from '../components/shipping/ShippingPackagesTab';
import ShippingPickupTab from '../components/shipping/ShippingPickupTab';
import ShippingSettingsTab from '../components/shipping/ShippingSettingsTab';
import { BarChart3, Map, Truck, Package, MapPin, Settings } from 'lucide-react';

type ShippingTabType = 'overview' | 'zones' | 'carriers' | 'packages' | 'pickup' | 'settings';

interface TabConfig {
  id: ShippingTabType;
  label: string;
  icon: React.ReactNode;
}

const ShippingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ShippingTabType>('overview');

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={20} /> },
    { id: 'zones', label: 'Zones', icon: <Map size={20} /> },
    { id: 'carriers', label: 'Carriers', icon: <Truck size={20} /> },
    { id: 'packages', label: 'Packages', icon: <Package size={20} /> },
    { id: 'pickup', label: 'Pickup', icon: <MapPin size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ShippingOverviewTab />;
      case 'zones':
        return <ShippingZonesTab />;
      case 'carriers':
        return <ShippingCarriersTab />;
      case 'packages':
        return <ShippingPackagesTab />;
      case 'pickup':
        return <ShippingPickupTab />;
      case 'settings':
        return <ShippingSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Shipping</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage shipping zones, carriers, and delivery settings
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
                    layoutId="activeShippingTab"
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

export default ShippingPage;
