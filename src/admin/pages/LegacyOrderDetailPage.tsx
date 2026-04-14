import React from 'react';
import { motion } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useLegacyOrder, LegacyOrderItem } from '../hooks/useOrders';
import { useBrandingSettings } from '../../hooks/useSupabase';

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
  const { settings: brandingSettings } = useBrandingSettings();

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

  const handlePrintInvoice = () => {
    if (!order) return;

    const orderNum = `WC-${order.woo_order_id}`;
    const orderDate = formatDate(order.order_date);

    // Line items
    let itemsHtml = '';
    items.forEach((item: LegacyOrderItem) => {
      const unitPrice = item.quantity > 0 ? item.line_total / item.quantity : item.line_total;
      itemsHtml += `
        <tr>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${item.product_name || 'Product'}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px;">${item.quantity}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${formatCurrency(unitPrice)}</td>
          <td style="padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px;">${formatCurrency(item.line_total)}</td>
        </tr>`;
    });

    // Customer info
    const customerName = (order.billing_first_name || order.billing_last_name)
      ? `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim()
      : (order.customers?.first_name || order.customers?.last_name)
        ? `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim()
        : 'Unknown Customer';
    const customerEmail = order.billing_email || order.customers?.email || '';
    const customerPhone = order.customers?.phone || '';
    const customerHtml = `
      <div style="flex: 1;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Customer</h3>
        ${customerName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${customerName}</p>` : ''}
        ${customerEmail ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${customerEmail}</p>` : ''}
        ${customerPhone ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${customerPhone}</p>` : ''}
      </div>`;

    // Bill To
    const billName = `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim();
    const billToHtml = `
      <div style="flex: 1;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Bill To</h3>
        ${billName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${billName}</p>` : ''}
        ${order.billing_address ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${order.billing_address}</p>` : ''}
        ${order.billing_city || order.billing_state || order.billing_zip ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${order.billing_city || ''}${order.billing_city && order.billing_state ? ', ' : ''}${order.billing_state || ''} ${order.billing_zip || ''}</p>` : ''}
      </div>`;

    // Ship To
    const shipName = `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim();
    const deliveryHtml = `
      <div style="flex: 1;">
        <h3 style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 4px;">Ship To</h3>
        ${shipName ? `<p style="margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600;">${shipName}</p>` : ''}
        ${order.shipping_address ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${order.shipping_address}</p>` : ''}
        ${order.shipping_city || order.shipping_state || order.shipping_zip ? `<p style="margin: 0; font-size: 12px; line-height: 1.4;">${order.shipping_city || ''}${order.shipping_city && order.shipping_state ? ', ' : ''}${order.shipping_state || ''} ${order.shipping_zip || ''}</p>` : ''}
      </div>`;

    // Payment
    const payMethod = order.payment_method || 'Unknown';
    const payMethodLabel = payMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const paymentHtml = `<div style="font-size: 12px; color: #4b5563; line-height: 1.5;"><strong style="color: #111827;">Payment:</strong> ${payMethodLabel}</div>`;

    // Logo
    const logoUrl = brandingSettings.logo_url;
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="ATL Urban Farms" style="max-height: 48px; width: auto;" />`
      : `<p style="margin: 0 0 4px; font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: 0.5px;">ATL URBAN FARMS</p>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${orderNum} - ATL Urban Farms</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 30px; color: #111827; font-size: 13px; }
          @media print {
            body { padding: 15px; }
            @page { size: portrait; margin: 0.4in; }
          }
        </style>
      </head>
      <body>
        <div style="max-width: 700px; margin: 0 auto;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #10b981; padding-bottom: 14px;">
            <div>
              ${logoHtml}
              <h1 style="margin: 4px 0 0; font-size: 24px; font-weight: 800; color: #111827;">INVOICE</h1>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 700; font-size: 14px;">Order ${orderNum}</p>
              <p style="margin: 3px 0 0; color: #6b7280; font-size: 12px;">Ordered: ${orderDate}</p>
              <p style="margin: 2px 0 0; color: #f59e0b; font-size: 11px; font-weight: 600;">Legacy Order</p>
            </div>
          </div>

          <!-- Customer / Bill To / Ship To -->
          <div style="display: flex; gap: 24px; margin-bottom: 20px;">
            ${customerHtml}
            ${billToHtml}
            ${deliveryHtml}
          </div>

          <!-- Line Items Table -->
          ${itemsHtml ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 5px 6px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Product</th>
                <th style="padding: 5px 6px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Qty</th>
                <th style="padding: 5px 6px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Unit Price</th>
                <th style="padding: 5px 6px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ` : '<p style="color: #6b7280; font-style: italic;">No line items available for this legacy order.</p>'}

          <!-- Totals Block -->
          <div style="margin-left: auto; width: 240px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Subtotal</span>
              <span>${formatCurrency(order.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Shipping</span>
              <span>${order.shipping > 0 ? formatCurrency(order.shipping) : '$0.00'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
              <span style="color: #6b7280;">Tax</span>
              <span>${formatCurrency(order.tax)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #111827; font-weight: 700; font-size: 15px;">
              <span>Total</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>

          <!-- Payment -->
          <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            ${paymentHtml}
          </div>

          <!-- Footer -->
          <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
            <p style="margin: 0;">Thank you for your order!</p>
            <p style="margin: 3px 0 0;">ATL Urban Farms &bull; www.atlurbanfarms.com</p>
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
            <button
              onClick={handlePrintInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invoice
            </button>
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
