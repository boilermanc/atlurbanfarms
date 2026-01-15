import React, { useState, useEffect, useCallback } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import ServiceEditModal from '../components/ServiceEditModal';
import { supabase } from '../../lib/supabase';

export interface ShippingService {
  id: string;
  carrier: 'UPS' | 'FedEx' | 'USPS';
  service_code: string;
  display_name: string;
  description: string | null;
  min_transit_days: number;
  max_transit_days: number;
  base_price: number;
  markup_type: 'none' | 'flat' | 'percentage';
  markup_value: number;
  free_shipping_threshold: number | null;
  is_enabled: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const ShippingServicesPage: React.FC = () => {
  const [services, setServices] = useState<ShippingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ShippingService | null>(null);
  const [draggedItem, setDraggedItem] = useState<ShippingService | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shipping_services')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching shipping services:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleSave = async (serviceData: Partial<ShippingService> & { id?: string }) => {
    try {
      if (serviceData.id) {
        // Update existing service
        const { error } = await supabase
          .from('shipping_services')
          .update({
            carrier: serviceData.carrier,
            service_code: serviceData.service_code,
            display_name: serviceData.display_name,
            description: serviceData.description,
            min_transit_days: serviceData.min_transit_days,
            max_transit_days: serviceData.max_transit_days,
            base_price: serviceData.base_price,
            markup_type: serviceData.markup_type,
            markup_value: serviceData.markup_value,
            free_shipping_threshold: serviceData.free_shipping_threshold,
            is_enabled: serviceData.is_enabled,
            is_default: serviceData.is_default,
          })
          .eq('id', serviceData.id);

        if (error) throw error;

        // If this service is set as default, unset others
        if (serviceData.is_default) {
          await supabase
            .from('shipping_services')
            .update({ is_default: false })
            .neq('id', serviceData.id);
        }
      } else {
        // Insert new service
        const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order)) : 0;

        // If this service is set as default, unset others first
        if (serviceData.is_default) {
          await supabase
            .from('shipping_services')
            .update({ is_default: false });
        }

        const { error } = await supabase
          .from('shipping_services')
          .insert({
            carrier: serviceData.carrier,
            service_code: serviceData.service_code,
            display_name: serviceData.display_name,
            description: serviceData.description,
            min_transit_days: serviceData.min_transit_days,
            max_transit_days: serviceData.max_transit_days,
            base_price: serviceData.base_price,
            markup_type: serviceData.markup_type,
            markup_value: serviceData.markup_value,
            free_shipping_threshold: serviceData.free_shipping_threshold,
            is_enabled: serviceData.is_enabled,
            is_default: serviceData.is_default,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
      }

      await fetchServices();
    } catch (error) {
      console.error('Error saving shipping service:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shipping service?')) return;

    try {
      const { error } = await supabase.from('shipping_services').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting shipping service:', error);
    }
  };

  const handleToggleEnabled = async (service: ShippingService) => {
    setUpdatingId(service.id);
    try {
      const { error } = await supabase
        .from('shipping_services')
        .update({ is_enabled: !service.is_enabled })
        .eq('id', service.id);

      if (error) throw error;
      setServices(prev => prev.map(s =>
        s.id === service.id ? { ...s, is_enabled: !s.is_enabled } : s
      ));
    } catch (error) {
      console.error('Error toggling service:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, service: ShippingService) => {
    setDraggedItem(service);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetService: ShippingService) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.id === targetService.id) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = services.findIndex(s => s.id === draggedItem.id);
    const targetIndex = services.findIndex(s => s.id === targetService.id);

    const newServices = [...services];
    newServices.splice(draggedIndex, 1);
    newServices.splice(targetIndex, 0, draggedItem);

    // Update sort_order for all items
    const updatedServices = newServices.map((service, index) => ({
      ...service,
      sort_order: index + 1,
    }));

    setServices(updatedServices);
    setDraggedItem(null);

    // Persist to database
    try {
      const updates = updatedServices.map(service => ({
        id: service.id,
        sort_order: service.sort_order,
      }));

      for (const update of updates) {
        await supabase
          .from('shipping_services')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      fetchServices(); // Revert on error
    }
  };

  const handleEdit = (service: ShippingService) => {
    setEditingService(service);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  const getCarrierColor = (carrier: string) => {
    switch (carrier) {
      case 'UPS': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'FedEx': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'USPS': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatTransitTime = (min: number, max: number) => {
    if (min === max) {
      return `${min} day${min !== 1 ? 's' : ''}`;
    }
    return `${min}-${max} days`;
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Shipping Services</h1>
            <p className="text-slate-400 mt-1">
              Drag and drop to reorder. Click to edit.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Service
          </button>
        </div>

        {/* Services List */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {services.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Shipping Services</h3>
              <p className="text-slate-400 mb-6">
                Get started by adding your first shipping service.
              </p>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Add Your First Service
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {services.map((service) => (
                <div
                  key={service.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, service)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, service)}
                  className={`p-5 hover:bg-slate-700/30 transition-colors ${
                    draggedItem?.id === service.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="5" r="1"/>
                        <circle cx="9" cy="12" r="1"/>
                        <circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/>
                        <circle cx="15" cy="12" r="1"/>
                        <circle cx="15" cy="19" r="1"/>
                      </svg>
                    </div>

                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-medium text-lg">{service.display_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getCarrierColor(service.carrier)}`}>
                          {service.carrier}
                        </span>
                        {service.is_default && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTransitTime(service.min_transit_days, service.max_transit_days)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatPrice(service.base_price)}
                        </span>
                        {service.free_shipping_threshold && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Free over {formatPrice(service.free_shipping_threshold)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Enable Toggle */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleEnabled(service);
                        }}
                        disabled={updatingId === service.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          service.is_enabled ? 'bg-emerald-600' : 'bg-slate-600'
                        } ${updatingId === service.id ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service.is_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {services.length > 0 && (
          <div className="mt-6 flex items-center gap-6 text-sm text-slate-400">
            <span>{services.length} total service{services.length !== 1 ? 's' : ''}</span>
            <span>{services.filter(s => s.is_enabled).length} enabled</span>
            <span>{services.filter(s => !s.is_enabled).length} disabled</span>
          </div>
        )}
      </div>

      <ServiceEditModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingService(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        service={editingService}
      />
    </AdminPageWrapper>
  );
};

export default ShippingServicesPage;
