import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Leaf,
  FolderTree,
  ClipboardList,
  Users,
  Tag,
  Gift,
  Bell,
  Truck,
  Calendar,
  HelpCircle,
  FileText,
  Megaphone,
  Settings,
  Plug,
  Mail,
  BarChart3,
  Shield,
  ScrollText,
  Download,
  Globe,
  UsersRound,
  Newspaper,
  Sprout,
  Heart,
  FileSpreadsheet,
  CreditCard,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  externalUrl?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', label: 'Orders', icon: Package },
      { id: 'products', label: 'Products', icon: Leaf },
      { id: 'categories', label: 'Categories', icon: FolderTree },
      { id: 'inventory', label: 'Inventory', icon: ClipboardList },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'promotions', label: 'Promotions', icon: Tag },
      { id: 'gift-cards', label: 'Gift Cards', icon: Gift, externalUrl: 'https://giftup.app/Account/Login?ReturnUrl=%2F' },
      { id: 'sproutify-credits', label: 'Sproutify Credits', icon: Leaf },
    ],
  },
  {
    title: 'SCHEDULING',
    items: [
      { id: 'calendar', label: 'Events Calendar', icon: Calendar },
      { id: 'shipping', label: 'Shipping', icon: Truck },
      { id: 'fulfillment', label: 'Fulfillment', icon: Package },
      { id: 'weekly-sales-report', label: 'Weekly Sales Report', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      { id: 'site-content', label: 'Site Content', icon: Globe },
      { id: 'growers', label: 'Team Members', icon: UsersRound },
      { id: 'faqs', label: 'FAQs', icon: HelpCircle },
      { id: 'content-pages', label: 'Content Pages', icon: FileText },
      { id: 'blog', label: 'Blog', icon: Newspaper },
    ],
  },
  {
    title: 'CONFIGURATION',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'product-tags', label: 'Product Tags', icon: Tag },
      { id: 'customer-tags', label: 'Customer Tags', icon: Users },
      { id: 'growing-systems', label: 'Growing Systems', icon: Sprout },
      { id: 'growing-interests', label: 'Growing Interests', icon: Heart },
      { id: 'attribution', label: 'Attribution', icon: Megaphone },
      { id: 'integrations', label: 'Integrations', icon: Plug },
      { id: 'email-templates', label: 'Email Templates', icon: Mail },
      { id: 'woo-import', label: 'WooCommerce Import', icon: Download },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'email-reports', label: 'Email Reports', icon: Mail },
      { id: 'stripe-reconciliation', label: 'Stripe Reconciliation', icon: CreditCard },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { id: 'users-roles', label: 'Users & Roles', icon: Shield },
      { id: 'audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPage, onNavigate, isOpen = false, onClose }) => {
  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`w-64 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-50 font-admin-body print-hidden transition-transform duration-200 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="p-2 brand-bg-light rounded-xl">
            <Leaf className="brand-text" size={24} />
          </span>
          <div>
            <span className="font-bold text-slate-800 text-lg tracking-tight font-admin-display">
              ATL <span className="brand-text">Urban Farms</span>
            </span>
            <p className="text-xs text-slate-500 font-medium">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex > 0 ? 'mt-8' : ''}>
            <h3 className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = currentPage === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <motion.button
                      onClick={() => {
                        if (item.externalUrl) {
                          window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          onNavigate(item.id);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        isActive
                          ? 'brand-bg-subtle brand-secondary-text'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                      whileHover={{ x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <Icon size={20} className={isActive ? 'brand-text' : ''} />
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.externalUrl && (
                        <ExternalLink size={14} className="ml-auto text-slate-400" />
                      )}
                      {isActive && !item.externalUrl && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full brand-bg"
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
      <div className="px-6 py-4 border-t border-slate-200">
        <p className="text-[10px] text-slate-400 text-center">
          Built by <span className="text-slate-500">Sweetwater Technologies</span>
        </p>
      </div>
    </aside>
    </>
  );
};

export default AdminSidebar;
