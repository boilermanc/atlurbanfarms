// Customer Types for Admin Panel

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export type GrowingEnvironment = 'indoor' | 'outdoor' | 'both' | 'none';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type GrowingSystem = 'soil' | 'hydroponic' | 'aquaponic' | 'aeroponic' | 'container';
export type GrowingInterest = 'microgreens' | 'herbs' | 'vegetables' | 'flowers' | 'mushrooms';

export type CustomerRole = 'customer' | 'admin';

export interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: CustomerRole;
  newsletter_subscribed: boolean;
  sms_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithStats extends Customer {
  order_count: number;
  total_spent: number;
}

export interface CustomerProfile {
  id: string;
  customer_id: string;
  growing_environment: GrowingEnvironment | null;
  experience_level: ExperienceLevel | null;
  growing_systems: GrowingSystem[] | null;
  growing_interests: GrowingInterest[] | null;
  usda_zone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerPreferences {
  id: string;
  customer_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  newsletter_subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  type: 'shipping' | 'billing';
  is_default: boolean;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: SubscriberStatus;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  item_count: number;
  created_at: string;
}

export interface CustomerAttribution {
  id: string;
  customer_id: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  landing_page: string | null;
  created_at: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red' | 'pink' | 'indigo' | 'slate' | 'teal' | 'cyan';
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTagAssignment {
  id: string;
  customer_id: string;
  tag_id: string;
  assigned_at: string;
  assigned_by: string | null;
  tag?: CustomerTag; // Joined tag data
}

export interface CustomerWithTags extends Customer {
  tags?: CustomerTag[]; // Joined tags
}

// Status badge configurations
export const SUBSCRIBER_STATUS_CONFIG: Record<SubscriberStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-500' },
  unsubscribed: { label: 'Unsubscribed', color: 'bg-slate-500' },
  bounced: { label: 'Bounced', color: 'bg-red-500' },
};

export const EXPERIENCE_LEVEL_CONFIG: Record<ExperienceLevel, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: 'bg-blue-500' },
  intermediate: { label: 'Intermediate', color: 'bg-emerald-500' },
  advanced: { label: 'Advanced', color: 'bg-purple-500' },
  expert: { label: 'Expert', color: 'bg-amber-500' },
};

export const ENVIRONMENT_OPTIONS: { value: GrowingEnvironment; label: string }[] = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'Not Growing Yet' },
];

export const GROWING_SYSTEM_OPTIONS: { value: GrowingSystem; label: string }[] = [
  { value: 'soil', label: 'Soil' },
  { value: 'hydroponic', label: 'Hydroponic' },
  { value: 'aquaponic', label: 'Aquaponic' },
  { value: 'aeroponic', label: 'Aeroponic' },
  { value: 'container', label: 'Container' },
];

export const INTEREST_OPTIONS: { value: GrowingInterest; label: string }[] = [
  { value: 'microgreens', label: 'Microgreens' },
  { value: 'herbs', label: 'Herbs' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'flowers', label: 'Flowers' },
  { value: 'mushrooms', label: 'Mushrooms' },
];

// Tag color configurations for badge display
export const TAG_COLOR_CONFIG: Record<CustomerTag['color'], { label: string; badgeClass: string }> = {
  emerald: { label: 'Emerald', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  blue: { label: 'Blue', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  purple: { label: 'Purple', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  amber: { label: 'Amber', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  red: { label: 'Red', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  pink: { label: 'Pink', badgeClass: 'bg-pink-100 text-pink-700 border-pink-200' },
  indigo: { label: 'Indigo', badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  slate: { label: 'Slate', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  teal: { label: 'Teal', badgeClass: 'bg-teal-100 text-teal-700 border-teal-200' },
  cyan: { label: 'Cyan', badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
};

// Customer role configurations
export const CUSTOMER_ROLE_CONFIG: Record<CustomerRole, { label: string; badgeClass: string }> = {
  customer: { label: 'Customer', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  admin: { label: 'Admin', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
};

// Newsletter subscriber badge config (for display purposes)
export const NEWSLETTER_SUBSCRIBER_BADGE = {
  label: 'Subscriber',
  badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
