import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Upload, Trash2, Star, Plus, X, Link, Package, Layers, ShoppingBag, ChevronUp, ChevronDown } from 'lucide-react';
import { useProductTags } from '../hooks/useProductTags';
import { useProductTagAssignments } from '../hooks/useProductTagAssignments';
import RichTextEditor from '../components/RichTextEditor';

type ProductType = 'simple' | 'grouped' | 'external' | 'bundle';

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface SimpleProduct {
  id: string;
  name: string;
  price: number;
  quantity_available: number;
}

interface ProductRelationship {
  id?: string;
  child_product_id: string;
  quantity: number;
  sort_order: number;
  product?: SimpleProduct;
}

interface ProductFormData {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category_id: string; // Primary category for backwards compatibility
  category_ids: string[]; // All assigned categories
  price: string;
  compare_at_price: string;
  growing_instructions: string;
  days_to_maturity: string;
  yield_per_plant: string;
  harvest_type: string[];
  growing_season: string[];
  growing_location: string;
  track_inventory: boolean;
  quantity_available: string;
  low_stock_threshold: string;
  stock_status: 'in_stock' | 'out_of_stock';
  is_active: boolean;
  is_featured: boolean;
  product_type: ProductType;
  external_url: string;
  external_button_text: string;
  local_pickup: 'can_be_picked_up' | 'cannot_be_picked_up' | 'must_be_picked_up';
  seedlings_per_unit: string;
}

interface ProductEditPageProps {
  productId?: string;
  onBack: () => void;
  onSave: () => void;
}

