// Purchase Order Types for Admin Panel

export type POStatus = 'pending_verification' | 'verified' | 'invoiced' | 'paid' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  order_number: string;
  po_number: string;
  po_status: POStatus;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_id: string | null;
  guest_email: string | null;
  subtotal: number;
  tax: number;
  shipping_cost: number;
  total: number;
  discount_amount: number;
  created_at: string;
  po_verified_at: string | null;
  po_verified_by: string | null;
  po_invoiced_at: string | null;
  po_paid_at: string | null;
  // Joined customer data
  customers?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
  } | null;
}

export const PO_STATUS_CONFIG: Record<POStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pending_verification: {
    label: 'Pending Verification',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
  },
  verified: {
    label: 'Verified',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  invoiced: {
    label: 'Invoiced',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  paid: {
    label: 'Paid',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
};

export const PO_STATUSES = Object.keys(PO_STATUS_CONFIG) as POStatus[];
