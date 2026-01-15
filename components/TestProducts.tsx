import React from 'react';
import { useProducts, useCategories } from '../src/hooks/useSupabase';

const TestProducts: React.FC = () => {
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();

  const loading = productsLoading || categoriesLoading;
  const error = productsError || categoriesError;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800">Loading...</h1>
          <p className="text-gray-500">Fetching data from Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-red-50 rounded-2xl border border-red-200 max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Connection Error</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-emerald-600 text-white p-6 rounded-2xl mb-8">
          <h1 className="text-3xl font-bold">✅ Supabase Connection Test</h1>
          <p className="text-emerald-100 mt-2">Successfully connected to your database!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Categories Section */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Categories ({categories.length})
            </h2>
            {categories.length === 0 ? (
              <p className="text-gray-500">No categories found</p>
            ) : (
              <ul className="space-y-2">
                {categories.map((category: any) => (
                  <li
                    key={category.id}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg"
                  >
                    {category.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Products Section */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Products ({products.length})
            </h2>
            {products.length === 0 ? (
              <p className="text-gray-500">No products found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-left">
                      <th className="pb-3 font-semibold text-gray-600">Name</th>
                      <th className="pb-3 font-semibold text-gray-600">Price</th>
                      <th className="pb-3 font-semibold text-gray-600">Category</th>
                      <th className="pb-3 font-semibold text-gray-600">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product: any) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-800">{product.name}</td>
                        <td className="py-3 text-emerald-600 font-semibold">
                          ${product.price?.toFixed(2) ?? 'N/A'}
                        </td>
                        <td className="py-3 text-gray-500">
                          {product.category?.name ?? 'Uncategorized'}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            (product.quantity_available ?? 0) > 10
                              ? 'bg-green-100 text-green-700'
                              : (product.quantity_available ?? 0) > 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {product.quantity_available ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Remove TestProducts from App.tsx when done testing
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestProducts;