const HARVEST_TYPE_OPTIONS = [
  { value: 'cut_and_come_again', label: 'Cut & Come Again' },
  { value: 'full_head', label: 'Full Head' },
];
const GROWING_SEASON_OPTIONS = [
  { value: 'year_round', label: 'Year-round' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];
const GROWING_LOCATION_OPTIONS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];
const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'simple', label: 'Simple', description: 'A standard product with its own inventory', icon: <Package size={14} /> },
  { value: 'grouped', label: 'Grouped', description: 'A collection of related products shown together', icon: <Layers size={14} /> },
  { value: 'external', label: 'External', description: 'Links to an external website for purchase', icon: <Link size={14} /> },
  { value: 'bundle', label: 'Bundle', description: 'A set of products sold together with quantities', icon: <ShoppingBag size={14} /> },
];

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
  const { tags: allTags } = useProductTags();
  const { tags: assignedTags, assignTag, unassignTag } = useProductTagAssignments(productId);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    short_description: '',
    description: '',
    category_id: '',
    category_ids: [],
    price: '',
    compare_at_price: '',
    growing_instructions: '',
    days_to_maturity: '',
    yield_per_plant: '',
    harvest_type: [],
    growing_season: [],
    growing_location: '',
    track_inventory: true,
    quantity_available: '0',
    low_stock_threshold: '10',
    stock_status: 'in_stock',
    is_active: true,
    is_featured: false,
    product_type: 'simple',
    external_url: '',
    external_button_text: 'Buy Now',
    local_pickup: 'can_be_picked_up',
    seedlings_per_unit: '1',
  });

  // State for product relationships (grouped/bundle)
  const [availableProducts, setAvailableProducts] = useState<SimpleProduct[]>([]);
  const [seedlingProductIds, setSeedlingProductIds] = useState<Set<string>>(new Set());
  const [relationships, setRelationships] = useState<ProductRelationship[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Auto-sync seedlings_per_unit from bundle relationships
  useEffect(() => {
    if (formData.product_type === 'bundle' && relationships.length > 0) {
      const totalSeedlings = relationships.reduce((sum, rel) => sum + rel.quantity, 0);
      setFormData(prev => ({
        ...prev,
        seedlings_per_unit: totalSeedlings.toString(),
      }));
    }
  }, [relationships, formData.product_type]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('product_categories').select('id, name, slug, parent_id').eq('is_active', true).order('sort_order');
    setCategories(data || []);
  }, []);

  const fetchAvailableProducts = useCallback(async () => {
    // Fetch all active products with their type
    let query = supabase
      .from('products')
      .select('id, name, price, quantity_available, product_type')
      .eq('is_active', true);

    // Exclude current product when editing
    if (productId) {
      query = query.neq('id', productId);
    }

    const { data } = await query.order('name');

    // Filter client-side to exclude bundle, grouped, and external products
    // This handles legacy products with null, empty string, or any other product_type values
    const eligibleProducts = (data || []).filter(p => {
      const type = p.product_type;
      // Include if: no type set (null/empty/undefined) OR type is 'simple' OR type is not one of the excluded types
      return !type || type === 'simple' || !['bundle', 'grouped', 'external'].includes(type);
    });

    setAvailableProducts(eligibleProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      quantity_available: p.quantity_available
    })));
  }, [productId]);

  const fetchSeedlingProductIds = useCallback(async () => {
    // Find the "Seedlings" parent category
    const { data: seedlingsCat } = await supabase
      .from('product_categories')
      .select('id')
      .ilike('name', 'Seedlings')
      .is('parent_id', null)
      .limit(1)
      .maybeSingle();

    if (!seedlingsCat) {
      setSeedlingProductIds(new Set());
      return;
    }

    // Get all subcategories under Seedlings
    const { data: subCats } = await supabase
      .from('product_categories')
      .select('id')
      .eq('parent_id', seedlingsCat.id);

    const categoryIds = [seedlingsCat.id, ...(subCats || []).map(c => c.id)];

    // Get all product IDs assigned to seedling categories
    const { data: assignments } = await supabase
      .from('product_category_assignments')
      .select('product_id')
      .in('category_id', categoryIds);

    setSeedlingProductIds(new Set((assignments || []).map(a => a.product_id)));
  }, []);

  const fetchRelationships = useCallback(async () => {
    if (!productId) return;
    const { data } = await supabase
      .from('product_relationships')
      .select(`
        id,
        child_product_id,
        quantity,
        sort_order,
        product:products!child_product_id(id, name, price, quantity_available)
      `)
      .eq('parent_product_id', productId)
      .order('sort_order');

    if (data) {
      setRelationships(data.map((r: any) => ({
        id: r.id,
        child_product_id: r.child_product_id,
        quantity: r.quantity,
        sort_order: r.sort_order,
        product: r.product,
      })));
    }
  }, [productId]);

  const fetchCategoryAssignments = useCallback(async () => {
    if (!productId) return;
    const { data } = await supabase
      .from('product_category_assignments')
      .select('category_id')
      .eq('product_id', productId);

    if (data) {
      setFormData(prev => ({
        ...prev,
        category_ids: data.map(d => d.category_id),
      }));
    }
  }, [productId]);

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
        setFormData(prev => ({
          ...prev,
          name: data.name || '',
          slug: data.slug || '',
          short_description: data.short_description || '',
          description: data.description || '',
          category_id: data.category_id || '',
          // category_ids is managed by fetchCategoryAssignments — don't overwrite here
          price: data.price?.toString() || '',
          compare_at_price: data.compare_at_price?.toString() || '',
          growing_instructions: data.growing_instructions || '',
          days_to_maturity: data.days_to_maturity?.toString() || '',
          yield_per_plant: data.yield_per_plant?.toString() || '',
          harvest_type: data.harvest_type || [],
          growing_season: data.growing_season || [],
          growing_location: data.growing_location || '',
          track_inventory: data.track_inventory ?? true,
          quantity_available: data.quantity_available?.toString() || '0',
          low_stock_threshold: data.low_stock_threshold?.toString() || '10',
          stock_status: data.stock_status || 'in_stock',
          is_active: data.is_active ?? true,
          is_featured: data.featured ?? false,
          product_type: data.product_type || 'simple',
          external_url: data.external_url || '',
          external_button_text: data.external_button_text || 'Buy Now',
          local_pickup: data.local_pickup || 'can_be_picked_up',
          seedlings_per_unit: data.seedlings_per_unit?.toString() || '1',
        }));
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
    fetchAvailableProducts();
    fetchSeedlingProductIds();
    if (isEditMode) {
      fetchProduct();
      fetchRelationships();
      fetchCategoryAssignments();
    }
  }, [fetchCategories, fetchAvailableProducts, fetchSeedlingProductIds, fetchProduct, fetchRelationships, fetchCategoryAssignments, isEditMode]);

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
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

      for (const file of Array.from(files)) {
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type for "${file.name}". Please upload JPG, PNG, GIF, or WebP images.`);
        }

        // Validate file extension
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!allowedExtensions.includes(ext)) {
          throw new Error(`Invalid file extension for "${file.name}". Please upload JPG, PNG, GIF, or WebP images.`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" is too large. Maximum size is 5MB.`);
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase();
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
    } catch (err: any) {
      const message = err?.message || 'Failed to upload image';
      // Provide more helpful error messages for common issues
      if (message.includes('bucket') && message.includes('not found')) {
        setError('Storage bucket not configured. Please run database migrations or contact admin.');
      } else if (message.includes('Payload too large') || message.includes('file size')) {
        setError('Image file is too large. Maximum size is 5MB.');
      } else if (message.includes('mime') || message.includes('type')) {
        setError('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      } else {
        setError(message);
      }
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

  const handleMoveImage = async (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = images.findIndex(img => img.id === imageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const newImages = [...images];
    [newImages[currentIndex], newImages[newIndex]] = [newImages[newIndex], newImages[currentIndex]];

    // Update sort_order for all images
    const updatedImages = newImages.map((img, idx) => ({ ...img, sort_order: idx }));

    // First image should be primary
    const finalImages = updatedImages.map((img, idx) => ({ ...img, is_primary: idx === 0 }));
    setImages(finalImages);

    // Update database if we have a product id
    if (productId) {
      for (const img of finalImages) {
        if (!img.id.startsWith('temp-')) {
          await supabase.from('product_images').update({
            sort_order: img.sort_order,
            is_primary: img.is_primary
          }).eq('id', img.id);
        }
      }
    }
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
      // Use first selected category as the primary category_id for backwards compatibility
      const primaryCategoryId = formData.category_ids.length > 0 ? formData.category_ids[0] : null;

      const productData = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        short_description: formData.short_description || null,
        description: formData.description || null,
        category_id: primaryCategoryId,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        growing_instructions: formData.growing_instructions || null,
        days_to_maturity: formData.days_to_maturity ? parseInt(formData.days_to_maturity) : null,
        yield_per_plant: formData.yield_per_plant || null,
        harvest_type: formData.harvest_type.length > 0 ? formData.harvest_type : null,
        growing_season: formData.growing_season.length > 0 ? formData.growing_season : null,
        growing_location: formData.growing_location || null,
        track_inventory: formData.product_type === 'simple' ? formData.track_inventory : false,
        quantity_available: parseInt(formData.quantity_available) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        stock_status: formData.stock_status,
        is_active: formData.is_active,
        featured: formData.is_featured,
        product_type: formData.product_type,
        external_url: formData.product_type === 'external' ? formData.external_url : null,
        external_button_text: formData.product_type === 'external' ? formData.external_button_text : null,
        local_pickup: formData.local_pickup,
        seedlings_per_unit: parseInt(formData.seedlings_per_unit) || 1,
      };

      let savedProductId = productId;

      if (isEditMode && productId) {
        const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId);
        if (updateError) throw updateError;
      } else {
        const { data: newProduct, error: insertError } = await supabase.from('products').insert(productData).select().single();
        if (insertError) throw insertError;
        savedProductId = newProduct.id;

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

      // Save product relationships for grouped/bundle types
      if ((formData.product_type === 'grouped' || formData.product_type === 'bundle') && savedProductId) {
        // Delete existing relationships
        await supabase.from('product_relationships').delete().eq('parent_product_id', savedProductId);

        // Insert new relationships
        if (relationships.length > 0) {
          const relationshipInserts = relationships.map((rel, idx) => ({
            parent_product_id: savedProductId,
            child_product_id: rel.child_product_id,
            relationship_type: formData.product_type,
            quantity: formData.product_type === 'bundle' ? rel.quantity : 1,
            sort_order: idx,
          }));
          const { error: relError } = await supabase.from('product_relationships').insert(relationshipInserts);
          if (relError) throw relError;
        }
      }

      // Save category assignments to junction table
      if (savedProductId) {
        // Delete existing assignments
        await supabase.from('product_category_assignments').delete().eq('product_id', savedProductId);

        // Insert new assignments
        if (formData.category_ids.length > 0) {
          const categoryInserts = formData.category_ids.map((catId, idx) => ({
            product_id: savedProductId,
            category_id: catId,
            sort_order: idx,
          }));
          const { error: catError } = await supabase.from('product_category_assignments').insert(categoryInserts);
          if (catError) throw catError;
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

  // Product relationship management functions
  const addProductToRelationship = (product: SimpleProduct) => {
    if (relationships.some(r => r.child_product_id === product.id)) return;
    setRelationships(prev => [...prev, {
      child_product_id: product.id,
      quantity: 1,
      sort_order: prev.length,
      product,
    }]);
    setShowProductPicker(false);
    setProductSearch('');
  };

  const removeProductFromRelationship = (childProductId: string) => {
    setRelationships(prev => prev.filter(r => r.child_product_id !== childProductId));
  };

  const updateRelationshipQuantity = (childProductId: string, quantity: number) => {
    setRelationships(prev => prev.map(r =>
      r.child_product_id === childProductId ? { ...r, quantity: Math.max(1, quantity) } : r
    ));
  };

  const filteredAvailableProducts = availableProducts.filter(p => {
    // Exclude products already in the relationship list
    if (relationships.some(r => r.child_product_id === p.id)) return false;
    // Apply search filter
    if (!p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
    // For bundles, only show Seedling products
    if (formData.product_type === 'bundle' && seedlingProductIds.size > 0 && !seedlingProductIds.has(p.id)) return false;
    return true;
  });

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
          {isEditMode && (
            <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">Delete</button>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}
        {infoMessage && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700">{infoMessage}</div>}

        {/* Product Type Selector - Compact Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-600 mr-1">Type:</span>
            {PRODUCT_TYPE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setFormData(prev => ({ ...prev, product_type: option.value }))}
                title={option.description}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  formData.product_type === option.value
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={formData.product_type === option.value ? 'text-white' : 'text-slate-500'}>
                  {option.icon}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

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
              <RichTextEditor
                value={formData.description}
                onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
                placeholder="Enter product description with formatting..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">Categories</label>
              <div className="space-y-3">
                {(() => {
                  const parents = categories.filter(c => !c.parent_id);
                  const childrenOf = (parentId: string) => categories.filter(c => c.parent_id === parentId);
                  const toggleCategory = (catId: string) => {
                    setFormData(prev => ({
                      ...prev,
                      category_ids: prev.category_ids.includes(catId)
                        ? prev.category_ids.filter(id => id !== catId)
                        : [...prev.category_ids, catId],
                    }));
                  };
                  const pillClass = (selected: boolean) =>
                    `px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`;

                  return parents.map(parent => {
                    const children = childrenOf(parent.id);
                    const parentSelected = formData.category_ids.includes(parent.id);
                    return (
                      <div key={parent.id}>
                        <button type="button" onClick={() => toggleCategory(parent.id)} className={pillClass(parentSelected)}>
                          {parent.name}
                        </button>
                        {children.length > 0 && (
                          <div className="ml-4 mt-1.5 flex flex-wrap gap-2">
                            {children.map(child => {
                              const childSelected = formData.category_ids.includes(child.id);
                              return (
                                <button type="button" key={child.id} onClick={() => toggleCategory(child.id)} className={pillClass(childSelected)}>
                                  {child.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              {formData.category_ids.length === 0 && (
                <p className="text-slate-400 text-sm mt-2">Click to select one or more categories</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Price *</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} step="0.01" min="0" required placeholder="Current selling price" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Compare at Price</label>
                <input type="number" name="compare_at_price" value={formData.compare_at_price} onChange={handleChange} step="0.01" min="0" placeholder="Original price (for strikethrough)" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
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
              <RichTextEditor
                value={formData.growing_instructions}
                onChange={(html) => setFormData(prev => ({ ...prev, growing_instructions: html }))}
                placeholder="Enter growing instructions with formatting..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Days to Harvest after Planting</label>
              <input type="number" name="days_to_maturity" value={formData.days_to_maturity} onChange={handleChange} min="0" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Yield per Plant</label>
              <input type="text" name="yield_per_plant" value={formData.yield_per_plant} onChange={handleChange} placeholder='e.g. "1-2 lbs" or "6-8 heads"' className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">Recommended Harvest Type</label>
              <div className="flex flex-wrap gap-3">
                {HARVEST_TYPE_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.harvest_type.includes(option.value)}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          harvest_type: e.target.checked
                            ? [...prev.harvest_type, option.value]
                            : prev.harvest_type.filter(v => v !== option.value)
                        }));
                      }}
                      className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">Growing Season</label>
              <div className="flex flex-wrap gap-3">
                {GROWING_SEASON_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.growing_season.includes(option.value)}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          growing_season: e.target.checked
                            ? [...prev.growing_season, option.value]
                            : prev.growing_season.filter(v => v !== option.value)
                        }));
                      }}
                      className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">Growing Location</label>
              <div className="flex flex-wrap gap-4">
                {GROWING_LOCATION_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="growing_location"
                      value={option.value}
                      checked={formData.growing_location === option.value}
                      onChange={handleChange}
                      className="w-5 h-5 border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Inventory</h2>
          {formData.product_type === 'simple' ? (
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="track_inventory" checked={formData.track_inventory} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50" />
                <span className="text-slate-700">Track inventory</span>
              </label>
              {formData.track_inventory ? (
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
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Stock Status</label>
                  <select
                    name="stock_status"
                    value={formData.stock_status}
                    onChange={handleChange}
                    className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                  <p className="text-slate-500 text-sm mt-1">Manually set whether this product is available for purchase</p>
                </div>
              )}
            </div>
          ) : formData.product_type === 'external' ? (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                External products link to third-party websites. Set the stock status below.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Stock Status</label>
                <select
                  name="stock_status"
                  value={formData.stock_status}
                  onChange={handleChange}
                  className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
                <p className="text-slate-500 text-sm mt-1">Set whether this external product is currently available</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-slate-600 text-sm">
                {formData.product_type === 'grouped' && 'Grouped products inherit inventory from their child products. Manage inventory on individual products within this group.'}
                {formData.product_type === 'bundle' && 'Bundle inventory is calculated from the included products. Manage inventory on individual products within this bundle.'}
              </p>
              <p className="text-slate-500 text-xs mt-2">
                To enable inventory tracking, change the product type to "Simple" above.
              </p>
            </div>
          )}
        </div>

        {/* Fulfillment Section - not applicable for external products */}
        {formData.product_type !== 'external' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">Fulfillment</h2>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Local Pickup</label>
            <select
              name="local_pickup"
              value={formData.local_pickup}
              onChange={handleChange}
              className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="can_be_picked_up">Can be picked up</option>
              <option value="cannot_be_picked_up">Cannot be picked up</option>
              <option value="must_be_picked_up">Must be picked up</option>
            </select>
            <p className="text-slate-500 text-sm mt-1">
              {formData.local_pickup === 'can_be_picked_up' && 'Customers can choose shipping or local pickup for this product.'}
              {formData.local_pickup === 'cannot_be_picked_up' && 'This product can only be shipped. Customers cannot select local pickup.'}
              {formData.local_pickup === 'must_be_picked_up' && 'This product is pickup only and cannot be shipped. If in cart, the entire order must be picked up.'}
            </p>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Seedlings Per Unit</label>
            <input
              type="number"
              name="seedlings_per_unit"
              value={formData.seedlings_per_unit}
              onChange={handleChange}
              min="1"
              className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="text-slate-500 text-sm mt-1">
              Number of physical seedlings per unit. Used for shipping weight calculation.
              {formData.product_type === 'bundle' && ' For bundles, this auto-syncs with bundle contents.'}
            </p>
          </div>
        </div>
        )}

        {/* External/Affiliate Product Fields */}
        {formData.product_type === 'external' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 font-admin-display">External Product Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">External URL *</label>
                <input
                  type="url"
                  name="external_url"
                  value={formData.external_url}
                  onChange={handleChange}
                  placeholder="https://example.com/product"
                  required={formData.product_type === 'external'}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-slate-500 text-sm mt-1">The URL where customers will be redirected to purchase this product</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Button Text</label>
                <input
                  type="text"
                  name="external_button_text"
                  value={formData.external_button_text}
                  onChange={handleChange}
                  placeholder="Buy Now"
                  className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-slate-500 text-sm mt-1">The text displayed on the purchase button</p>
              </div>
            </div>
          </div>
        )}

        {/* Grouped Products Selector */}
        {formData.product_type === 'grouped' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Grouped Products</h2>
                <p className="text-sm text-slate-500">Select products to include in this group</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>

            {relationships.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Layers size={32} className="mx-auto mb-2 opacity-50" />
                <p>No products added yet</p>
                <p className="text-sm">Click "Add Product" to select products for this group</p>
              </div>
            ) : (
              <div className="space-y-2">
                {relationships.map((rel) => (
                  <div key={rel.child_product_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <span className="font-medium text-slate-800">{rel.product?.name}</span>
                      <span className="text-slate-500 ml-2">${rel.product?.price?.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProductFromRelationship(rel.child_product_id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bundle Products Selector */}
        {formData.product_type === 'bundle' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Bundle Contents</h2>
                <p className="text-sm text-slate-500">Select products and quantities for this bundle</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>

            {relationships.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-50" />
                <p>No products added yet</p>
                <p className="text-sm">Click "Add Product" to add products to this bundle</p>
              </div>
            ) : (
              <div className="space-y-2">
                {relationships.map((rel) => {
                  const isItemOos = (rel.product?.quantity_available ?? 0) <= 0;
                  return (
                  <div key={rel.child_product_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-medium text-slate-800">{rel.product?.name}</span>
                      {isItemOos && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">Out of Stock</span>
                      )}
                      <span className="text-slate-500">${rel.product?.price?.toFixed(2)} each</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">Qty:</label>
                        <input
                          type="number"
                          value={rel.quantity}
                          onChange={(e) => updateRelationshipQuantity(rel.child_product_id, parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProductFromRelationship(rel.child_product_id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  );
                })}
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Items in bundle:</span>
                    <span className="font-semibold text-slate-800">
                      {relationships.reduce((sum, rel) => sum + rel.quantity, 0)} item{relationships.reduce((sum, rel) => sum + rel.quantity, 0) !== 1 ? 's' : ''} ({relationships.length} product{relationships.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Bundle Total Value:</span>
                    <span className="font-semibold text-emerald-600">
                      ${relationships.reduce((sum, rel) => sum + (rel.product?.price || 0) * rel.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Images */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800 font-admin-display">Images</h2>
            <p className="text-sm text-slate-500 mt-1">First image will be used as the primary/featured image. Hover to reorder.</p>
          </div>
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
                {images.map((img, index) => (
                  <div key={img.id} className={`relative group rounded-xl overflow-hidden border-2 ${img.is_primary ? 'border-emerald-500' : 'border-transparent'}`}>
                    <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {/* Reorder buttons */}
                      {index > 0 && (
                        <button type="button" onClick={() => handleMoveImage(img.id, 'up')} className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100" title="Move left">
                          <ChevronUp size={16} />
                        </button>
                      )}
                      {index < images.length - 1 && (
                        <button type="button" onClick={() => handleMoveImage(img.id, 'down')} className="p-2 bg-white text-slate-700 rounded-lg hover:bg-slate-100" title="Move right">
                          <ChevronDown size={16} />
                        </button>
                      )}
                      {!img.is_primary && (
                        <button type="button" onClick={() => handleSetPrimary(img.id)} className="p-2 bg-emerald-500 text-white rounded-lg text-xs flex items-center gap-1" title="Set as primary">
                          <Star size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDeleteImage(img.id)} className="p-2 bg-red-500 text-white rounded-lg" title="Delete image">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {img.is_primary && <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded font-medium">Primary</span>}
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">{index + 1}</span>
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
            <h2 className="text-lg font-semibold text-slate-800 font-admin-display mb-4">Tags</h2>

            {(() => {
              const grouped = allTags.reduce<Record<string, typeof allTags>>((acc, tag) => {
                const group = tag.tag_type || 'Other';
                if (!acc[group]) acc[group] = [];
                acc[group].push(tag);
                return acc;
              }, {});
              const groupOrder = Object.keys(grouped).sort((a, b) => {
                if (a === 'Other') return 1;
                if (b === 'Other') return -1;
                return a.localeCompare(b);
              });

              return groupOrder.map(group => (
                <div key={group} className="mb-4 last:mb-0">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {grouped[group].map(tag => {
                      const isChecked = assignedTags.some(at => at.id === tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => isChecked ? unassignTag(tag.id) : assignTag(tag.id)}
                            className="w-4 h-4 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50"
                          />
                          <span className="text-sm text-slate-700">{tag.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}

            {allTags.length === 0 && (
              <p className="text-slate-500 text-sm">No tags available</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
          <button type="button" onClick={onBack} className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors">
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
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

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">{formData.product_type === 'bundle' ? 'Select Seedling Product' : 'Select Product'}</h3>
              <button
                type="button"
                onClick={() => { setShowProductPicker(false); setProductSearch(''); }}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={formData.product_type === 'bundle' ? 'Search seedling products...' : 'Search products...'}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all mb-4"
            />
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredAvailableProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No products found</p>
                  <p className="text-sm">{formData.product_type === 'bundle' ? 'Only active Seedling products can be added to bundles' : 'Only simple, active products can be added'}</p>
                </div>
              ) : (
                filteredAvailableProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addProductToRelationship(product)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-colors text-left"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{product.name}</span>
                      <div className="text-sm text-slate-500">
                        ${product.price?.toFixed(2)} • {product.quantity_available} in stock
                      </div>
                    </div>
                    <Plus size={20} className="text-emerald-500" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default ProductEditPage;
