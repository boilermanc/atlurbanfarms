export const ORDER_STATUSES = [
  'pending_payment',
  'processing',
  'shipped',
  'on_hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string }
> = {
  pending_payment: { label: 'Pending Payment', color: 'bg-amber-500' },
  processing: { label: 'Processing', color: 'bg-blue-500' },
  shipped: { label: 'Shipped', color: 'bg-indigo-500' },
  on_hold: { label: 'On Hold', color: 'bg-purple-500' },
  completed: { label: 'Completed', color: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
  refunded: { label: 'Refunded', color: 'bg-rose-600' },
  failed: { label: 'Failed', color: 'bg-slate-600' },
};

export const getOrderStatusLabel = (status: string | null | undefined) => {
  if (!status) return 'Unknown';
  const key = status as OrderStatus;
  return ORDER_STATUS_CONFIG[key]?.label || status.replace(/_/g, ' ');
};
