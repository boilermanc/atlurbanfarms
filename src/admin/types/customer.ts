// Customer Types for Admin Panel

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export type GrowingEnvironment = 'indoor' | 'outdoor' | 'both' | 'none';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type GrowingSystem = 'soil' | 'hydroponic' | 'aquaponic' | 'aeroponic' | 'container';
export type GrowingInterest = 'microgreens' | 'herbs' | 'vegetables' | 'flowers' | 'mushrooms';

export interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
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
  environment: GrowingEnvironment | null;
  experience_level: ExperienceLevel | null;
  growing_systems: GrowingSystem[] | null;
  interests: GrowingInterest[] | null;
  hardiness_zone: string | null;
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
