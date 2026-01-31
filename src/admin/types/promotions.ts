// Promotion Types for Admin Panel and Storefront

// ============================================
// ENUMS & UNION TYPES
// ============================================

export type DiscountType = 'percentage' | 'fixed_amount' | 'fixed_price' | 'buy_x_get_y' | 'free_shipping';

export type PromotionScope = 'site_wide' | 'category' | 'product' | 'customer';

export type ActivationType = 'automatic' | 'code' | 'both';

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

// ============================================
// MAIN PROMOTION INTERFACE
// ============================================

export interface Promotion {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  internal_notes: string | null;

  // Discount Configuration
  discount_type: DiscountType;
  discount_value: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  get_discount_percent: number | null;

  // Scope
  scope: PromotionScope;

  // Conditions
  minimum_order_amount: number | null;
  minimum_quantity: number | null;
  maximum_discount_amount: number | null;

  // Usage Limits
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;

  // Stacking
  stackable: boolean;
  priority: number;

  // Activation
  activation_type: ActivationType;

  // Schedule
  starts_at: string;
  ends_at: string | null;

  // Display Settings
  banner_text: string | null;
  banner_bg_color: string;
  banner_text_color: string;
  badge_text: string;
  show_on_homepage: boolean;

  // Status
  is_active: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Relations (populated on fetch)
  products?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  customers?: Array<{ id: string | null; email: string; name: string | null }>;
}

// ============================================
// FORM DATA INTERFACE
// ============================================

export interface PromotionFormData {
  name: string;
  code: string;
  description: string;
  internal_notes: string;

  // Discount
  discount_type: DiscountType;
  discount_value: string;
  buy_quantity: string;
  get_quantity: string;
  get_discount_percent: string;

  // Scope
  scope: PromotionScope;

  // Conditions
  minimum_order_amount: string;
  minimum_quantity: string;
  maximum_discount_amount: string;

  // Usage
  usage_limit_total: string;
  usage_limit_per_customer: string;

  // Stacking
  stackable: boolean;
  priority: string;

  // Activation
  activation_type: ActivationType;

  // Schedule
  starts_at: string;
  ends_at: string;

  // Display
  banner_text: string;
  banner_bg_color: string;
  banner_text_color: string;
  badge_text: string;
  show_on_homepage: boolean;

  // Status
  is_active: boolean;

  // Related entities (IDs)
  product_ids: string[];
  category_ids: string[];
  customer_ids: string[];
  customer_emails: string[];
}

// ============================================
// USAGE TRACKING
// ============================================

export interface PromotionUsage {
  id: string;
  promotion_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_email: string | null;
  discount_amount: number;
  used_at: string;
  order?: {
    order_number: string;
  };
  customer?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

// ============================================
// CART DISCOUNT RESULT
// ============================================

export interface CartDiscountResult {
  valid: boolean;
  promotion_id?: string;
  promotion_name?: string;
  promotion_code?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  discount: number;
  eligible_total?: number;
  description?: string;
  free_shipping?: boolean;
  message?: string | null;
}

// ============================================
// PRODUCT PROMOTION (for display)
// ============================================

export interface ProductPromotion {
  promotion_id: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  badge_text: string;
  priority: number;
  ends_at: string | null;
}

// ============================================
// HOMEPAGE BANNER
// ============================================

export interface HomepageBanner {
  promotion_id: string;
  name: string;
  banner_text: string;
  banner_bg_color: string;
  banner_text_color: string;
  code: string | null;
  ends_at: string | null;
  priority: number;
}

// ============================================
// FILTER INTERFACE
// ============================================

export interface PromotionFilters {
  status?: 'all' | PromotionStatus;
  scope?: 'all' | PromotionScope;
  discountType?: 'all' | DiscountType;
  search?: string;
  page?: number;
  perPage?: number;
}

// ============================================
// CONFIG OBJECTS FOR UI
// ============================================

export const DISCOUNT_TYPE_CONFIG: Record<DiscountType, { label: string; color: string; description: string }> = {
  percentage: {
    label: 'Percentage Off',
    color: 'bg-blue-500',
    description: 'Discount by a percentage (e.g., 10% off)',
  },
  fixed_amount: {
    label: 'Fixed Amount Off',
    color: 'bg-green-500',
    description: 'Discount by a fixed dollar amount (e.g., $5 off)',
  },
  fixed_price: {
    label: 'Fixed Price',
    color: 'bg-purple-500',
    description: 'Set a specific price for items (e.g., all seedlings $1.50)',
  },
  buy_x_get_y: {
    label: 'Buy X Get Y',
    color: 'bg-orange-500',
    description: 'Buy a quantity, get additional items free or discounted',
  },
  free_shipping: {
    label: 'Free Shipping',
    color: 'bg-cyan-500',
    description: 'Waive shipping costs for qualifying orders',
  },
};

export const SCOPE_CONFIG: Record<PromotionScope, { label: string; color: string; description: string }> = {
  site_wide: {
    label: 'Site-wide',
    color: 'bg-emerald-500',
    description: 'Applies to all products in the store',
  },
  category: {
    label: 'Category',
    color: 'bg-blue-500',
    description: 'Applies to products in selected categories',
  },
  product: {
    label: 'Product',
    color: 'bg-purple-500',
    description: 'Applies to specific selected products',
  },
  customer: {
    label: 'Customer',
    color: 'bg-amber-500',
    description: 'Available only to specific customers',
  },
};

export const ACTIVATION_TYPE_CONFIG: Record<ActivationType, { label: string; color: string; description: string }> = {
  automatic: {
    label: 'Automatic',
    color: 'bg-emerald-500',
    description: 'Applies automatically when conditions are met',
  },
  code: {
    label: 'Coupon Code',
    color: 'bg-blue-500',
    description: 'Customer must enter a code at checkout',
  },
  both: {
    label: 'Both',
    color: 'bg-purple-500',
    description: 'Applies automatically and can be shared via code',
  },
};

export const PROMOTION_STATUS_CONFIG: Record<PromotionStatus, { label: string; color: string; borderColor: string }> = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-700',
    borderColor: 'border-blue-200',
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-700',
    borderColor: 'border-red-200',
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-slate-100 text-slate-600',
    borderColor: 'border-slate-200',
  },
};

