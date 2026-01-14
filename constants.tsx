
import React from 'react';
import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Better Boy Tomato',
    description: 'High-yield hybrid tomato known for disease resistance and rich flavor.',
    price: 8.50,
    image: 'https://images.unsplash.com/photo-1592841608277-742074ed8d06?auto=format&fit=crop&q=80&w=600',
    category: 'Vegetables',
    stock: 45
  },
  {
    id: '2',
    name: 'Genovese Basil',
    description: 'The standard for authentic Italian pesto. Lush, aromatic leaves.',
    price: 6.00,
    image: 'https://images.unsplash.com/photo-1618376168161-66d81fc045c9?auto=format&fit=crop&q=80&w=600',
    category: 'Herbs',
    stock: 120
  },
  {
    id: '3',
    name: 'Carolina Reaper',
    description: 'For the daring gardener. One of the hottest peppers in the world.',
    price: 12.00,
    image: 'https://images.unsplash.com/photo-1588252303782-cb80119cb665?auto=format&fit=crop&q=80&w=600',
    category: 'Vegetables',
    stock: 15
  },
  {
    id: '4',
    name: 'French Lavender',
    description: 'Beautiful, fragrant lavender that attracts pollinators.',
    price: 9.50,
    image: 'https://images.unsplash.com/photo-1565011523534-747a8601f10a?auto=format&fit=crop&q=80&w=600',
    category: 'Flowers',
    stock: 30
  },
  {
    id: '5',
    name: 'Lacinato Kale',
    description: 'Tender, dark-blue green leaves. Excellent for smoothies.',
    price: 7.00,
    image: 'https://images.unsplash.com/photo-1524179524541-16d66cc0483f?auto=format&fit=crop&q=80&w=600',
    category: 'Vegetables',
    stock: 80
  },
  {
    id: '6',
    name: 'Lemon Thyme',
    description: 'Citrus-scented herb that works beautifully in Mediterranean dishes.',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1594313437152-e4e1169055e8?auto=format&fit=crop&q=80&w=600',
    category: 'Herbs',
    stock: 50
  },
  {
    id: '7',
    name: 'Buttercrunch Lettuce',
    description: 'Sweet, crisp heads that stay tender even in warmer weather.',
    price: 5.50,
    image: 'https://images.unsplash.com/photo-1622145828817-6f0a56bc93b8?auto=format&fit=crop&q=80&w=600',
    category: 'Vegetables',
    stock: 65
  },
  {
    id: '8',
    name: 'Peppermint Cluster',
    description: 'Fast-growing, refreshing mint. Perfect for teas and cocktails.',
    price: 6.00,
    image: 'https://images.unsplash.com/photo-1626081035415-46740698715a?auto=format&fit=crop&q=80&w=600',
    category: 'Herbs',
    stock: 90
  }
];

export const SHIPPING_NOTICE = "🚚 Live plants ship Mon-Wed only to ensure maximum freshness.";

export const SparkleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L14.5 9L21 11.5L14.5 14L12 21L9.5 14L3 11.5L9.5 9L12 3Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
