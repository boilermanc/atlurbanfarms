import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShippingPackages, ShippingPackage } from '../../hooks/useShippingPackages';

interface PackageFormData {
  name: string;
  length: string;
  width: string;
  height: string;
  empty_weight: string;
  min_quantity: string;
  max_quantity: string;
  is_default: boolean;
  is_active: boolean;
}

const defaultFormData: PackageFormData = {
  name: '',
  length: '',
  width: '',
  height: '',
  empty_weight: '0.25',
  min_quantity: '1',
  max_quantity: '10',
  is_default: false,
  is_active: true
};

const ShippingPackagesTab: React.FC = () => {
  const {
    packages,
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage,
    reorderPackages,
    validateQuantityRanges
  } = useShippingPackages();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ShippingPackage | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(defaultFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<ShippingPackage | null>(null);

  const handleOpenModal = (pkg?: ShippingPackage) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        length: pkg.length.toString(),
        width: pkg.width.toString(),
        height: pkg.height.toString(),
        empty_weight: pkg.empty_weight.toString(),
        min_quantity: pkg.min_quantity.toString(),
        max_quantity: pkg.max_quantity.toString(),
        is_default: pkg.is_default,
        is_active: pkg.is_active
      });
    } else {
      setEditingPackage(null);
      setFormData(defaultFormData);
    }
    setFormError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPackage(null);
    setFormData(defaultFormData);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setFormError('Package name is required');
      return;
    }

    const length = parseFloat(formData.length);
    const width = parseFloat(formData.width);
    const height = parseFloat(formData.height);
    const emptyWeight = parseFloat(formData.empty_weight);
    const minQty = parseInt(formData.min_quantity, 10);
    const maxQty = parseInt(formData.max_quantity, 10);

    // Validate dimensions
    if (isNaN(length) || length <= 0 || isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      setFormError('All dimensions must be positive numbers');
      return;
    }

    // Validate weight
    if (isNaN(emptyWeight) || emptyWeight < 0) {
      setFormError('Empty weight must be a non-negative number');
      return;
    }

    // Validate quantities
    if (isNaN(minQty) || minQty < 1) {
      setFormError('Minimum quantity must be at least 1');
      return;
    }
    if (isNaN(maxQty) || maxQty < minQty) {
      setFormError('Maximum quantity must be greater than or equal to minimum');
      return;
    }

    // Validate quantity range doesn't overlap
    if (formData.is_active) {
      const validation = validateQuantityRanges(
        { min_quantity: minQty, max_quantity: maxQty },
        editingPackage?.id
      );
      if (!validation.valid) {
        setFormError(validation.message || 'Quantity range overlaps with existing package');
        return;
      }
    }

    setSaving(true);
    try {
      const packageData = {
        name: formData.name.trim(),
        length,
        width,
        height,
        empty_weight: emptyWeight,
        min_quantity: minQty,
        max_quantity: maxQty,
        is_default: formData.is_default,
        is_active: formData.is_active,
        sort_order: editingPackage?.sort_order || 0
      };

      const result = editingPackage
        ? await updatePackage(editingPackage.id, packageData)
        : await createPackage(packageData);

      if (result.success) {
        handleCloseModal();
      } else {
        setFormError(result.error || 'Failed to save package');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: ShippingPackage) => {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"?`)) return;
    await deletePackage(pkg.id);
  };

  const handleToggleActive = async (pkg: ShippingPackage) => {
    await updatePackage(pkg.id, { is_active: !pkg.is_active });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, pkg: ShippingPackage) => {
    setDraggedItem(pkg);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetPackage: ShippingPackage) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetPackage.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = packages.findIndex(p => p.id === draggedItem.id);
    const targetIndex = packages.findIndex(p => p.id === targetPackage.id);

    const newPackages = [...packages];
    newPackages.splice(draggedIndex, 1);
    newPackages.splice(targetIndex, 0, draggedItem);

    await reorderPackages(newPackages);
    setDraggedItem(null);
  };

  const formatDimensions = (pkg: ShippingPackage) =>
    `${pkg.length} x ${pkg.width} x ${pkg.height} in`;

  const formatQuantityRange = (pkg: ShippingPackage) =>
    pkg.min_quantity === pkg.max_quantity
      ? `${pkg.min_quantity} items`
      : `${pkg.min_quantity}-${pkg.max_quantity} items`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Package Configurations</h2>
          <p className="text-sm text-slate-500 mt-1">
            Define box sizes and quantity ranges for automatic package selection
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Package
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          {error}
        </div>
      )}

      {/* Packages List */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">No Packages Configured</h3>
          <p className="text-slate-500 mb-4">
            Add package configurations to enable automatic box selection based on order quantity.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            Add Your First Package
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
          <div className="divide-y divide-slate-100">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                draggable
                onDragStart={(e) => handleDragStart(e, pkg)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, pkg)}
                className={`p-4 hover:bg-slate-50 transition-colors ${
                  draggedItem?.id === pkg.id ? 'opacity-50' : ''
                } ${!pkg.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                    </svg>
                  </div>

                  {/* Package Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-slate-800 font-medium">{pkg.name}</span>
                      {pkg.is_default && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Default
                        </span>
                      )}
                      {!pkg.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        {formatDimensions(pkg)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        {pkg.empty_weight} lb
                      </span>
                      <span className="flex items-center gap-1 text-amber-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        {formatQuantityRange(pkg)}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Active */}
                  <button
                    onClick={() => handleToggleActive(pkg)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      pkg.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pkg.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenModal(pkg)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(pkg)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {packages.filter(p => p.is_active).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Package Selection Preview</h3>
          <div className="space-y-2 text-sm text-slate-500">
            {packages
              .filter(p => p.is_active)
              .sort((a, b) => a.min_quantity - b.min_quantity)
              .map(pkg => (
                <div key={pkg.id} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Orders with {formatQuantityRange(pkg)} use{' '}
                    <span className="text-slate-800 font-medium">{pkg.name}</span>
                    {' '}({formatDimensions(pkg)})
                    {pkg.is_default && <span className="text-emerald-600"> (fallback)</span>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                {editingPackage ? 'Edit Package' : 'Add Package'}
              </h2>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Small Box, Medium Box"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Dimensions */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Dimensions (inches) *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.length}
                        onChange={e => setFormData(f => ({ ...f, length: e.target.value }))}
                        placeholder="Length"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500 mt-1 block text-center">L</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.width}
                        onChange={e => setFormData(f => ({ ...f, width: e.target.value }))}
                        placeholder="Width"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500 mt-1 block text-center">W</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.height}
                        onChange={e => setFormData(f => ({ ...f, height: e.target.value }))}
                        placeholder="Height"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500 mt-1 block text-center">H</span>
                    </div>
                  </div>
                </div>

                {/* Empty Weight */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Empty Weight (lb)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.empty_weight}
                    onChange={e => setFormData(f => ({ ...f, empty_weight: e.target.value }))}
                    placeholder="0.25"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Weight of box + packing materials</p>
                </div>

                {/* Quantity Range */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Quantity Range *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={formData.min_quantity}
                        onChange={e => setFormData(f => ({ ...f, min_quantity: e.target.value }))}
                        placeholder="Min"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500 mt-1 block text-center">Minimum</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_quantity}
                        onChange={e => setFormData(f => ({ ...f, max_quantity: e.target.value }))}
                        placeholder="Max"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="text-xs text-slate-500 mt-1 block text-center">Maximum</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Number of seedlings this box can hold</p>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-600">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={e => setFormData(f => ({ ...f, is_default: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-600">Default (fallback)</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingPackage ? 'Update' : 'Create')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShippingPackagesTab;
