import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Upload, Trash2, Star, Plus, X } from 'lucide-react';
import { useProductTags } from '../hooks/useProductTags';
import { useProductTagAssignments } from '../hooks/useProductTagAssignments';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface ProductFormData {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category_id: string;
  price: string;
  compare_at_price: string;
  growing_instructions: string;
  days_to_maturity: string;
  sun_requirements: string;
  water_requirements: string;
  track_inventory: boolean;
  quantity_available: string;
  low_stock_threshold: string;
  is_active: boolean;
  is_featured: boolean;
}

interface ProductEditPageProps {
  productId?: string;
  onBack: () => void;
  onSave: () => void;
}

const SUN_OPTIONS = ['Full Sun', 'Partial Shade', 'Full Shade'];
const WATER_OPTIONS = ['Low', 'Medium', 'High'];

const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const ProductEditPage: React.FC<ProductEditPageProps> = ({ productId, onBack, onSave }) => {
  const isEditMode = Boolean(productId);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const { tags: allTags } = useProductTags();
  const { tags: assignedTags, assignTag, unassignTag } = useProductTagAssignments(productId);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    short_description: '',
    description: '',
    category_id: '',
    price: '',
    compare_at_price: '',
    growing_instructions: '',
    days_to_maturity: '',
    sun_requirements: '',
    water_requirements: '',
    track_inventory: true,
    quantity_available: '0',
    low_stock_threshold: '10',
    is_active: true,
    is_featured: false,
  });

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order');
    setCategories(data || []);
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('products')
        .select(`*, images:product_images(*)`)
        .eq('id', productId)
        .single();
      if (err) throw err;
      if (data) {
        setFormData({
          name: data.name || '',
          slug: data.slug || '',
          short_description: data.short_description || '',
          description: data.description || '',
          category_id: data.category_id || '',
          price: data.price?.toString() || '',
          compare_at_price: data.compare_at_price?.toString() || '',
          growing_instructions: data.growing_instructions || '',
          days_to_maturity: data.days_to_maturity?.toString() || '',
          sun_requirements: data.sun_requirements || '',
          water_requirements: data.water_requirements || '',
          track_inventory: data.track_inventory ?? true,
          quantity_available: data.quantity_available?.toString() || '0',
          low_stock_threshold: data.low_stock_threshold?.toString() || '10',
          is_active: data.is_active ?? true,
          is_featured: data.is_featured ?? false,
        });
        setImages(data.images?.sort((a: ProductImage, b: ProductImage) => a.sort_order - b.sort_order) || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchCategories();
    if (isEditMode) fetchProduct();
  }, [fetchCategories, fetchProduct, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setError(null);
    setInfoMessage(null);
    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name' && !isEditMode) {
        newData.slug = generateSlug(value);
      }
      return newData;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `product-images/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);

        if (productId) {
          const { data: imageData, error: insertError } = await supabase
            .from('product_images')
            .insert({
              product_id: productId,
              url: publicUrl,
              is_primary: images.length === 0,
              sort_order: images.length,
            })
            .select()
            .single();
          if (insertError) throw insertError;
          setImages(prev => [...prev, imageData]);
        } else {
          setImages(prev => [...prev, {
            id: `temp-${Date.now()}`,
            product_id: '',
            url: publicUrl,
            alt_text: null,
            is_primary: prev.length === 0,
            sort_order: prev.length,
          }]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    const updatedImages = images.map(img => ({ ...img, is_primary: img.id === imageId }));
    setImages(updatedImages);

    if (productId && !imageId.startsWith('temp-')) {
      await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId);
      await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    if (!imageId.startsWith('temp-') && productId) {
      await supabase.from('product_images').delete().eq('id', imageId);
    }

    const remaining = images.filter(img => img.id !== imageId);
    if (image.is_primary && remaining.length > 0) {
      remaining[0].is_primary = true;
      if (!remaining[0].id.startsWith('temp-') && productId) {
        await supabase.from('product_images').update({ is_primary: true }).eq('id', remaining[0].id);
      }
    }
    setImages(remaining);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      setError('Name and price are required');
      return;
    }

    setSaving(true);
    setError(null);
    setInfoMessage(null);

    try {
      const productData = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        short_description: formData.short_description || null,
        description: formData.description || null,
        category_id: formData.category_id || null,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        growing_instructions: formData.growing_instructions || null,
        days_to_maturity: formData.days_to_maturity ? parseInt(formData.days_to_maturity) : null,
        sun_requirements: formData.sun_requirements || null,
        water_requirements: formData.water_requirements || null,
        track_inventory: formData.track_inventory,
        quantity_available: parseInt(formData.quantity_available) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
      };

      if (isEditMode && productId) {
        const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId);
        if (updateError) throw updateError;
      } else {
        const { data: newProduct, error: insertError } = await supabase.from('products').insert(productData).select().single();
        if (insertError) throw insertError;

        if (images.length > 0) {
          const imageInserts = images.map((img, idx) => ({
            product_id: newProduct.id,
            url: img.url,
            is_primary: img.is_primary,
            sort_order: idx,
          }));
          await supabase.from('product_images').insert(imageInserts);
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    setDeleting(true);
    setError(null);
    setInfoMessage(null);
    try {
      // Check if product has order history
      const { data: orderItems, error: orderCheckError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (orderCheckError) throw orderCheckError;

      if (orderItems && orderItems.length > 0) {
        // Product has order history - archive instead of delete
        const { error: archiveError } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);

        if (archiveError) throw archiveError;

        setInfoMessage('This product has order history and cannot be deleted. It has been archived instead.');
        setDeleting(false);
        setDeleteModalOpen(false);

        // Refresh the product data to show updated status
        await fetchProduct();
      } else {
        // No order history - safe to delete
        await supabase.from('product_images').delete().eq('product_id', productId);
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) throw error;
        onSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-1 text-sm transition-colors">
              <ArrowLeft size={16} />
              Back to Products
            </button>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">{isEditMode ? 'Edit Product' : 'Add Product'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isEditMode && (
              <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">Delete</button>
            )}
            <button type="button" onClick={onBack} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}
        {infoMessage && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700">{infoMessage}</div>}

        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Basic Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Slug</label>
              <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Short Description</label>
              <input type="text" name="short_description" value={formData.short_description} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Full Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={12} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                <option value="">Select category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Price *</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} step="0.01" min="0" required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Sale Price</label>
                <input type="number" name="compare_at_price" value={formData.compare_at_price} onChange={handleChange} step="0.01" min="0" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Growing Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Growing Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Growing Instructions</label>
              <textarea name="growing_instructions" value={formData.growing_instructions} onChange={handleChange} rows={4} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Days to Maturity</label>
              <input type="number" name="days_to_maturity" value={formData.days_to_maturity} onChange={handleChange} min="0" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Sun Requirements</label>
              <select name="sun_requirements" value={formData.sun_requirements} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                <option value="">Select</option>
                {SUN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Water Requirements</label>
              <select name="water_requirements" value={formData.water_requirements} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                <option value="">Select</option>
                {WATER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Inventory</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="track_inventory" checked={formData.track_inventory} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50" />
              <span className="text-slate-700">Track inventory</span>
            </label>
            {formData.track_inventory && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Quantity Available</label>
                  <input type="number" name="quantity_available" value={formData.quantity_available} onChange={handleChange} min="0" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Low Stock Threshold</label>
                  <input type="number" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleChange} min="0" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Images</h2>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-emerald-500/50 transition-colors">
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" id="image-upload" disabled={uploading} />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={24} className="text-slate-400" />
                  )}
                </div>
                <p className="text-slate-700 font-medium">Click to upload or drag and drop</p>
                <p className="text-slate-400 text-sm mt-1">PNG, JPG up to 10MB</p>
              </label>
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((img) => (
                  <div key={img.id} className={`relative group rounded-xl overflow-hidden border-2 ${img.is_primary ? 'border-emerald-500' : 'border-transparent'}`}>
                    <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {!img.is_primary && (
                        <button type="button" onClick={() => handleSetPrimary(img.id)} className="p-2 bg-emerald-500 text-white rounded-lg text-xs flex items-center gap-1">
                          <Star size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDeleteImage(img.id)} className="p-2 bg-red-500 text-white rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {img.is_primary && <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded font-medium">Primary</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Status</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50" />
              <div>
                <span className="text-slate-800 font-medium">Active</span>
                <p className="text-slate-500 text-sm">Product is visible in the store</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="is_featured" checked={formData.is_featured} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50" />
              <div>
                <span className="text-slate-800 font-medium">Featured</span>
                <p className="text-slate-500 text-sm">Show in featured sections</p>
              </div>
            </label>
          </div>
        </div>

        {/* Tags */}
        {isEditMode && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Tags</h2>
              <button
                type="button"
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                Add Tag
              </button>
            </div>

            {/* Assigned Tags */}
            {assignedTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {assignedTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => unassignTag(tag.id)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-2">No tags assigned</p>
            )}

            {/* Tag Dropdown */}
            {showTagDropdown && (
              <div className="mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {allTags
                  .filter(tag => !assignedTags.find(at => at.id === tag.id))
                  .map(tag => (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={async () => {
                        await assignTag(tag.id);
                        setShowTagDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <span className="text-slate-800 text-sm font-medium">{tag.name}</span>
                      {tag.tag_type && (
                        <span className="ml-2 text-xs text-slate-400">({tag.tag_type})</span>
                      )}
                    </button>
                  ))}
                {allTags.filter(tag => !assignedTags.find(at => at.id === tag.id)).length === 0 && (
                  <p className="text-slate-500 text-sm p-2">All tags assigned</p>
                )}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Product</h3>
            <p className="text-slate-600 mb-2">Are you sure you want to delete this product?</p>
            <p className="text-slate-500 text-sm mb-6">
              Note: If this product has order history, it will be archived (set to inactive) instead of deleted to preserve order records.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModalOpen(false)} disabled={deleting} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2">
                {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default ProductEditPage;
