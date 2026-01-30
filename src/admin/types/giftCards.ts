// Gift Card Types for Admin Panel

// ============================================
// ENUMS & UNION TYPES
// ============================================

export type GiftCardStatus = 'active' | 'depleted' | 'disabled';

export type GiftCardTransactionType = 'purchase' | 'redemption' | 'refund' | 'adjustment';

// ============================================
// MAIN GIFT CARD INTERFACE
// ============================================

export interface GiftCard {
  id: string;
  code: string;

  // Balance
  initial_balance: number;
  current_balance: number;

  // Status
  status: GiftCardStatus;

  // Purchaser Info
  purchaser_email: string | null;
  purchaser_customer_id: string | null;

  // Recipient Info
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;

  // Dates
  purchased_at: string | null;
  expires_at: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Relations (populated on fetch)
  purchaser?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  transactions?: GiftCardTransaction[];
}

// ============================================
// TRANSACTION INTERFACE
// ============================================

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  order_id: string | null;
  amount: number;
  balance_after: number;
  type: GiftCardTransactionType;
  notes: string | null;
  created_at: string;
  created_by: string | null;

  // Relations (populated on fetch)
  order?: {
    order_number: string;
  };
  created_by_user?: {
    first_name: string | null;
    last_name: string | null;
  };
}

// ============================================
// FORM DATA INTERFACES
// ============================================

export interface GiftCardFormData {
  initial_balance: string;
  recipient_email: string;
  recipient_name: string;
  message: string;
  expires_at: string;
}

export interface GiftCardAdjustmentFormData {
  amount: string;
  type: 'add' | 'remove';
  notes: string;
}

// ============================================
// FILTER INTERFACE
// ============================================

export interface GiftCardFilters {
  status?: 'all' | GiftCardStatus;
  search?: string;
  page?: number;
  perPage?: number;
}

// ============================================
// CONFIG OBJECTS FOR UI
// ============================================

export const GIFT_CARD_STATUS_CONFIG: Record<GiftCardStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  active: {
    label: 'Active',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
    description: 'Gift card has available balance and can be redeemed',
  },
  depleted: {
    label: 'Depleted',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    description: 'Gift card balance has been fully used',
  },
  disabled: {
    label: 'Disabled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    description: 'Gift card has been manually disabled',
  },
};

export const GIFT_CARD_TRANSACTION_TYPE_CONFIG: Record<GiftCardTransactionType, {
  label: string;
  color: string;
  bgColor: string;
  icon: 'plus' | 'minus' | 'refresh' | 'edit';
}> = {
  purchase: {
    label: 'Purchase',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    icon: 'plus',
  },
  redemption: {
    label: 'Redemption',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'minus',
  },
  refund: {
    label: 'Refund',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: 'refresh',
  },
  adjustment: {
    label: 'Adjustment',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: 'edit',
  },
};

// ============================================
// DEFAULT FORM VALUES
// ============================================

export const DEFAULT_GIFT_CARD_FORM: GiftCardFormData = {
  initial_balance: '',
  recipient_email: '',
  recipient_name: '',
  message: '',
  expires_at: '',
};

export const DEFAULT_ADJUSTMENT_FORM: GiftCardAdjustmentFormData = {
  amount: '',
  type: 'add',
  notes: '',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatGiftCardCode(code: string): string {
  // Format code for display (e.g., "GIFT-XXXX-XXXX" stays the same)
  return code.toUpperCase();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function getGiftCardDisplayStatus(giftCard: GiftCard): GiftCardStatus {
  // Check if expired
  if (giftCard.expires_at) {
    const expiresAt = new Date(giftCard.expires_at);
    if (expiresAt < new Date() && giftCard.status === 'active') {
      return 'disabled'; // Treat expired as disabled for display
    }
  }
  return giftCard.status;
}

export function isGiftCardExpired(giftCard: GiftCard): boolean {
  if (!giftCard.expires_at) return false;
  return new Date(giftCard.expires_at) < new Date();
}

export function canRedeemGiftCard(giftCard: GiftCard): boolean {
  if (giftCard.status !== 'active') return false;
  if (giftCard.current_balance <= 0) return false;
  if (isGiftCardExpired(giftCard)) return false;
  return true;
}

export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `GIFT-${segment1}-${segment2}`;
}
