import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import RichTextEditor from '../components/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { Plus, GripVertical, Edit2, Trash2, Users, Upload, X, Save, Loader2 } from 'lucide-react';

interface Grower {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  image: string | null;
  specialty: string | null;
  years_experience: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface GrowerFormData {
  name: string;
  title: string;
  bio: string;
  image: string;
  specialty: string;
  years_experience: string;
  is_active: boolean;
}

const INITIAL_FORM_DATA: GrowerFormData = {
  name: '',
  title: '',
  bio: '',
  image: '',
  specialty: '',
  years_experience: '',
  is_active: true,
};

const GrowersPage: React.FC = () => {
  const [growers, setGrowers] = useState<Grower[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGrower, setEditingGrower] = useState<Grower | null>(null);
  const [formData, setFormData] = useState<GrowerFormData>(INITIAL_FORM_DATA);
  const [draggedItem, setDraggedItem] = useState<Grower | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGrowers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('growers')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setGrowers(data || []);
    } catch (error) {
      console.error('Error fetching growers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrowers();
  }, [fetchGrowers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const growerData = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        bio: formData.bio.trim() || null,
        image: formData.image.trim() || null,
        specialty: formData.specialty.trim() || null,
        years_experience: formData.years_experience ? parseInt(formData.years_experience, 10) : null,
        is_active: formData.is_active,
      };

      if (editingGrower) {
        const { error } = await supabase
          .from('growers')
          .update(growerData)
          .eq('id', editingGrower.id);

        if (error) throw error;
      } else {
        const maxOrder = growers.length > 0 ? Math.max(...growers.map(g => g.display_order)) : 0;
        const { error } = await supabase
          .from('growers')
          .insert({
            ...growerData,
            display_order: maxOrder + 1,
          });

        if (error) throw error;
      }

      await fetchGrowers();
      closeModal();
    } catch (error) {
      console.error('Error saving grower:', error);
      alert('Failed to save grower. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
      const { error } = await supabase.from('growers').delete().eq('id', id);
      if (error) throw error;
      setGrowers(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting grower:', error);
      alert('Failed to delete team member.');
    }
  };

  const handleToggleActive = async (grower: Grower) => {
    try {
      const { error } = await supabase
        .from('growers')
        .update({ is_active: !grower.is_active })
        .eq('id', grower.id);

      if (error) throw error;
      setGrowers(prev =>
        prev.map(g => (g.id === grower.id ? { ...g, is_active: !g.is_active } : g))
      );
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, grower: Grower) => {
    setDraggedItem(grower);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetGrower: Grower) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.id === targetGrower.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = growers.findIndex(g => g.id === draggedItem.id);
    const targetIndex = growers.findIndex(g => g.id === targetGrower.id);

    const newGrowers = [...growers];
    newGrowers.splice(draggedIndex, 1);
    newGrowers.splice(targetIndex, 0, draggedItem);

    const updatedGrowers = newGrowers.map((grower, index) => ({
      ...grower,
      display_order: index + 1,
    }));

    setGrowers(updatedGrowers);
    setDraggedItem(null);

    // Persist to database
    try {
      for (const grower of updatedGrowers) {
        await supabase
          .from('growers')
          .update({ display_order: grower.display_order })
          .eq('id', grower.id);
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      fetchGrowers(); // Revert on error
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      // Validate file
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File is too large. Maximum size is 5MB.');
      }

      // Upload to storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `growers/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      setFormData(prev => ({ ...prev, image: urlData.publicUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEdit = (grower: Grower) => {
    setEditingGrower(grower);
    setFormData({
      name: grower.name,
      title: grower.title,
      bio: grower.bio || '',
      image: grower.image || '',
      specialty: grower.specialty || '',
      years_experience: grower.years_experience?.toString() || '',
      is_active: grower.is_active,
    });
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingGrower(null);
    setFormData(INITIAL_FORM_DATA);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGrower(null);
    setFormData(INITIAL_FORM_DATA);
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Team Members</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage the growers displayed on your About page. Drag to reorder.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} />
            Add Team Member
          </button>
        </div>

        {/* Growers List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {growers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Team Members</h3>
              <p className="text-slate-500 mb-6">
                Add your first team member to display on the About page.
              </p>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
              >
                Add Your First Team Member
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 py-3 px-4"></th>
                    <th className="w-16 py-3 px-4"></th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Specialty</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {growers.map((grower) => (
                    <tr
                      key={grower.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, grower)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, grower)}
                      className={`hover:bg-slate-50 transition-colors cursor-move ${
                        draggedItem?.id === grower.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                          <GripVertical size={20} />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {grower.image ? (
                          <img
                            src={grower.image}
                            alt={grower.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Users size={20} className="text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-slate-800 font-medium">{grower.name}</p>
                        {grower.years_experience && (
                          <p className="text-slate-500 text-sm">{grower.years_experience} years exp.</p>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-600">{grower.title}</span>
                      </td>
                      <td className="py-4 px-4 hidden md:table-cell">
                        {grower.specialty ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
                            {grower.specialty}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(grower)}
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                            grower.is_active
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {grower.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(grower)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(grower.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span>{growers.length} total team members</span>
          <span>{growers.filter(g => g.is_active).length} active</span>
          <span>{growers.filter(g => !g.is_active).length} inactive</span>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingGrower ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Profile Photo
                </label>
                <div className="flex items-start gap-4">
                  {formData.image ? (
                    <div className="relative">
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-24 h-24 rounded-2xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Users size={32} className="text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          Upload Image
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-500">
                      Or paste an image URL below
                    </p>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Name & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Head Grower"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Specialty & Experience */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Specialty
                  </label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                    placeholder="Vertical Growing Systems"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.years_experience}
                    onChange={(e) => setFormData(prev => ({ ...prev, years_experience: e.target.value }))}
                    placeholder="10"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bio
                </label>
                <RichTextEditor
                  value={formData.bio}
                  onChange={(html) => setFormData(prev => ({ ...prev, bio: html }))}
                  placeholder="Write a short bio about this team member..."
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">
                  Show on website (active)
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim() || !formData.title.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {editingGrower ? 'Update' : 'Create'} Team Member
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
};

export default GrowersPage;
