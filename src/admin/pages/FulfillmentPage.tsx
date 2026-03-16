import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useOrders, ORDER_STATUSES, ORDER_STATUS_CONFIG, OrderStatus, Order, useUpdateOrderStatus, ViewOrderHandler, getOrderSeedlingTotal } from '../hooks/useOrders';
import { useEmailService } from '../../hooks/useIntegrations';
import { useEmailTemplates, EmailTemplate } from '../hooks/useEmailTemplates';
import { supabase } from '../../lib/supabase';
import { Printer, X, RefreshCw, Search, ChevronDown, Check, Mail, Trash2, FileText, Send, AlertCircle, CheckCircle } from 'lucide-react';

const formatStatusLabel = (status: string) =>
  ORDER_STATUS_CONFIG[status as OrderStatus]?.label || status.replace(/_/g, ' ');

interface FulfillmentPageProps {
  onViewOrder: ViewOrderHandler;
}

const FulfillmentPage: React.FC<FulfillmentPageProps> = ({ onViewOrder }) => {
  // Multi-select status filter state
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['processing']));
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Other filter state
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection state for batch operations
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [printLoading, setPrintLoading] = useState(false);

  // Bulk actions state
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'print' | 'email' | 'archive'>('status');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Email compose modal state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResults, setEmailResults] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');

  // Email hooks
  const { sendEmail } = useEmailService();
  const { templates: emailTemplates } = useEmailTemplates();

  // Update order status hook
  const { updateStatus } = useUpdateOrderStatus();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build filters object with multiple statuses
  const filters = useMemo(() => ({
    statuses: selectedStatuses.size > 0 ? Array.from(selectedStatuses) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: searchTerm || undefined,
    page: currentPage,
    perPage: 20,
  }), [selectedStatuses, dateFrom, dateTo, searchTerm, currentPage]);

  // Fetch orders
  const { orders, totalCount, totalPages, loading, error, refetch } = useOrders(filters);

  // Handle status toggle
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
    setCurrentPage(1);
  };

  // Select/deselect all statuses
  const toggleAllStatuses = () => {
    if (selectedStatuses.size === ORDER_STATUSES.length) {
      setSelectedStatuses(new Set());
    } else {
      setSelectedStatuses(new Set(ORDER_STATUSES));
    }
    setCurrentPage(1);
  };

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedStatuses(new Set(['processing']));
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setSearchInput('');
    setCurrentPage(1);
  };

  // Check if any filters are active (beyond default)
  const hasActiveFilters = selectedStatuses.size !== 1 ||
    !selectedStatuses.has('processing') ||
    dateFrom || dateTo || searchTerm;

  // Selection handlers
  const toggleOrderSelection = useCallback((orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  }, [orders, selectedOrders.size]);

  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
    setBulkStatus('');
  }, []);

  // Bulk action handlers
  const handleBulkStatusChange = useCallback(() => {
    if (!bulkStatus || selectedOrders.size === 0) return;
    setBulkActionType('status');
    setShowBulkConfirm(true);
  }, [bulkStatus, selectedOrders.size]);

  const executeBulkStatusChange = useCallback(async () => {
    if (!bulkStatus || selectedOrders.size === 0) return;

    setBulkLoading(true);
    try {
      const orderIds = Array.from(selectedOrders);
      const results = await Promise.all(
        orderIds.map(orderId =>
          updateStatus(orderId, bulkStatus as OrderStatus, `Bulk status change to ${ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}`)
        )
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        alert(`Updated ${successCount} orders. ${failCount} failed.`);
      } else {
        alert(`Successfully updated ${successCount} orders to ${ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}`);
      }

      clearSelection();
      refetch();
    } catch (err: any) {
      console.error('Bulk status update error:', err);
      alert('Failed to update orders: ' + err.message);
    } finally {
      setBulkLoading(false);
      setShowBulkConfirm(false);
    }
  }, [bulkStatus, selectedOrders, updateStatus, clearSelection, refetch]);

  const handleBulkPrintInvoices = useCallback(() => {
    alert('Print Invoices feature coming soon!');
  }, []);

  const handleBulkEmailInvoices = useCallback(() => {
    setEmailSubject('');
    setEmailBody('');
    setEmailResults(null);
    setSelectedTemplateKey('');
    setShowEmailCompose(true);
  }, []);

  const handleTemplateSelect = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (!templateKey) {
      setEmailSubject('');
      setEmailBody('');
      return;
    }
    const template = emailTemplates.find(t => t.template_key === templateKey);
    if (template) {
      setEmailSubject(template.subject_line);
      // Strip HTML tags for the body textarea, keep plain text version if available
      setEmailBody(template.plain_text_content || template.html_content.replace(/<[^>]*>/g, ''));
    }
  }, [emailTemplates]);

  const handleSendBulkEmail = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;

    const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));
    const recipients = selectedOrdersList
      .map(o => ({ email: o.customer_email, name: o.customer_name, orderId: o.id, orderNumber: o.order_number }))
      .filter(r => r.email);

    if (recipients.length === 0) {
      alert('No valid email addresses found for selected orders.');
      return;
    }

    setEmailSending(true);
    setEmailResults(null);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Wrap body in simple HTML
    const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
