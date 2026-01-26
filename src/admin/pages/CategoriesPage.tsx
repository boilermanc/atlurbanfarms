import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { useAdminContext } from '../context/AdminContext';
import { supabase } from '../../lib/supabase';
import { Plus, GripVertical, FolderOpen, Edit2, Trash2, Upload, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  product_count?: number;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  is_active: boolean;
}

const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const CategoriesPage: React.FC = () => {
  const { navigate } = useAdminContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModalCategory, setDeleteModalCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Category | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    is_active: true,
  });

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: categoriesData, error: catError } = await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (catError) throw catError;

      const { data: countData, error: countError } = await supabase
        .from('products')
        .select('category_id');

      if (countError) throw countError;

      const productCounts: Record<string, number> = {};
      (countData || []).forEach((p: { category_id: string | null }) => {
        if (p.category_id) {
          productCounts[p.category_id] = (productCounts[p.category_id] || 0) + 1;
        }
      });

      const categoriesWithCounts = (categoriesData || []).map(cat => ({
        ...cat,
        product_count: productCounts[cat.id] || 0,
      }));

      setCategories(categoriesWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        image_url: category.image_url || '',
        is_active: category.is_active,
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', slug: '', description: '', image_url: '', is_active: true });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
    setError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name' && !editingCategory) {
        newData.slug = generateSlug(value);
      }
      return newData;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `category-${Date.now()}.${fileExt}`;
      const filePath = `category-images/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const categoryData = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        description: formData.description || null,
        image_url: formData.image_url || null,
        is_active: formData.is_active,
      };

      if (editingCategory) {
        const { error: updateError } = await supabase
          .from('product_categories')
          .update(categoryData)
          .eq('id', editingCategory.id);
        if (updateError) throw updateError;
      } else {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0;
        const { error: insertError } = await supabase
          .from('product_categories')
          .insert({ ...categoryData, sort_order: maxOrder + 1 });
        if (insertError) throw insertError;
      }

      closeModal();
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalCategory) return;

    if ((deleteModalCategory.product_count || 0) > 0) {
      setError('Cannot delete category with assigned products');
      setDeleteModalCategory(null);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from('product_categories').delete().eq('id', deleteModalCategory.id);
      if (error) throw error;
      setDeleteModalCategory(null);
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, category: Category) => {
    setDraggedItem(category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.id === targetCategory.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = categories.findIndex(c => c.id === draggedItem.id);
    const targetIndex = categories.findIndex(c => c.id === targetCategory.id);

    const newCategories = [...categories];
    newCategories.splice(draggedIndex, 1);
    newCategories.splice(targetIndex, 0, draggedItem);

    const updatedCategories = newCategories.map((cat, index) => ({
      ...cat,
      sort_order: index + 1,
    }));

    setCategories(updatedCategories);
    setDraggedItem(null);

    try {
      for (const cat of updatedCategories) {
        await supabase.from('product_categories').update({ sort_order: cat.sort_order }).eq('id', cat.id);
      }
    } catch (err) {
      console.error('Failed to update order:', err);
      fetchCategories();
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('product_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_active: !c.is_active } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Categories</h1>
            <p className="text-slate-500 text-sm mt-1">Drag to reorder. Click to edit.</p>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors">
            <Plus size={20} />
            Add Category
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No categories yet</h3>
              <p className="text-slate-500">Get started by adding your first category</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {categories.map((category) => (
                <div
                  key={category.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, category)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, category)}
                  className={`p-4 hover:bg-slate-50 transition-colors ${draggedItem?.id === category.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                      <GripVertical size={20} />
                    </div>

                    <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FolderOpen size={20} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800 font-medium">{category.name}</p>
                        <span className="text-slate-400 text-sm">/{category.slug}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Store category filter for ProductsPage to pick up
                          localStorage.setItem('admin_products_category_filter', category.id);
                          navigate('products');
                        }}
                        className="text-emerald-600 text-sm hover:text-emerald-700 hover:underline transition-colors text-left font-medium"
                      >
                        {category.product_count || 0} products
                      </button>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(category); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${category.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${category.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openModal(category)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteModalCategory(category)}
                        disabled={(category.product_count || 0) > 0}
                        className={`p-2 rounded-xl transition-colors ${(category.product_count || 0) > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                        title={(category.product_count || 0) > 0 ? 'Cannot delete category with products' : 'Delete'}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <p className="text-sm text-slate-500">{categories.length} categories total</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Slug</label>
                <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Image</label>
                <div className="flex items-center gap-4">
                  {formData.image_url ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden">
                      <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="category-image" disabled={uploading} />
                      <label htmlFor="category-image" className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-800 hover:border-slate-300 cursor-pointer transition-colors">
                        {uploading ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Upload size={18} />}
                        Upload Image
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 bg-white text-emerald-500 focus:ring-emerald-500/50" />
                <span className="text-slate-700">Active</span>
              </label>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} disabled={saving} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors">
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Category</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete <strong className="text-slate-800">{deleteModalCategory.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModalCategory(null)} disabled={deleting} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors">
                {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default CategoriesPage;
