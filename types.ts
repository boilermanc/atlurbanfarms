
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
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

