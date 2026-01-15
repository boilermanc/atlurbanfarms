import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';

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

      // Get product counts for each category
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
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
            <h1 className="text-2xl font-bold text-white">Categories</h1>
            <p className="text-slate-400 text-sm mt-1">Drag to reorder. Click to edit.</p>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Add Category
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">{error}</div>}

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No categories yet</h3>
              <p className="text-slate-400">Get started by adding your first category</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {categories.map((category) => (
                <div
                  key={category.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, category)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, category)}
                  className={`p-4 hover:bg-slate-700/30 transition-colors ${draggedItem?.id === category.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="text-slate-500 cursor-grab active:cursor-grabbing">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                    </div>

                    {/* Image */}
                    <div className="w-12 h-12 bg-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{category.name}</p>
                        <span className="text-slate-500 text-sm">/{category.slug}</span>
                      </div>
                      <p className="text-slate-400 text-sm">{category.product_count || 0} products</p>
                    </div>

                    {/* Status */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${category.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(category); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${category.is_active ? 'bg-emerald-600' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${category.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => openModal(category)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                      </button>
                      <button
                        onClick={() => setDeleteModalCategory(category)}
                        disabled={(category.product_count || 0) > 0}
                        className={`p-2 rounded-lg transition-colors ${(category.product_count || 0) > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'}`}
                        title={(category.product_count || 0) > 0 ? 'Cannot delete category with products' : 'Delete'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <p className="text-sm text-slate-400">{categories.length} categories total</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Slug</label>
                <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Image</label>
                <div className="flex items-center gap-4">
                  {formData.image_url ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                      <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="category-image" disabled={uploading} />
                      <label htmlFor="category-image" className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer transition-colors">
                        {uploading ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>}
                        Upload Image
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/50" />
                <span className="text-slate-300">Active</span>
              </label>
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} disabled={saving} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2">
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
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Category</h3>
            <p className="text-slate-400 mb-6">Are you sure you want to delete <strong className="text-white">{deleteModalCategory.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteModalCategory(null)} disabled={deleting} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2">
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
