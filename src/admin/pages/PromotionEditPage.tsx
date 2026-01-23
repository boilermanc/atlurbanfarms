import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { usePromotion, useSavePromotion, usePromotionStats } from '../hooks/usePromotions';
import { supabase } from '../../lib/supabase';
import {
  PromotionFormData,
  DEFAULT_PROMOTION_FORM,
  DISCOUNT_TYPE_OPTIONS,
  SCOPE_OPTIONS,
  ACTIVATION_TYPE_OPTIONS,
  generateCouponCode,
  DiscountType,
  PromotionScope,
  ActivationType,
} from '../types/promotions';
import {
  ArrowLeft,
  Save,
  Percent,
  DollarSign,
  Tag,
  Calendar,
  Users,
  Megaphone,
  Settings,
  Sparkles,
  X,
  Plus,
  Search,
  Package,
  FolderTree,
} from 'lucide-react';

interface PromotionEditPageProps {
  promotionId: string | null;
  onBack: () => void;
  onSave: () => void;
}

interface ProductOption {
  id: string;
  name: string;
  category_name?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

const PromotionEditPage: React.FC<PromotionEditPageProps> = ({
  promotionId,
  onBack,
  onSave,
}) => {
  const isEditMode = Boolean(promotionId);
  const { promotion, loading: loadingPromotion } = usePromotion(promotionId);
  const { savePromotion, loading: saving, error: saveError } = useSavePromotion();
  const { stats } = usePromotionStats(promotionId);

  const [formData, setFormData] = useState<PromotionFormData>(DEFAULT_PROMOTION_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // Fetch products and categories for selectors
  useEffect(() => {
    const fetchData = async () => {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, product_categories(name)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('product_categories').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (productsRes.data) {
        setProducts(
          productsRes.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            category_name: p.product_categories?.name,
          }))
        );
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
    };
    fetchData();
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name,
        code: promotion.code || '',
        description: promotion.description || '',
        internal_notes: promotion.internal_notes || '',
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value?.toString() || '',
        buy_quantity: promotion.buy_quantity?.toString() || '',
        get_quantity: promotion.get_quantity?.toString() || '',
        get_discount_percent: promotion.get_discount_percent?.toString() || '100',
        scope: promotion.scope,
        minimum_order_amount: promotion.minimum_order_amount?.toString() || '',
        minimum_quantity: promotion.minimum_quantity?.toString() || '',
        maximum_discount_amount: promotion.maximum_discount_amount?.toString() || '',
        usage_limit_total: promotion.usage_limit_total?.toString() || '',
        usage_limit_per_customer: promotion.usage_limit_per_customer?.toString() || '1',
        stackable: promotion.stackable,
        priority: promotion.priority.toString(),
        activation_type: promotion.activation_type,
        starts_at: promotion.starts_at.slice(0, 16),
        ends_at: promotion.ends_at?.slice(0, 16) || '',
        banner_text: promotion.banner_text || '',
        banner_bg_color: promotion.banner_bg_color,
        banner_text_color: promotion.banner_text_color,
        badge_text: promotion.badge_text,
        show_on_homepage: promotion.show_on_homepage,
        is_active: promotion.is_active,
        product_ids: promotion.products?.map((p) => p.id) || [],
        category_ids: promotion.categories?.map((c) => c.id) || [],
        customer_ids: promotion.customers?.filter((c) => c.id).map((c) => c.id!) || [],
        customer_emails: promotion.customers?.filter((c) => !c.id && c.email).map((c) => c.email) || [],
      });
    }
  }, [promotion]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleGenerateCode = () => {
    const code = generateCouponCode(8);
    setFormData((prev) => ({ ...prev, code }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.activation_type !== 'automatic' && !formData.code.trim()) {
      newErrors.code = 'Coupon code is required for code-based promotions';
    }

    if (
      formData.discount_type !== 'free_shipping' &&
      formData.discount_type !== 'buy_x_get_y' &&
      !formData.discount_value
    ) {
      newErrors.discount_value = 'Discount value is required';
    }

    if (formData.discount_type === 'percentage') {
      const value = parseFloat(formData.discount_value);
      if (value <= 0 || value > 100) {
        newErrors.discount_value = 'Percentage must be between 1 and 100';
      }
    }

    if (formData.discount_type === 'buy_x_get_y') {
      if (!formData.buy_quantity || parseInt(formData.buy_quantity) < 1) {
        newErrors.buy_quantity = 'Buy quantity is required';
      }
      if (!formData.get_quantity || parseInt(formData.get_quantity) < 1) {
        newErrors.get_quantity = 'Get quantity is required';
      }
    }

    if (formData.scope === 'category' && formData.category_ids.length === 0) {
      newErrors.categories = 'Select at least one category';
    }

    if (formData.scope === 'product' && formData.product_ids.length === 0) {
      newErrors.products = 'Select at least one product';
    }

    if (!formData.starts_at) {
      newErrors.starts_at = 'Start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await savePromotion(formData, promotionId || undefined);
    if (result.success) {
      onSave();
    }
  };

  const addProduct = (productId: string) => {
    if (!formData.product_ids.includes(productId)) {
      setFormData((prev) => ({
        ...prev,
        product_ids: [...prev.product_ids, productId],
      }));
    }
    setShowProductSelector(false);
    setProductSearch('');
  };

  const removeProduct = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      product_ids: prev.product_ids.filter((id) => id !== productId),
    }));
  };

  const addCategory = (categoryId: string) => {
    if (!formData.category_ids.includes(categoryId)) {
      setFormData((prev) => ({
        ...prev,
        category_ids: [...prev.category_ids, categoryId],
      }));
    }
    setShowCategorySelector(false);
  };

  const removeCategory = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      category_ids: prev.category_ids.filter((id) => id !== categoryId),
    }));
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !formData.product_ids.includes(p.id)
  );

  const selectedProducts = products.filter((p) => formData.product_ids.includes(p.id));
  const selectedCategories = categories.filter((c) => formData.category_ids.includes(c.id));

  if (isEditMode && loadingPromotion) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 font-admin-display">
                {isEditMode ? 'Edit Promotion' : 'Create Promotion'}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {isEditMode ? 'Update promotion details' : 'Set up a new promotion or coupon'}
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isEditMode ? 'Save Changes' : 'Create Promotion'}
          </button>
        </div>

        {/* Error Banner */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            {saveError}
          </div>
        )}

        {/* Stats (Edit Mode Only) */}
        {isEditMode && stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Total Uses</p>
              <p className="text-2xl font-bold text-slate-800">{stats.usageCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Discount Given</p>
              <p className="text-2xl font-bold text-emerald-600">
                ${stats.totalDiscountGiven.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Unique Customers</p>
              <p className="text-2xl font-bold text-slate-800">{stats.uniqueCustomers}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Avg. Discount</p>
              <p className="text-2xl font-bold text-slate-800">
                ${stats.averageDiscount.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Tag size={20} className="text-emerald-500" />
            Basic Information
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Promotion Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Spring Herb Sale"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                  errors.name ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Coupon Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="e.g., SPRING20"
                  className={`flex-1 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase ${
                    errors.code ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                  title="Generate random code"
                >
                  <Sparkles size={18} />
                </button>
              </div>
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (customer-facing)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Describe this promotion to customers..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <label className="text-sm font-medium text-slate-700">Active</label>
          </div>
        </div>

        {/* Discount Settings */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Percent size={20} className="text-emerald-500" />
            Discount Settings
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount Type *
              </label>
              <select
                name="discount_type"
                value={formData.discount_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.discount_type !== 'free_shipping' &&
              formData.discount_type !== 'buy_x_get_y' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.discount_type === 'percentage' ? 'Percentage' : 'Amount'} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.discount_type === 'percentage' ? '%' : '$'}
                    </span>
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
                      step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? '100' : undefined}
                      className={`w-full pl-8 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                        errors.discount_value ? 'border-red-300' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  {errors.discount_value && (
                    <p className="text-red-500 text-xs mt-1">{errors.discount_value}</p>
                  )}
                </div>
              )}
          </div>

          {/* Buy X Get Y fields */}
          {formData.discount_type === 'buy_x_get_y' && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Buy Quantity *
                </label>
                <input
                  type="number"
                  name="buy_quantity"
                  value={formData.buy_quantity}
                  onChange={handleChange}
                  placeholder="3"
                  min="1"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    errors.buy_quantity ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.buy_quantity && (
                  <p className="text-red-500 text-xs mt-1">{errors.buy_quantity}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Get Quantity *
                </label>
                <input
                  type="number"
                  name="get_quantity"
                  value={formData.get_quantity}
                  onChange={handleChange}
                  placeholder="1"
                  min="1"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                    errors.get_quantity ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.get_quantity && (
                  <p className="text-red-500 text-xs mt-1">{errors.get_quantity}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  At % Off
                </label>
                <input
                  type="number"
                  name="get_discount_percent"
                  value={formData.get_discount_percent}
                  onChange={handleChange}
                  placeholder="100"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">100 = free</p>
              </div>
            </div>
          )}

          {/* Max discount cap (for percentage) */}
          {formData.discount_type === 'percentage' && (
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Maximum Discount (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  name="maximum_discount_amount"
                  value={formData.maximum_discount_amount}
                  onChange={handleChange}
                  placeholder="50.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Cap the discount at this amount</p>
            </div>
          )}
        </div>

        {/* Scope & Targeting */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Package size={20} className="text-emerald-500" />
            Scope & Targeting
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              What does this promotion apply to?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SCOPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${
                    formData.scope === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={opt.value}
                    checked={formData.scope === opt.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span
                    className={`text-sm font-medium ${
                      formData.scope === opt.value ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Selector */}
          {formData.scope === 'category' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Categories *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCategories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium"
                  >
                    <FolderTree size={14} />
                    {cat.name}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat.id)}
                      className="ml-1 hover:text-emerald-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategorySelector(!showCategorySelector)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Plus size={16} />
                  Add Category
                </button>
                {showCategorySelector && (
                  <div className="absolute z-10 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 max-h-64 overflow-y-auto">
                    {categories
                      .filter((c) => !formData.category_ids.includes(c.id))
                      .map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => addCategory(cat.id)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 text-sm"
                        >
                          {cat.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {errors.categories && (
                <p className="text-red-500 text-xs mt-1">{errors.categories}</p>
              )}
            </div>
          )}

          {/* Product Selector */}
          {formData.scope === 'product' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Products *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedProducts.map((prod) => (
                  <span
                    key={prod.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium"
                  >
                    <Package size={14} />
                    {prod.name}
                    <button
                      type="button"
                      onClick={() => removeProduct(prod.id)}
                      className="ml-1 hover:text-purple-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProductSelector(!showProductSelector)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Plus size={16} />
                  Add Product
                </button>
                {showProductSelector && (
                  <div className="absolute z-10 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-2">
                    <div className="px-3 pb-2">
                      <div className="relative">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Search products..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredProducts.slice(0, 20).map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addProduct(prod.id)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 text-sm"
                        >
                          <span className="font-medium">{prod.name}</span>
                          {prod.category_name && (
                            <span className="text-slate-400 ml-2">({prod.category_name})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.products && <p className="text-red-500 text-xs mt-1">{errors.products}</p>}
            </div>
          )}
        </div>

        {/* Activation & Conditions */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Settings size={20} className="text-emerald-500" />
            Activation & Conditions
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              How is this promotion activated?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ACTIVATION_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${
                    formData.activation_type === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="activation_type"
                    value={opt.value}
                    checked={formData.activation_type === opt.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span
                    className={`text-sm font-medium ${
                      formData.activation_type === opt.value ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Order Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  name="minimum_order_amount"
                  value={formData.minimum_order_amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Quantity
              </label>
              <input
                type="number"
                name="minimum_quantity"
                value={formData.minimum_quantity}
                onChange={handleChange}
                placeholder="1"
                min="1"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Usage Limits */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Users size={20} className="text-emerald-500" />
            Usage Limits
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Total Uses Allowed
              </label>
              <input
                type="number"
                name="usage_limit_total"
                value={formData.usage_limit_total}
                onChange={handleChange}
                placeholder="Unlimited"
                min="1"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">Leave empty for unlimited</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Uses Per Customer
              </label>
              <input
                type="number"
                name="usage_limit_per_customer"
                value={formData.usage_limit_per_customer}
                onChange={handleChange}
                placeholder="1"
                min="1"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">Leave empty for unlimited</p>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Calendar size={20} className="text-emerald-500" />
            Schedule
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                name="starts_at"
                value={formData.starts_at}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                  errors.starts_at ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {errors.starts_at && <p className="text-red-500 text-xs mt-1">{errors.starts_at}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                name="ends_at"
                value={formData.ends_at}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">Leave empty for no end date</p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            <Megaphone size={20} className="text-emerald-500" />
            Display Settings
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="show_on_homepage"
              checked={formData.show_on_homepage}
              onChange={handleChange}
              className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <label className="text-sm font-medium text-slate-700">
              Show promotional banner on homepage
            </label>
          </div>

          {formData.show_on_homepage && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Banner Text
                </label>
                <input
                  type="text"
                  name="banner_text"
                  value={formData.banner_text}
                  onChange={handleChange}
                  placeholder="e.g., Spring Sale - 20% Off All Herbs!"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Banner Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="banner_bg_color"
                      value={formData.banner_bg_color}
                      onChange={handleChange}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.banner_bg_color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, banner_bg_color: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Banner Text Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="banner_text_color"
                      value={formData.banner_text_color}
                      onChange={handleChange}
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.banner_text_color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, banner_text_color: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Banner Preview */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preview</label>
                <div
                  className="py-3 px-4 rounded-xl text-center font-medium"
                  style={{
                    backgroundColor: formData.banner_bg_color,
                    color: formData.banner_text_color,
                  }}
                >
                  {formData.banner_text || 'Banner text preview'}
                  {formData.code && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-sm font-mono">
                      {formData.code}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Badge Text
            </label>
            <input
              type="text"
              name="badge_text"
              value={formData.badge_text}
              onChange={handleChange}
              placeholder="SALE"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1">Text shown on product cards</p>
          </div>
        </div>

        {/* Internal Notes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
            Internal Notes
          </div>
          <textarea
            name="internal_notes"
            value={formData.internal_notes}
            onChange={handleChange}
            rows={3}
            placeholder="Notes for internal use only (not shown to customers)..."
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Submit Button (bottom) */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isEditMode ? 'Save Changes' : 'Create Promotion'}
          </button>
        </div>
      </form>
    </AdminPageWrapper>
  );
};

export default PromotionEditPage;
