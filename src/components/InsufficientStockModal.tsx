import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ShoppingCart, Trash2 } from 'lucide-react';

export interface StockIssue {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

interface InsufficientStockModalProps {
  isOpen: boolean;
  stockIssues: StockIssue[];
  onClose: () => void;
  onUpdateCart: () => void;
  onRemoveUnavailable: () => void;
}

const InsufficientStockModal: React.FC<InsufficientStockModalProps> = ({
  isOpen,
  stockIssues,
  onClose,
  onUpdateCart,
  onRemoveUnavailable,
}) => {
  if (!isOpen || stockIssues.length === 0) return null;

  const allUnavailable = stockIssues.every(issue => issue.available === 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {allUnavailable ? 'Items Out of Stock' : 'Stock Has Changed'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                {allUnavailable
                  ? 'The following items are no longer available:'
                  : 'Some items in your cart have limited availability:'}
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {stockIssues.map((issue) => (
                  <div
                    key={issue.productId}
                    className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {issue.name}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {issue.available === 0
                          ? 'Out of stock'
                          : `Only ${issue.available} available (you requested ${issue.requested})`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-100 flex flex-col gap-3">
              <button
                onClick={onRemoveUnavailable}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {allUnavailable ? 'Remove Items & Continue' : 'Adjust Quantities & Continue'}
              </button>
              <button
                onClick={onUpdateCart}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Go Back to Cart
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InsufficientStockModal;
