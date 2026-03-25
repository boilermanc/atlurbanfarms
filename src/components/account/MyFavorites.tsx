import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useFavorites } from '../../hooks/useSupabase';

interface MyFavoritesProps {
  userId: string;
  onNavigate: (view: string) => void;
}

interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  image_url: string | null;
}

const MyFavorites: React.FC<MyFavoritesProps> = ({ userId, onNavigate }) => {
  const { favorites, toggleFavorite } = useFavorites(userId);
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      if (!favorites || favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('id, name, slug, price, images:product_images(url)')
        .in('id', favorites);

      if (data) {
        setProducts(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image_url: p.images?.[0]?.url || null,
        })));
      }
      setLoading(false);
    }
    fetchProducts();
  }, [favorites]);

  const handleRemove = async (productId: string) => {
    await toggleFavorite(productId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
          My Favorites
        </h1>
        <p className="text-gray-500">
          Products you've saved for later.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="aspect-square bg-gray-100 rounded-xl mb-3" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all"
            >
              <button
                onClick={() => {
                  window.history.pushState({ view: 'shop', product: product.slug }, '', `/shop/${product.slug}`);
                  onNavigate('shop');
                }}
                className="w-full text-left"
              >
                {product.image_url ? (
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                  </h3>
                  {product.price != null && (
                    <p className="text-emerald-600 font-bold text-sm mt-1">
                      ${product.price.toFixed(2)}
                    </p>
                  )}
                </div>
              </button>
              <div className="px-3 pb-3">
                <button
                  onClick={() => handleRemove(product.id)}
                  className="w-full text-xs text-gray-400 hover:text-red-500 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">No Favorites Yet</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-4">
            Browse our shop and tap the heart icon on products you love to save them here.
          </p>
          <button
            onClick={() => onNavigate('shop')}
            className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Browse Shop
          </button>
        </div>
      )}
    </div>
  );
};

export default MyFavorites;
