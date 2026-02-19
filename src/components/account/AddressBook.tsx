import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAddresses } from '../../hooks/useSupabase';

interface AddressBookProps {
  userId: string;
}

interface Address {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  company?: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  is_default: boolean;
}

interface AddressFormData {
  label: string;
  first_name: string;
  last_name: string;
  company: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  is_default: boolean;
}

const initialFormData: AddressFormData = {
  label: '',
  first_name: '',
  last_name: '',
  company: '',
  street: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  is_default: false,
};

const AddressBook: React.FC<AddressBookProps> = ({ userId }) => {
  const { addresses, loading, error, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses(userId);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingId) {
        const result = await updateAddress(editingId, formData);
        if (result.error) throw new Error(result.error);
      } else {
        const result = await addAddress(formData);
        if (result.error) throw new Error(result.error);
      }
      handleCancel();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (address: Address) => {
    setFormData({
      label: address.label || '',
      first_name: address.first_name || '',
      last_name: address.last_name || '',
      company: address.company || '',
      street: address.street || '',
      unit: address.unit || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.zip || '',
      phone: address.phone || '',
      is_default: address.is_default || false,
    });
    setEditingId(address.id);
    setIsAddingNew(true);
  };

  const handleDelete = async (addressId: string) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;

    const result = await deleteAddress(addressId);
    if (result.error) {
      alert('Failed to delete address: ' + result.error);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    const result = await setDefaultAddress(addressId);
    if (result.error) {
      alert('Failed to set default address: ' + result.error);
    }
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData(initialFormData);
    setFormError(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Address Book
          </h1>
          <p className="text-gray-500">Loading your addresses...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
              <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-2">
            Address Book
          </h1>
          <p className="text-gray-500">
            Manage your delivery addresses.
          </p>
        </div>
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Address
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Add/Edit Address Form */}
      <AnimatePresence>
        {isAddingNew && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <h2 className="font-heading font-bold text-gray-900 mb-6">
              {editingId ? 'Edit Address' : 'Add New Address'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              {/* Address Label */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Label (e.g., Home, Work)
                </label>
                <input
                  type="text"
                  name="label"
                  value={formData.label}
                  onChange={handleInputChange}
                  placeholder="Home"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Company (Optional) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Business or school name"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Street Address */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Street Address *
                </label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  required
                  placeholder="123 Main Street"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Unit/Apt */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Apt, Suite, Unit (Optional)
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  placeholder="Apt 4B"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* City, State, ZIP */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    State *
                  </label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  >
                    <option value="">--</option>
                    <option value="GA">GA</option>
                    <option value="AL">AL</option>
                    <option value="FL">FL</option>
                    <option value="SC">SC</option>
                    <option value="TN">TN</option>
                    <option value="NC">NC</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                    ZIP *
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    required
                    maxLength={10}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 555-5555"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Default Address Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_default"
                  checked={formData.is_default}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-gray-700">Set as default address</span>
              </label>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingId ? 'Update Address' : 'Save Address'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address List */}
      {addresses.length === 0 && !isAddingNew ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-gray-900 mb-2">No addresses saved</h3>
          <p className="text-gray-500 mb-4">Add an address to make checkout faster.</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
          >
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address: Address) => (
            <motion.div
              key={address.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-2xl p-6 border shadow-sm relative ${
                address.is_default ? 'border-emerald-200' : 'border-gray-100'
              }`}
            >
              {/* Default Badge */}
              {address.is_default && (
                <div className="absolute -top-2 -right-2 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                  Default
                </div>
              )}

              {/* Address Label */}
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="font-heading font-bold text-gray-900">
                  {address.label || 'Address'}
                </span>
              </div>

              {/* Address Details */}
              <div className="text-sm text-gray-600 space-y-1 mb-4">
                <p className="font-medium text-gray-900">
                  {address.first_name} {address.last_name}
                </p>
                {address.company && <p>{address.company}</p>}
                <p>{address.street}</p>
                {address.unit && <p>{address.unit}</p>}
                <p>{address.city}, {address.state} {address.zip}</p>
                {address.phone && <p className="text-gray-400">{address.phone}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(address)}
                  className="px-3 py-1.5 text-sm text-emerald-600 font-medium hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                {!address.is_default && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="px-3 py-1.5 text-sm text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(address.id)}
                  className="px-3 py-1.5 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressBook;
