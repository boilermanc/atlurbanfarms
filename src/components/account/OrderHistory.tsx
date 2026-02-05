import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCombinedOrders, useLegacyOrderItems } from '../../hooks/useSupabase';
import { getOrderStatusLabel } from '../../constants/orderStatus';

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
  isLegacy: false;
  orderDate: string;
}

interface LegacyOrder {
  id: string;
  woo_order_id: number;
  customer_id: string;
  order_date: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  payment_method?: string;
  billing_email?: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  isLegacy: true;
  orderDate: string;
}

interface ProductImage {
  id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

interface LegacyOrderItem {
  id: string;
  legacy_order_id: string;
  woo_order_id: number;
  woo_product_id: number | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  line_total: number;
  product?: {
    id: string;
    name: string;
    slug: string;
    images: ProductImage[];
  } | null;
}

type CombinedOrder = Order | LegacyOrder;

// Component to fetch and display legacy order items
interface LegacyOrderItemsDisplayProps {
  orderId: string;
  formatCurrency: (amount: number) => string;
}

const LegacyOrderItemsDisplay: React.FC<LegacyOrderItemsDisplayProps> = ({ orderId, formatCurrency }) => {
  const { items, loading, error } = useLegacyOrderItems(orderId);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-sm text-amber-800">
            Order item details are not available for this historical order.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item: LegacyOrderItem) => {
        // Get primary image from product images array
        const primaryImage = item.product?.images?.find(img => img.is_primary)
          || item.product?.images?.[0];

        return (
        <div key={item.id} className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
            {primaryImage?.url ? (
              <img
                src={primaryImage.url}
                alt={item.product_name}
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
            {item.product?.slug ? (
              <a
                href={`/shop/${item.product.slug}`}
                className="font-medium text-gray-900 truncate hover:text-emerald-600 transition-colors block"
              >
                {item.product_name}
              </a>
            ) : (
              <p className="font-medium text-gray-900 truncate">
                {item.product_name}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Qty: {item.quantity}
            </p>
          </div>
          <span className="font-medium text-gray-900">
            {formatCurrency(item.line_total || 0)}
          </span>
        </div>
        );
      })}
    </div>
  );
};

const OrderHistory: React.FC<OrderHistoryProps> = ({ userId, onNavigate }) => {
  const { orders, loading, error } = useCombinedOrders(userId);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Helper to get display order number
  const getOrderNumber = (order: CombinedOrder) => {
    if (order.isLegacy) {
      return `WC-${order.woo_order_id}`;
    }
    return order.order_number;
  };

  // Helper to get display status for legacy orders
  const getLegacyStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'completed': 'Completed',
      'refunded': 'Refunded',
      'cancelled': 'Cancelled',
      'processing': 'Processing',
      'on-hold': 'On Hold',
      'pending': 'Pending',
      'failed': 'Failed'
    };
    return statusMap[status?.toLowerCase()] || status || 'Unknown';
  };

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
    switch (status?.toLowerCase().replace('-', '_')) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-600';
      case 'processing':
        return 'bg-blue-50 text-blue-600';
      case 'on_hold':
        return 'bg-purple-50 text-purple-600';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-50 text-red-600';
      case 'failed':
        return 'bg-slate-100 text-slate-600';
      case 'pending_payment':
      case 'pending':
      default:
        return 'bg-amber-50 text-amber-700';
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

  if (error && orders.length > 0) {
    // Only show error state if we had orders but something went wrong
    // (e.g., partial load failure). For zero orders, fall through to the empty state.
    console.error('OrderHistory error:', error);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Order History
          </h1>
        </div>
        <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
          <p className="text-red-600 font-medium mb-2">Failed to load orders. Please try again later.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-red-500 text-sm font-mono bg-red-100 p-2 rounded mt-2">
              Debug: {error}
            </p>
          )}
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
          {orders.map((order: CombinedOrder) => (
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-heading font-bold text-gray-900">
                        Order #{getOrderNumber(order)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(order.status)}`}>
                        {order.isLegacy ? getLegacyStatusLabel(order.status) : getOrderStatusLabel(order.status)}
                      </span>
                      {order.isLegacy && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                          Historical
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(order.orderDate)}</p>
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
                      {/* Legacy Order Notice */}
                      {order.isLegacy && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                          <div className="flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0 mt-0.5">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <p className="text-sm text-gray-600">
                              This is a historical order from our previous system.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Order Items - Legacy Orders */}
                      {order.isLegacy && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Items
                          </h4>
                          <LegacyOrderItemsDisplay
                            orderId={order.id}
                            formatCurrency={formatCurrency}
                          />
                        </div>
                      )}

                      {/* Order Items - New orders */}
                      {!order.isLegacy && (order as Order).order_items?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Items
                          </h4>
                          <div className="space-y-3">
                            {(order as Order).order_items?.map((item: OrderItem) => (
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
                      )}

                      {/* Order Summary */}
                      <div className={!order.isLegacy && (order as Order).order_items?.length > 0 ? "border-t border-gray-100 pt-4" : ""}>
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                          Summary
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="text-gray-900">{formatCurrency(order.subtotal || 0)}</span>
                          </div>
                          {/* Shipping/Delivery fee - handle both order types */}
                          {order.isLegacy ? (
                            (order as LegacyOrder).shipping > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Shipping</span>
                                <span className="text-gray-900">{formatCurrency((order as LegacyOrder).shipping)}</span>
                              </div>
                            )
                          ) : (
                            (order as Order).delivery_fee > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Delivery</span>
                                <span className="text-gray-900">{formatCurrency((order as Order).delivery_fee)}</span>
                              </div>
                            )
                          )}
                          {(order.tax || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Tax</span>
                              <span className="text-gray-900">{formatCurrency(order.tax || 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold pt-2 border-t border-gray-100">
                            <span className="text-gray-900">Total</span>
                            <span className="text-gray-900">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Shipping Address - Legacy Orders */}
                      {order.isLegacy && ((order as LegacyOrder).shipping_address || (order as LegacyOrder).shipping_city) && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Shipping Address
                          </h4>
                          <div className="text-sm text-gray-600">
                            {((order as LegacyOrder).shipping_first_name || (order as LegacyOrder).shipping_last_name) && (
                              <p className="font-medium text-gray-900">
                                {(order as LegacyOrder).shipping_first_name} {(order as LegacyOrder).shipping_last_name}
                              </p>
                            )}
                            {(order as LegacyOrder).shipping_address && <p>{(order as LegacyOrder).shipping_address}</p>}
                            {((order as LegacyOrder).shipping_city || (order as LegacyOrder).shipping_state || (order as LegacyOrder).shipping_zip) && (
                              <p>
                                {(order as LegacyOrder).shipping_city}{(order as LegacyOrder).shipping_city && (order as LegacyOrder).shipping_state ? ', ' : ''}
                                {(order as LegacyOrder).shipping_state} {(order as LegacyOrder).shipping_zip}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delivery Address - New Orders */}
                      {!order.isLegacy && (order as Order).delivery_address && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Delivery Address
                          </h4>
                          <div className="text-sm text-gray-600">
                            {(order as Order).delivery_address.street && <p>{(order as Order).delivery_address.street}</p>}
                            {(order as Order).delivery_address.unit && <p>{(order as Order).delivery_address.unit}</p>}
                            <p>
                              {(order as Order).delivery_address.city}, {(order as Order).delivery_address.state} {(order as Order).delivery_address.zip}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Payment Method - Legacy Orders */}
                      {order.isLegacy && (order as LegacyOrder).payment_method && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Payment Method
                          </h4>
                          <p className="text-sm text-gray-600 capitalize">
                            {(order as LegacyOrder).payment_method?.replace(/_/g, ' ')}
                          </p>
                        </div>
                      )}

                      {/* Tracking Information - New Orders Only */}
                      {!order.isLegacy && (order as Order).shipments && (order as Order).shipments!.length > 0 && (order as Order).shipments!.some(s => s.tracking_number) && (
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                            Shipping & Tracking
                          </h4>
                          <div className="space-y-3">
                            {(order as Order).shipments!.filter(s => s.tracking_number).map((shipment) => (
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
