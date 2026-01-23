import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../../hooks/useSupabase';

interface OrderHistoryProps {
  userId: string;
  onNavigate?: (view: string) => void;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    name: string;
    slug: string;
    primary_image_url: string | null;
  };
}

interface Shipment {
  id: string;
  tracking_number: string | null;
  carrier_code: string | null;
  status: string;
  tracking_status: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total: number;
  delivery_address: any;
  order_items: OrderItem[];
  shipments?: Shipment[];
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ userId, onNavigate }) => {
  const { orders, loading, error } = useOrders(userId);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleTrackPackage = (trackingNumber: string, carrierCode: string) => {
    // Navigate to tracking page with params
    const trackingUrl = `/tracking?number=${encodeURIComponent(trackingNumber)}&carrier=${encodeURIComponent(carrierCode)}`;
    window.history.pushState({}, '', trackingUrl);
    if (onNavigate) {
      onNavigate('tracking');
    } else {
      window.location.href = trackingUrl;
    }
  };

  const getCarrierName = (carrierCode: string): string => {
    const carriers: Record<string, string> = {
      'stamps_com': 'USPS',
      'usps': 'USPS',
      'ups': 'UPS',
      'fedex': 'FedEx',
      'dhl_express': 'DHL'
    };
    return carriers[carrierCode?.toLowerCase()] || carrierCode?.replace(/_/g, ' ')?.toUpperCase() || 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-emerald-50 text-emerald-600';
      case 'processing':
      case 'preparing':
        return 'bg-blue-50 text-blue-600';
      case 'shipped':
      case 'out_for_delivery':
        return 'bg-purple-50 text-purple-600';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-50 text-red-600';
      case 'pending':
      default:
        return 'bg-yellow-50 text-yellow-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Order History
          </h1>
          <p className="text-gray-500">Loading your orders...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-gray-200 rounded" />
                  <div className="h-4 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Order History
          </h1>
        </div>
        <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
          <p className="text-red-600">Failed to load orders. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          Order History
        </h1>
        <p className="text-gray-500">
          {orders.length === 0
            ? "You haven't placed any orders yet."
            : `You have ${orders.length} order${orders.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-500">When you place an order, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: Order) => (
            <motion.div
              key={order.id}
              layout
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Order Header */}
              <button
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-heading font-bold text-gray-900">
                        Order #{order.order_number}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-heading font-bold text-gray-900">
                      {formatCurrency(order.total)}
                    </span>
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                      animate={{ rotate: expandedOrderId === order.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </motion.svg>
                  </div>
                </div>
              </button>

              {/* Order Details (Expandable) */}
              <AnimatePresence>
                {expandedOrderId === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-100"
                  >
                    <div className="p-6 space-y-6">
                      {/* Order Items */}
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                          Items
                        </h4>
                        <div className="space-y-3">
                          {order.order_items?.map((item: OrderItem) => (
                            <div key={item.id} className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                                {item.product?.primary_image_url ? (
                                  <img
                                    src={item.product.primary_image_url}
                                    alt={item.product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="3" width="18" height="18" rx="2" />
                                      <circle cx="8.5" cy="8.5" r="1.5" />
                                      <path d="M21 15l-5-5L5 21" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {item.product?.name || 'Product'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(item.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Summary */}
                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                          Summary
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                          </div>
                          {order.delivery_fee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Delivery</span>
                              <span className="text-gray-900">{formatCurrency(order.delivery_fee)}</span>
                            </div>
                          )}
                          {order.tax > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Tax</span>
                              <span className="text-gray-900">{formatCurrency(order.tax)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold pt-2 border-t border-gray-100">
                            <span className="text-gray-900">Total</span>
                            <span className="text-gray-900">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Address */}
                      {order.delivery_address && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Delivery Address
                          </h4>
                          <div className="text-sm text-gray-600">
                            {order.delivery_address.street && <p>{order.delivery_address.street}</p>}
                            {order.delivery_address.unit && <p>{order.delivery_address.unit}</p>}
                            <p>
                              {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.zip}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Tracking Information */}
                      {order.shipments && order.shipments.length > 0 && order.shipments.some(s => s.tracking_number) && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Shipping & Tracking
                          </h4>
                          <div className="space-y-3">
                            {order.shipments.filter(s => s.tracking_number).map((shipment) => (
                              <div key={shipment.id} className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {getCarrierName(shipment.carrier_code || '')}
                                    </span>
                                    {shipment.tracking_status && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        shipment.tracking_status === 'DE' ? 'bg-emerald-100 text-emerald-700' :
                                        shipment.tracking_status === 'IT' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {shipment.tracking_status === 'DE' ? 'Delivered' :
                                         shipment.tracking_status === 'IT' ? 'In Transit' :
                                         shipment.tracking_status}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleTrackPackage(shipment.tracking_number!, shipment.carrier_code!)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Track Package
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 font-mono">
                                  {shipment.tracking_number}
                                </p>
                                {shipment.estimated_delivery_date && shipment.tracking_status !== 'DE' && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    Est. delivery: {new Date(shipment.estimated_delivery_date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </p>
                                )}
                                {shipment.actual_delivery_date && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    Delivered: {new Date(shipment.actual_delivery_date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
