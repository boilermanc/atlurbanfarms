import React from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useLegacyOrder, LegacyOrderItem } from '../hooks/useOrders';

interface LegacyOrderDetailPageProps {
  orderId: string;
  onBack: () => void;
  onBackToCustomer?: () => void;
  customerContextName?: string;
}

const LegacyOrderDetailPage: React.FC<LegacyOrderDetailPageProps> = ({
  orderId,
  onBack,
  onBackToCustomer,
  customerContextName,
}) => {
  const { order, items, loading, error } = useLegacyOrder(orderId);

  // Format date
  const formatDate = (dateString: string | null | undefined, includeTime = false) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    if (includeTime) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get status badge with legacy-friendly styling
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      completed: { label: 'Completed', color: 'bg-emerald-500' },
      refunded: { label: 'Refunded', color: 'bg-rose-500' },
      cancelled: { label: 'Cancelled', color: 'bg-red-500' },
      processing: { label: 'Processing', color: 'bg-blue-500' },
      'on-hold': { label: 'On Hold', color: 'bg-purple-500' },
      pending: { label: 'Pending', color: 'bg-amber-500' },
      failed: { label: 'Failed', color: 'bg-slate-500' },
    };
    const config = statusMap[status?.toLowerCase()] || { label: status || 'Unknown', color: 'bg-slate-500' };
    return (
      <span className={`${config.color} text-white text-sm px-3 py-1 rounded-full font-medium`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  if (error || !order) {
    return (
      <AdminPageWrapper>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {onBackToCustomer && (
              <button
                onClick={onBackToCustomer}
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
              </button>
            )}
            <button
              onClick={() => onBack()}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Orders
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {error || 'Legacy order not found'}
          </div>
        </div>
      </AdminPageWrapper>
    );
  }

  // Get customer name: prefer billing info, fall back to joined customer data
  const getCustomerName = () => {
    // First try billing name from legacy order
    if (order.billing_first_name || order.billing_last_name) {
      return `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim();
    }
    // Fall back to joined customer data
    if (order.customers?.first_name || order.customers?.last_name) {
      return `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim();
    }
    return 'Unknown Customer';
  };
  const customerName = getCustomerName();

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Back Buttons */}
        <div className="flex items-center gap-3">
          {onBackToCustomer && (
            <button
              onClick={onBackToCustomer}
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Customer{customerContextName ? ` (${customerContextName})` : ''}
            </button>
          )}
          <button
            onClick={() => onBack()}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Orders
          </button>
        </div>

        {/* Order Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-800 font-mono font-admin-display">
                  WC-{order.woo_order_id}
                </h1>
                {getStatusBadge(order.status)}
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  Legacy Order
                </span>
              </div>
              <p className="text-slate-500 mt-1">
                Placed on {formatDate(order.order_date, true)}
              </p>
            </div>
          </div>
        </div>

        {/* Legacy Order Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-amber-800 font-medium">Historical Order from WooCommerce</p>
              <p className="text-amber-700 text-sm mt-1">
                This order was imported from the previous WooCommerce system. Some features like status updates, refunds, and shipping labels are not available for legacy orders.
              </p>
            </div>
          </div>
        </div>

        {/* Customer and Shipping Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Customer</h2>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-slate-800 font-medium">{customerName}</p>
              </div>
              {order.billing_email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${order.billing_email}`} className="hover:text-emerald-600">
                    {order.billing_email}
                  </a>
                </div>
              )}
              {(order.billing_address || order.billing_city) && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-400 text-sm mb-1">Billing Address</p>
                  <address className="text-slate-600 not-italic leading-relaxed text-sm">
                    {order.billing_address && <p>{order.billing_address}</p>}
                    {(order.billing_city || order.billing_state || order.billing_zip) && (
                      <p>
                        {order.billing_city}{order.billing_city && order.billing_state ? ', ' : ''}
                        {order.billing_state} {order.billing_zip}
                      </p>
                    )}
                  </address>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Shipping Address</h2>
            </div>
            <div className="p-6">
              {order.shipping_address || order.shipping_city ? (
                <address className="text-slate-600 not-italic leading-relaxed">
                  {(order.shipping_first_name || order.shipping_last_name) && (
                    <p className="font-medium text-slate-800">
                      {order.shipping_first_name} {order.shipping_last_name}
                    </p>
                  )}
                  {order.shipping_address && <p>{order.shipping_address}</p>}
                  {(order.shipping_city || order.shipping_state || order.shipping_zip) && (
                    <p>
                      {order.shipping_city}{order.shipping_city && order.shipping_state ? ', ' : ''}
                      {order.shipping_state} {order.shipping_zip}
                    </p>
                  )}
                </address>
              ) : (
                <p className="text-slate-400 italic">No shipping address on file</p>
              )}
            </div>
          </div>
        </div>

        {/* Order Items Card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/60">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Order Items</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((item: LegacyOrderItem) => {
                // Get primary image from product images array
                const primaryImage = item.product?.images?.find(img => img.is_primary)
                  || item.product?.images?.[0];

                return (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  {primaryImage?.url ? (
                    <img
                      src={primaryImage.url}
                      alt={item.product_name}
                      className="w-16 h-16 object-cover rounded-lg bg-slate-100"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-800 font-medium truncate">
                      {item.product_name}
                    </h3>
                    <p className="text-slate-500 text-sm">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-800 font-medium">
                      {formatCurrency(item.line_total)}
                    </p>
                  </div>
                </div>
                );
              })
            ) : (
              <div className="p-6 text-center">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 inline-block">
                  <div className="flex items-center gap-2 text-amber-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Order item details are not available for this historical order.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="px-6 py-4 border-t border-slate-200 space-y-2 bg-slate-50">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.shipping > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-800 font-bold text-lg pt-2 border-t border-slate-200">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        {order.payment_method && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Payment Information</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Payment Method</p>
                  <p className="text-slate-800 font-medium capitalize">
                    {order.payment_method.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-700 font-medium mb-2">About Legacy Orders</h3>
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Legacy orders were imported from WooCommerce and are read-only</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Status changes, refunds, and shipping labels cannot be processed for legacy orders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Some product links may not work if the product was discontinued or renamed</span>
            </li>
          </ul>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default LegacyOrderDetailPage;
