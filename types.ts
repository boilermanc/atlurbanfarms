
export interface Product {
  id: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  price: number;
  image: string;
  category: string;
  stock: number;
  compareAtPrice?: number | null;
  productType?: string | null;
  externalUrl?: string | null;
  externalButtonText?: string | null;
  localPickup?: 'can_be_picked_up' | 'cannot_be_picked_up' | 'must_be_picked_up' | null;
  bundleItems?: Array<{ name: string; quantity: number }>;
  seedlingsPerUnit?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