${emailBody.split('\n').map(line => `<p style="margin: 0 0 12px 0; color: #333; line-height: 1.6;">${line || '&nbsp;'}</p>`).join('\n')}
</div>`;

    for (const recipient of recipients) {
      try {
        const result = await sendEmail({
          to: recipient.email!,
          subject: emailSubject,
          html: htmlBody,
          text: emailBody,
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${recipient.email}: ${result.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        failed++;
        errors.push(`${recipient.email}: ${err.message}`);
      }
    }

    setEmailSending(false);
    setEmailResults({ sent, failed, errors });
  }, [emailSubject, emailBody, orders, selectedOrders, sendEmail]);

  const handleBulkArchive = useCallback(() => {
    setBulkActionType('archive');
    setShowBulkConfirm(true);
  }, []);

  const executeBulkAction = useCallback(async () => {
    if (bulkActionType === 'status') {
      await executeBulkStatusChange();
    } else if (bulkActionType === 'archive') {
      alert('Archive feature coming soon!');
      setShowBulkConfirm(false);
    }
  }, [bulkActionType, executeBulkStatusChange]);

  // Print functions
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const openPrintWindow = useCallback(async (ordersToPrint: Order[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print orders');
      return;
    }

    const formatDateForPrint = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const getPickupInfo = (order: Order) => {
      const res = order.pickup_reservation;
      const locName = res?.location?.name || 'TBD';
      const date = order.pickup_date || res?.pickup_date;
      const start = order.pickup_time_start || res?.pickup_time_start;
      const end = order.pickup_time_end || res?.pickup_time_end;
      let dateStr = '';
      if (date) {
        const d = new Date(date + 'T00:00:00');
        dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
      let timeStr = '';
      if (start && end) {
        const fmt = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        timeStr = `${fmt(start)} – ${fmt(end)}`;
      }
      return { locName, dateStr, timeStr };
    };

    // Fetch logo URL from branding settings
    let logoUrl = '';
    try {
      const { data: logoData } = await supabase
        .from('config_settings')
        .select('value')
        .eq('category', 'branding')
        .eq('key', 'logo_url')
        .single();
      logoUrl = logoData?.value || '';
    } catch { /* logo is optional */ }

    // Collect parent product IDs from all order items
    const allProductIds = [...new Set(ordersToPrint.flatMap(o => (o.items || []).map(i => i.product_id)).filter(Boolean))];

    const bundleChildrenMap: Record<string, { name: string; quantity: number; product_id: string }[]> = {};
    if (allProductIds.length > 0) {
      const { data: bundleData } = await supabase
        .from('product_relationships')
        .select('parent_product_id, child_product_id, quantity, sort_order')
        .in('parent_product_id', allProductIds)
        .eq('relationship_type', 'bundle')
        .order('sort_order');
      if (bundleData && bundleData.length > 0) {
        const childIds = [...new Set(bundleData.map((r: any) => r.child_product_id))];
        const { data: childProducts } = await supabase
          .from('products')
          .select('id, name')
          .in('id', childIds);
        const productNameMap: Record<string, string> = {};
        (childProducts || []).forEach((p: any) => { productNameMap[p.id] = p.name; });
        for (const rel of bundleData) {
          if (!bundleChildrenMap[rel.parent_product_id]) {
            bundleChildrenMap[rel.parent_product_id] = [];
          }
          bundleChildrenMap[rel.parent_product_id].push({
            name: productNameMap[rel.child_product_id] || 'Unknown',
            quantity: rel.quantity || 1,
            product_id: rel.child_product_id,
          });
        }
      }
    }

    // Collect all product IDs including bundle children for category lookup
    const allChildIds = Object.values(bundleChildrenMap).flatMap(children => children.map(c => c.product_id));
    const allProductIdsForCategory = [...new Set([...allProductIds, ...allChildIds])];

    // Fetch category assignments
    const categoryMap: Record<string, { name: string; sort_order: number }> = {};
    if (allProductIdsForCategory.length > 0) {
      const { data: catData } = await supabase
        .from('product_category_assignments')
        .select('product_id, product_categories(name, sort_order)')
        .in('product_id', allProductIdsForCategory);
      (catData || []).forEach((row: any) => {
        if (!categoryMap[row.product_id] && row.product_categories) {
          categoryMap[row.product_id] = {
            name: row.product_categories.name,
            sort_order: row.product_categories.sort_order ?? 9999,
          };
        }
      });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packing Lists - ATL Urban Farms</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b; }

          .order-block { page-break-after: always; padding: 24px; }
          .order-block:last-child { page-break-after: auto; }

          /* Header */
          .pl-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #000; margin-bottom: 18px; }
          .pl-logo { height: 44px; width: auto; display: block; margin-bottom: 6px; }
          .pl-brand-name { font-size: 15px; font-weight: 700; }
          .pl-brand-contact { font-size: 11px; color: #64748b; line-height: 1.7; }
          .pl-order-meta { text-align: right; }
          .pl-order-num { font-family: monospace; font-size: 20px; font-weight: 800; }
          .pl-order-date { font-size: 11px; color: #64748b; margin-top: 2px; margin-bottom: 6px; }
          .badge { display: inline-block; }
          .badge-ship { background: #dbeafe; color: #1e40af; border: 1.5px solid #1e40af; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; }
          .badge-pickup { background: #fef3c7; color: #92400e; border: 1.5px solid #92400e; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; }

          /* Two-column info block */
          .pl-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
          .pl-block { padding: 10px 12px; border: 0.5px solid #e2e8f0; border-radius: 6px; }
          .pl-block-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 6px; }
          .pl-block p { margin: 2px 0; font-size: 13px; line-height: 1.5; }
          .pl-divider { border: none; border-top: 0.5px solid #e2e8f0; margin: 6px 0; }
          .pl-shipping-label { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px; margin-top: 2px; }

          /* Items table */
          .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px; }
          .items-table col.col-num { width: 68px; }
          .items-table col.col-qty { width: 44px; }
          .items-table th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; white-space: nowrap; }
          .items-table th.col-num, .items-table th.col-qty { text-align: center; }
          .items-table td { padding: 4px 8px; border-bottom: 0.5px solid #e2e8f0; font-size: 13px; color: #1e293b; }
          .items-table td.col-num { text-align: center; color: #94a3b8; font-size: 10px; }
          .items-table td.col-qty { text-align: center; font-weight: 700; font-size: 14px; }
          .items-table tr.cat-row td { background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; padding: 4px 8px; }
          .items-table tr.totals-row td { border-top: 2px solid #334155; font-weight: 700; padding-top: 6px; font-size: 13px; }
          .items-table tr.totals-row td.col-qty { font-size: 14px; }

          /* Notes */
          .customer-note { background: #fefce8; border: 2px solid #facc15; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
          .customer-note-label { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #854d0e; margin-bottom: 4px; }
          .customer-note-text { font-size: 13px; line-height: 1.5; }
          .internal-note { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
          .internal-note-label { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #0369a1; margin-bottom: 4px; }
          .internal-note-text { font-size: 13px; line-height: 1.5; }

          .order-separator { border: none; border-top: 2px dashed #94a3b8; margin: 24px 0 0 0; }

          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .order-block { padding: 16px 0; }
          }
        </style>
      </head>
      <body>
        ${ordersToPrint.map(order => {
          const isPickup = order.is_pickup;
          const badgeCls = isPickup ? 'badge-pickup' : 'badge-ship';
          const badgeText = isPickup ? 'PICKUP' : 'SHIP';
          const pickup = isPickup ? getPickupInfo(order) : null;
          const shippingCompany = (order as any).shipping_company || (order as any).shipping_address?.company || '';

          // Flatten bundles into individual child rows
          const flatItems: { product_id: string; product_name: string; quantity: number }[] = [];
          for (const item of order.items || []) {
            const children = bundleChildrenMap[item.product_id];
            if (children && children.length > 0) {
              for (const child of children) {
                flatItems.push({
                  product_id: child.product_id,
                  product_name: child.name,
                  quantity: child.quantity * item.quantity,
                });
              }
            } else {
              flatItems.push({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
              });
            }
          }

          // Sort by category sort_order, then category name, then product name
          flatItems.sort((a, b) => {
            const catA = categoryMap[a.product_id];
            const catB = categoryMap[b.product_id];
            const sortA = catA ? catA.sort_order : 9999;
            const sortB = catB ? catB.sort_order : 9999;
            const nameA = catA ? catA.name : 'zzz';
            const nameB = catB ? catB.name : 'zzz';
            if (sortA !== sortB) return sortA - sortB;
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            return a.product_name.localeCompare(b.product_name);
          });

          // Build rows with category headers
          let currentCat = '';
          let totalQty = 0;
          const itemRows = flatItems.map(item => {
            const cat = categoryMap[item.product_id]?.name || 'Uncategorized';
            let catHeader = '';
            if (cat !== currentCat) {
              currentCat = cat;
              catHeader = `<tr class="cat-row"><td colspan="3">${escapeHtml(cat)}</td></tr>`;
            }
            totalQty += item.quantity;
            return `${catHeader}<tr>
              <td class="col-num"></td>
              <td class="col-qty">${item.quantity}</td>
              <td>${escapeHtml(item.product_name)}</td>
            </tr>`;
          }).join('');

          return `
          <div class="order-block">
            <div class="pl-header">
              <div>
                ${logoUrl ? `<img src="${logoUrl}" class="pl-logo" onerror="this.style.display='none'" alt="ATL Urban Farms">` : ''}
                <div class="pl-brand-name">ATL Urban Farms</div>
                <div class="pl-brand-contact">(770) 678-6552<br>orders@atlurbanfarms.com</div>
              </div>
              <div class="pl-order-meta">
                <div class="pl-order-num">${order.order_number}</div>
                <div class="pl-order-date">${formatDateForPrint(order.created_at)}</div>
                <span class="badge ${badgeCls}">${badgeText}</span>
              </div>
            </div>

            <div class="pl-two-col">
              <div class="pl-block">
                <div class="pl-block-label">${isPickup ? 'Pickup' : 'Ship To'}</div>
                ${isPickup && pickup ? `
                  <p style="font-weight:700">${escapeHtml(pickup.locName)}</p>
                  ${pickup.dateStr ? `<p>${escapeHtml(pickup.dateStr)}</p>` : ''}
                  ${pickup.timeStr ? `<p>${escapeHtml(pickup.timeStr)}</p>` : ''}
                ` : order.shipping_address ? `
                  <p style="font-weight:700">${escapeHtml(order.shipping_address.name || '')}</p>
                  ${shippingCompany ? `<p>${escapeHtml(shippingCompany)}</p>` : ''}
                  <p>${escapeHtml(order.shipping_address.street || '')}</p>
                  ${order.shipping_address.street2 ? `<p>${escapeHtml(order.shipping_address.street2)}</p>` : ''}
                  <p>${escapeHtml(order.shipping_address.city || '')}, ${escapeHtml(order.shipping_address.state || '')} ${escapeHtml(order.shipping_address.zip || '')}</p>
                ` : '<p>No shipping address</p>'}
              </div>
              <div class="pl-block">
                <div class="pl-block-label">Customer</div>
                <p style="font-weight:700">${escapeHtml(order.customer_name || 'Guest')}</p>
                ${order.customer_email ? `<p style="color:#64748b">${escapeHtml(order.customer_email)}</p>` : ''}
                ${order.customer_phone ? `<p style="color:#64748b">${escapeHtml(order.customer_phone)}</p>` : ''}
                <hr class="pl-divider">
                <div class="pl-shipping-label">Shipping Method</div>
                <p>${escapeHtml(order.shipping_method || 'Standard')}</p>
              </div>
            </div>

            ${order.customer_notes ? `
              <div class="customer-note">
                <div class="customer-note-label">Customer Note</div>
                <div class="customer-note-text">${escapeHtml(order.customer_notes).replace(/\n/g, '<br>')}</div>
              </div>
            ` : ''}

            <table class="items-table">
              <colgroup>
                <col class="col-num">
                <col class="col-qty">
                <col>
              </colgroup>
              <thead>
                <tr>
                  <th class="col-num">Seedling #</th>
                  <th class="col-qty">Qty</th>
                  <th>Product</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr class="totals-row">
                  <td class="col-num"></td>
                  <td class="col-qty">${totalQty}</td>
                  <td>Total</td>
                </tr>
              </tbody>
            </table>

            ${order.internal_notes ? `
              <div class="internal-note">
                <div class="internal-note-label">Internal Notes</div>
                <div class="internal-note-text">${escapeHtml(order.internal_notes).replace(/\n/g, '<br>')}</div>
              </div>
            ` : ''}

            <hr class="order-separator" />
          </div>`;
        }).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, []);

  const handlePrintSelected = useCallback(async () => {
    const ordersToPrint = orders.filter(o => selectedOrders.has(o.id));
    if (ordersToPrint.length === 0) return;
    await openPrintWindow(ordersToPrint);
  }, [orders, selectedOrders, openPrintWindow]);

  const handlePrintAllFiltered = useCallback(async () => {
    if (selectedStatuses.size === 0) {
      alert('Please select at least one status to print');
      return;
    }

    setPrintLoading(true);
    try {
      // Fetch all orders matching current filters (not just current page)
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          order_items_with_product (
            id,
            product_id,
            product_name,
            product_price,
            quantity,
            line_total,
            product_type,
            bundle_item_count,
            products (
              name
            )
          ),
          pickup_reservations (
            id,
            pickup_date,
            pickup_time_start,
            pickup_time_end,
            status,
            notes,
            pickup_locations (
              id, name, address_line1, city, state, postal_code
            )
          )
        `)
        .in('status', Array.from(selectedStatuses))
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }
      if (searchTerm) {
        query = query.or(`order_number.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No orders match the current filters');
        return;
      }

      // Transform to Order format
      const filteredOrders: Order[] = data.map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers
          ? `${order.customers.first_name || ''} ${order.customers.last_name || ''}`.trim() || null
          : order.shipping_address?.name || `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim() || null,
        customer_email: order.customer_email || order.guest_email || order.customers?.email,
        customer_phone: order.customers?.phone || order.shipping_phone || null,
        status: order.status,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        shipping_address: order.shipping_address || (order.shipping_address_line1 ? {
          name: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
          street: order.shipping_address_line1,
          street2: order.shipping_address_line2 || null,
          city: order.shipping_city,
          state: order.shipping_state,
          zip: order.shipping_zip
        } : null),
        shipping_method: order.shipping_method,
        tracking_number: order.tracking_number,
        estimated_delivery: order.estimated_delivery,
        internal_notes: order.internal_notes,
        customer_notes: order.customer_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.order_items_with_product || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || 'Unknown Product',
          product_image: null,
          quantity: item.quantity,
          unit_price: item.product_price,
          line_total: item.line_total,
          product_type: item.product_type || null,
          seedlings_per_unit: item.bundle_item_count || null,
        })),
        is_pickup: order.is_pickup || false,
        pickup_location_id: order.pickup_location_id,
        pickup_date: order.pickup_date,
        pickup_time_start: order.pickup_time_start,
        pickup_time_end: order.pickup_time_end,
        pickup_reservation: order.pickup_reservations?.[0] ? {
          id: order.pickup_reservations[0].id,
          location: order.pickup_reservations[0].pickup_locations,
          pickup_date: order.pickup_reservations[0].pickup_date,
          pickup_time_start: order.pickup_reservations[0].pickup_time_start,
          pickup_time_end: order.pickup_reservations[0].pickup_time_end,
          status: order.pickup_reservations[0].status,
          notes: order.pickup_reservations[0].notes,
        } : undefined,
      }));

      await openPrintWindow(filteredOrders);
    } catch (err: any) {
      console.error('Error fetching orders for print:', err);
      alert('Failed to fetch orders: ' + err.message);
    } finally {
      setPrintLoading(false);
    }
  }, [selectedStatuses, dateFrom, dateTo, searchTerm, openPrintWindow]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
      processing: 'bg-blue-50 text-blue-700 border-blue-200',
      picked_up: 'bg-teal-50 text-teal-700 border-teal-200',
      on_hold: 'bg-purple-50 text-purple-700 border-purple-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
      refunded: 'bg-rose-50 text-rose-700 border-rose-200',
      failed: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    const config = ORDER_STATUS_CONFIG[status as OrderStatus] || { label: formatStatusLabel(status) };
    const style = statusStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
    return (
      <span className={`${style} text-xs px-3 py-1 rounded-full font-semibold border`}>
        {config.label}
      </span>
    );
  };

  // Navigate to order detail
  const handleRowClick = (orderId: string) => {
    onViewOrder(orderId);
  };

  // Get display text for status filter button
  const getStatusFilterText = () => {
    if (selectedStatuses.size === 0) return 'No statuses selected';
    if (selectedStatuses.size === ORDER_STATUSES.length) return 'All Statuses';
    if (selectedStatuses.size === 1) {
      const status = Array.from(selectedStatuses)[0];
      return ORDER_STATUS_CONFIG[status as OrderStatus]?.label || status;
    }
    return `${selectedStatuses.size} statuses selected`;
  };

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (showEllipsisStart) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (showEllipsisEnd) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between mt-4 px-6 py-4 border-t border-slate-100">
        <div className="text-sm text-slate-500">
          Showing {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalCount)} of {totalCount} orders
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && setCurrentPage(page)}
              disabled={typeof page !== 'number'}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-emerald-500 text-white'
                  : typeof page === 'number'
                  ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-transparent text-slate-400 cursor-default'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Fulfillment</h1>
            <p className="text-slate-500 mt-1">
              {totalCount} {totalCount === 1 ? 'order' : 'orders'} to process
              {selectedOrders.size > 0 && (
                <span className="ml-2 text-emerald-600 font-medium">
                  ({selectedOrders.size} selected)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print All Filtered Button */}
            <button
              onClick={handlePrintAllFiltered}
              disabled={printLoading || selectedStatuses.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
            >
              {printLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Printer size={18} />
              )}
              Print All Filtered
            </button>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex flex-wrap items-end gap-4">
            {/* Multi-Select Status Filter */}
            <div className="flex-1 min-w-[200px]" ref={statusDropdownRef}>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Status (multi-select)
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-left text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all flex items-center justify-between"
                >
                  <span className={selectedStatuses.size === 0 ? 'text-slate-400' : ''}>
                    {getStatusFilterText()}
                  </span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {statusDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                    >
                      {/* Select All */}
                      <button
                        type="button"
                        onClick={toggleAllStatuses}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedStatuses.size === ORDER_STATUSES.length
                            ? 'bg-emerald-500 border-emerald-500'
                            : selectedStatuses.size > 0
                            ? 'bg-emerald-500/50 border-emerald-500'
                            : 'border-slate-300'
                        }`}>
                          {selectedStatuses.size === ORDER_STATUSES.length && (
                            <Check size={14} className="text-white" />
                          )}
                          {selectedStatuses.size > 0 && selectedStatuses.size < ORDER_STATUSES.length && (
                            <div className="w-2 h-0.5 bg-white rounded" />
                          )}
                        </div>
                        <span className="font-medium text-slate-700">Select All</span>
                      </button>

                      {/* Status Options */}
                      <div className="max-h-64 overflow-y-auto">
                        {ORDER_STATUSES.map((status) => {
                          const isSelected = selectedStatuses.has(status);
                          const config = ORDER_STATUS_CONFIG[status];
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => toggleStatus(status)}
                              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={14} className="text-white" />}
                              </div>
                              <span className="text-slate-700">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Date To */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Search */}
            <div className="flex-[2] min-w-[250px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Search
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Order # or customer email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          <AnimatePresence>
            {(selectedStatuses.size > 0 || dateFrom || dateTo || searchTerm) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200"
              >
                <span className="text-sm text-slate-500">Active filters:</span>
                {selectedStatuses.size > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    {selectedStatuses.size} {selectedStatuses.size === 1 ? 'status' : 'statuses'}
                  </span>
                )}
                {dateFrom && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    From: {dateFrom}
                    <button
                      onClick={() => setDateFrom('')}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    To: {dateTo}
                    <button
                      onClick={() => setDateTo('')}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSearchInput('');
                      }}
                      className="hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        <AnimatePresence>
          {selectedOrders.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg border border-emerald-400/60 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Selection Count */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold">{selectedOrders.size}</span>
                    </div>
                    <span className="text-white font-medium">
                      {selectedOrders.size} {selectedOrders.size === 1 ? 'order' : 'orders'} selected
                    </span>
                  </div>

                  <div className="h-8 w-px bg-white/30"></div>

                  {/* Change Status - Primary Action */}
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                      className="bg-white border-2 border-white/30 rounded-xl px-4 py-2 text-slate-800 font-medium focus:outline-none focus:border-white transition-all"
                    >
                      <option value="">Change Status...</option>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_CONFIG[status].label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkStatusChange}
                      disabled={!bulkStatus || bulkLoading}
                      className="px-4 py-2 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="h-8 w-px bg-white/30"></div>

                  {/* Other Bulk Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handlePrintSelected}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Print packing lists"
                    >
                      <Printer size={18} />
                      <span className="hidden sm:inline">Packing Lists</span>
                    </button>
                    <button
                      onClick={handleBulkPrintInvoices}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Print invoices (coming soon)"
                    >
                      <FileText size={18} />
                      <span className="hidden sm:inline">Invoices</span>
                    </button>
                    <button
                      onClick={handleBulkEmailInvoices}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Email selected customers"
                    >
                      <Mail size={18} />
                      <span className="hidden sm:inline">Email</span>
                    </button>
                    <button
                      onClick={handleBulkArchive}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors font-medium border border-white/30"
                      title="Archive orders (coming soon)"
                    >
                      <Trash2 size={18} />
                      <span className="hidden sm:inline">Archive</span>
                    </button>
                  </div>

                  {/* Clear Selection */}
                  <button
                    onClick={clearSelection}
                    className="ml-auto p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors border border-white/30"
                    title="Clear selection"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {selectedStatuses.size === 0 ? (
                <p>Please select at least one status to view orders.</p>
              ) : hasActiveFilters ? (
                <>
                  <p>No orders match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Reset filters
                  </button>
                </>
              ) : (
                <p>No orders to fulfill.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedOrders.size === orders.length && orders.length > 0
                            ? 'bg-emerald-500 border-emerald-500'
                            : selectedOrders.size > 0
                            ? 'bg-emerald-500/50 border-emerald-500'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {selectedOrders.size === orders.length && orders.length > 0 && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {selectedOrders.size > 0 && selectedOrders.size < orders.length && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Order #
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Date
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Customer
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Email
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Items
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Total
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedOrders.has(order.id) ? 'bg-emerald-50' : ''
                      }`}
                      onClick={() => handleRowClick(order.id)}
                    >
                      <td className="px-2 py-4 text-center">
                        <button
                          onClick={(e) => toggleOrderSelection(order.id, e)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedOrders.has(order.id)
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {selectedOrders.has(order.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-slate-800 font-medium">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 text-slate-800">
                        {order.customer_name || (
                          <span className="text-slate-400 italic">Guest</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {order.customer_email}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600">
                        {getOrderSeedlingTotal(order.items || [])}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-800 font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && orders.length > 0 && <Pagination />}
        </div>

        {/* Confirmation Dialog */}
        <AnimatePresence>
          {showBulkConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !bulkLoading && setShowBulkConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Confirm Bulk Action
                </h3>
                <p className="text-slate-600 mb-6">
                  {bulkActionType === 'status' && bulkStatus && (
                    <>
                      Are you sure you want to change the status of{' '}
                      <strong>{selectedOrders.size}</strong> {selectedOrders.size === 1 ? 'order' : 'orders'} to{' '}
                      <strong>{ORDER_STATUS_CONFIG[bulkStatus as OrderStatus].label}</strong>?
                    </>
                  )}
                  {bulkActionType === 'archive' && (
                    <>
                      Are you sure you want to archive{' '}
                      <strong>{selectedOrders.size}</strong> {selectedOrders.size === 1 ? 'order' : 'orders'}?
                    </>
                  )}
                </p>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => setShowBulkConfirm(false)}
                    disabled={bulkLoading}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeBulkAction}
                    disabled={bulkLoading}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {bulkLoading ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Email Compose Modal */}
        <AnimatePresence>
          {showEmailCompose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !emailSending && setShowEmailCompose(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Compose Email</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Sending to {(() => {
                        const recipientCount = orders.filter(o => selectedOrders.has(o.id) && o.customer_email).length;
                        return `${recipientCount} ${recipientCount === 1 ? 'recipient' : 'recipients'}`;
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={() => !emailSending && setShowEmailCompose(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    disabled={emailSending}
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  {/* Recipients preview */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-24 overflow-y-auto">
                      {orders.filter(o => selectedOrders.has(o.id) && o.customer_email).map(o => (
                        <span key={o.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                          {o.customer_name || o.customer_email}
                        </span>
                      ))}
                      {orders.filter(o => selectedOrders.has(o.id) && !o.customer_email).length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                          <AlertCircle size={12} />
                          {orders.filter(o => selectedOrders.has(o.id) && !o.customer_email).length} without email
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Template selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template (optional)</label>
                    <select
                      value={selectedTemplateKey}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
                      disabled={emailSending}
                    >
                      <option value="">Write custom email...</option>
                      {emailTemplates.filter(t => t.is_active).map(t => (
                        <option key={t.template_key} value={t.template_key}>
                          {t.name} {t.category ? `(${t.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter email subject..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
                      disabled={emailSending}
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your message..."
                      rows={10}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors resize-y font-sans leading-relaxed"
                      disabled={emailSending}
                    />
                  </div>

                  {/* Results */}
                  {emailResults && (
                    <div className={`p-4 rounded-xl border ${emailResults.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {emailResults.failed > 0 ? (
                          <AlertCircle size={18} className="text-amber-600" />
                        ) : (
                          <CheckCircle size={18} className="text-emerald-600" />
                        )}
                        <span className="font-semibold text-slate-800">
                          {emailResults.sent} sent{emailResults.failed > 0 ? `, ${emailResults.failed} failed` : ''}
                        </span>
                      </div>
                      {emailResults.errors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {emailResults.errors.map((err, i) => (
                            <li key={i} className="text-xs text-red-600">{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 justify-end p-6 border-t border-slate-200">
                  <button
                    onClick={() => setShowEmailCompose(false)}
                    disabled={emailSending}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                  >
                    {emailResults ? 'Close' : 'Cancel'}
                  </button>
                  {!emailResults && (
                    <button
                      onClick={handleSendBulkEmail}
                      disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                      className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {emailSending ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Send Email
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  );
};

export default FulfillmentPage;