// ============================================
// DROPDOWN OPTIONS
// ============================================

export const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'fixed_amount', label: 'Fixed Amount Off' },
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
  { value: 'free_shipping', label: 'Free Shipping' },
];

export const SCOPE_OPTIONS: Array<{ value: PromotionScope; label: string }> = [
  { value: 'site_wide', label: 'Site-wide' },
  { value: 'category', label: 'Category' },
  { value: 'product', label: 'Product' },
  { value: 'customer', label: 'Customer' },
];

export const ACTIVATION_TYPE_OPTIONS: Array<{ value: ActivationType; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'code', label: 'Coupon Code Only' },
  { value: 'both', label: 'Both (Auto + Code)' },
];

// ============================================
// DEFAULT FORM VALUES
// ============================================

export const DEFAULT_PROMOTION_FORM: PromotionFormData = {
  name: '',
  code: '',
  description: '',
  internal_notes: '',
  discount_type: 'percentage',
  discount_value: '',
  buy_quantity: '',
  get_quantity: '',
  get_discount_percent: '100',
  scope: 'site_wide',
  minimum_order_amount: '',
  minimum_quantity: '',
  maximum_discount_amount: '',
  usage_limit_total: '',
  usage_limit_per_customer: '1',
  stackable: false,
  priority: '0',
  activation_type: 'code',
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: '',
  banner_text: '',
  banner_bg_color: '#10b981',
  banner_text_color: '#ffffff',
  badge_text: 'SALE',
  show_on_homepage: false,
  is_active: true,
  product_ids: [],
  category_ids: [],
  customer_ids: [],
  customer_emails: [],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getPromotionStatus(promotion: Promotion): PromotionStatus {
  const now = new Date();
  const startsAt = new Date(promotion.starts_at);
  const endsAt = promotion.ends_at ? new Date(promotion.ends_at) : null;

  if (!promotion.is_active) {
    return 'inactive';
  }
  if (startsAt > now) {
    return 'scheduled';
  }
  if (endsAt && endsAt < now) {
    return 'expired';
  }
  return 'active';
}

export function formatDiscountValue(promotion: Promotion): string {
  switch (promotion.discount_type) {
    case 'percentage':
      return `${promotion.discount_value}% off`;
    case 'fixed_amount':
      return `$${promotion.discount_value} off`;
    case 'fixed_price':
      return `$${promotion.discount_value}`;
    case 'free_shipping':
      return 'Free shipping';
    case 'buy_x_get_y':
      return `Buy ${promotion.buy_quantity}, Get ${promotion.get_quantity}`;
    default:
      return '';
  }
}

export function formatDiscountBadge(promotion: Promotion): string {
  switch (promotion.discount_type) {
    case 'percentage':
      return `${promotion.discount_value}% OFF`;
    case 'fixed_amount':
      return `$${promotion.discount_value} OFF`;
    case 'fixed_price':
      return `$${promotion.discount_value}`;
    case 'free_shipping':
      return 'FREE SHIP';
    case 'buy_x_get_y':
      return `B${promotion.buy_quantity}G${promotion.get_quantity}`;
    default:
      return promotion.badge_text || 'SALE';
  }
}

export function calculateSalePrice(
  originalPrice: number,
  discountType: DiscountType,
  discountValue: number
): number {
  switch (discountType) {
    case 'percentage':
      return originalPrice * (1 - discountValue / 100);
    case 'fixed_amount':
      return Math.max(0, originalPrice - discountValue);
    case 'fixed_price':
      return discountValue;
    default:
      return originalPrice;
  }
}

export function generateCouponCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
