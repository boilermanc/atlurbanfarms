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
  product_price: number;
  line_total: number;
  product_name: string;
  product: {
    name: string;
    slug: string;
    primary_image_url: string | null;
  } | null;
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
  shipping_cost: number;
  total: number;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_address: {
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  is_pickup: boolean;
  pickup_location_id: string | null;
  pickup_date: string | null;
  pickup_time_start: string | null;
  pickup_time_end: string | null;
  customer_name: string | null;
  customer_email: string | null;
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
  const getOrderNumber = (order: CombinedOrder): string => {
    if (order.isLegacy) {
      return `WC-${order.woo_order_id}`;
    }
    return (order as Order).order_number;
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
    }).format(amount || 0);
  };

  const handlePrintInvoice = (order: CombinedOrder) => {
    const orderNum = getOrderNumber(order);
    const orderDate = formatDate(order.orderDate);

    // Build items HTML
    let itemsHtml = '';
    if (!order.isLegacy && (order as Order).order_items?.length > 0) {
      (order as Order).order_items.forEach((item: OrderItem) => {
        itemsHtml += `
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${item.product?.name || item.product_name || 'Product'}</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.product_price)}</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.line_total)}</td>
          </tr>`;
      });
    }

    // Build address
    let addressHtml = '';
    if (!order.isLegacy) {
      const o = order as Order;
      const addr = o.shipping_address;
      const name = addr?.name || `${o.shipping_first_name || ''} ${o.shipping_last_name || ''}`.trim();
      const street = addr?.street || o.shipping_address_line1;
      const street2 = addr?.street2 || o.shipping_address_line2;
      const city = addr?.city || o.shipping_city;
      const state = addr?.state || o.shipping_state;
      const zip = addr?.zip || o.shipping_zip;
      if (street) {
        addressHtml = `
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px;">Shipping Address</h3>
            ${name ? `<p style="margin: 0; font-weight: 600;">${name}</p>` : ''}
            <p style="margin: 0;">${street}</p>
            ${street2 ? `<p style="margin: 0;">${street2}</p>` : ''}
            <p style="margin: 0;">${city || ''}${city && state ? ', ' : ''}${state || ''} ${zip || ''}</p>
          </div>`;
      }
    } else {
      const lo = order as LegacyOrder;
      if (lo.shipping_address || lo.shipping_city) {
        const name = `${lo.shipping_first_name || ''} ${lo.shipping_last_name || ''}`.trim();
        addressHtml = `
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px;">Shipping Address</h3>
            ${name ? `<p style="margin: 0; font-weight: 600;">${name}</p>` : ''}
            ${lo.shipping_address ? `<p style="margin: 0;">${lo.shipping_address}</p>` : ''}
            <p style="margin: 0;">${lo.shipping_city || ''}${lo.shipping_city && lo.shipping_state ? ', ' : ''}${lo.shipping_state || ''} ${lo.shipping_zip || ''}</p>
          </div>`;
      }
    }

    // Shipping cost
    const shippingCost = order.isLegacy
      ? (order as LegacyOrder).shipping
      : (order as Order).shipping_cost;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${orderNum} - ATL Urban Farms</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #111827; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div style="max-width: 700px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #10b981; padding-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #111827;">INVOICE</h1>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">ATL Urban Farms</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 700;">Order #${orderNum}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${orderDate}</p>
            </div>
          </div>

          ${addressHtml}

          ${itemsHtml ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Item</th>
                <th style="padding: 8px; text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Qty</th>
                <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Price</th>
                <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ` : '<p style="color: #6b7280; font-style: italic;">Item details not available for this order.</p>'}

          <div style="margin-left: auto; width: 250px;">
            <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
              <span style="color: #6b7280;">Subtotal</span>
              <span>${formatCurrency(order.subtotal)}</span>
            </div>
            ${shippingCost > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
              <span style="color: #6b7280;">Shipping</span>
              <span>${formatCurrency(shippingCost)}</span>
            </div>` : ''}
            ${(order.tax || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
              <span style="color: #6b7280;">Tax</span>
              <span>${formatCurrency(order.tax)}</span>
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #111827; font-weight: 700; font-size: 16px;">
              <span>Total</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>

          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Thank you for your order!</p>
            <p style="margin: 4px 0 0;">ATL Urban Farms &bull; atlurbanfarms.com</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
                                    {item.product?.name || item.product_name || 'Product'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Qty: {item.quantity} × {formatCurrency(item.product_price)}
                                  </p>
                                </div>
                                <span className="font-medium text-gray-900">
                                  {formatCurrency(item.line_total)}
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
                            (order as Order).shipping_cost > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Shipping</span>
                                <span className="text-gray-900">{formatCurrency((order as Order).shipping_cost)}</span>
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

                      {/* Shipping Address - New Orders */}
                      {!order.isLegacy && (() => {
                        const o = order as Order;
                        const addr = o.shipping_address;
                        const hasIndividualFields = o.shipping_address_line1;
                        if (!addr && !hasIndividualFields) return null;
                        const name = addr?.name || `${o.shipping_first_name || ''} ${o.shipping_last_name || ''}`.trim();
                        const street = addr?.street || o.shipping_address_line1;
                        const street2 = addr?.street2 || o.shipping_address_line2;
                        const city = addr?.city || o.shipping_city;
                        const state = addr?.state || o.shipping_state;
                        const zip = addr?.zip || o.shipping_zip;
                        return (
                          <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                              Shipping Address
                            </h4>
                            <div className="text-sm text-gray-600">
                              {name && <p className="font-medium text-gray-900">{name}</p>}
                              {street && <p>{street}</p>}
                              {street2 && <p>{street2}</p>}
                              {(city || state || zip) && (
                                <p>
                                  {city}{city && state ? ', ' : ''}{state} {zip}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

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

                      {/* Print Invoice Button */}
                      <div className="border-t border-gray-100 pt-4">
                        <button
                          onClick={() => handlePrintInvoice(order)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print Invoice
                        </button>
                      </div>
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
