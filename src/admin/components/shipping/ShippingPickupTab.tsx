import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePickupLocations, PickupLocation, PickupLocationInput } from '../../hooks/usePickupLocations';
import { PickupSchedule, formatTime, getDayName } from '../../hooks/usePickupSchedules';
import { supabase } from '../../../lib/supabase';

// US States for dropdown
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

interface LocationFormData {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  instructions: string;
  is_active: boolean;
}

interface ScheduleFormData {
  schedule_type: 'recurring' | 'one_time';
  day_of_week: string;
  specific_date: string;
  start_time: string;
  end_time: string;
  max_orders: string;
  is_active: boolean;
}

const defaultLocationFormData: LocationFormData = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: 'GA',
  postal_code: '',
  phone: '',
  instructions: '',
  is_active: true
};

const defaultScheduleFormData: ScheduleFormData = {
  schedule_type: 'recurring',
  day_of_week: '6', // Saturday
  specific_date: '',
  start_time: '09:00',
  end_time: '12:00',
  max_orders: '',
  is_active: true
};

const ShippingPickupTab: React.FC = () => {
  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    createLocation,
    updateLocation,
    deleteLocation,
    reorderLocations,
    toggleActive: toggleLocationActive
  } = usePickupLocations();

  // All schedules grouped by location_id
  const [allSchedules, setAllSchedules] = useState<Record<string, PickupSchedule[]>>({});
  const [schedulesLoading, setSchedulesLoading] = useState(true);

  // Fetch all schedules for all locations
  const fetchAllSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const { data, error } = await supabase
        .from('pickup_schedules')
        .select('*')
        .order('day_of_week', { ascending: true, nullsFirst: false })
        .order('specific_date', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Group by location_id
      const grouped: Record<string, PickupSchedule[]> = {};
      (data || []).forEach((schedule: PickupSchedule) => {
        if (!grouped[schedule.location_id]) {
          grouped[schedule.location_id] = [];
        }
        grouped[schedule.location_id].push(schedule);
      });
      setAllSchedules(grouped);
    } catch (err: any) {
      console.error('Error fetching all schedules:', err);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllSchedules();
  }, [fetchAllSchedules]);

  // Helper to format schedule display
  const formatScheduleDisplay = (schedule: PickupSchedule): string => {
    const startTime = formatTime(schedule.start_time);
    const endTime = formatTime(schedule.end_time);

    if (schedule.schedule_type === 'recurring') {
      const dayName = getDayName(schedule.day_of_week ?? 0);
      return `${dayName} ${startTime} - ${endTime}`;
    } else {
      const date = new Date(schedule.specific_date + 'T00:00:00');
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      return `${dateStr} ${startTime} - ${endTime}`;
    }
  };

  // Get schedule summary for a location
  const getScheduleSummary = (locationId: string): string => {
    const schedules = allSchedules[locationId] || [];
    const activeSchedules = schedules.filter(s => s.is_active);
    if (activeSchedules.length === 0) return 'No schedule';

    const recurring = activeSchedules.filter(s => s.schedule_type === 'recurring');
    if (recurring.length > 0) {
      const days = recurring.map(s => getDayName(s.day_of_week ?? 0).slice(0, 3));
      return days.join(', ');
    }
    return `${activeSchedules.length} time slot${activeSchedules.length > 1 ? 's' : ''}`;
  };

  // Location modal state
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PickupLocation | null>(null);
  const [locationFormData, setLocationFormData] = useState<LocationFormData>(defaultLocationFormData);
  const [locationFormError, setLocationFormError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Schedule management modal state (shows all schedules for a location)
  const [scheduleManageModalOpen, setScheduleManageModalOpen] = useState(false);
  const [managingLocation, setManagingLocation] = useState<PickupLocation | null>(null);

  // Schedule edit modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PickupSchedule | null>(null);
  const [scheduleFormData, setScheduleFormData] = useState<ScheduleFormData>(defaultScheduleFormData);
  const [scheduleFormError, setScheduleFormError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Drag state for locations
  const [draggedLocation, setDraggedLocation] = useState<PickupLocation | null>(null);

  // Location handlers
  const handleOpenLocationModal = (location?: PickupLocation) => {
    if (location) {
      setEditingLocation(location);
      setLocationFormData({
        name: location.name,
        address_line1: location.address_line1,
        address_line2: location.address_line2 || '',
        city: location.city,
        state: location.state,
        postal_code: location.postal_code,
        phone: location.phone || '',
        instructions: location.instructions || '',
        is_active: location.is_active
      });
    } else {
      setEditingLocation(null);
      setLocationFormData(defaultLocationFormData);
    }
    setLocationFormError(null);
    setLocationModalOpen(true);
  };

  const handleCloseLocationModal = () => {
    setLocationModalOpen(false);
    setEditingLocation(null);
    setLocationFormData(defaultLocationFormData);
    setLocationFormError(null);
  };

  const handleSaveLocation = async () => {
    setLocationFormError(null);

    if (!locationFormData.name.trim()) {
      setLocationFormError('Location name is required');
      return;
    }
    if (!locationFormData.address_line1.trim()) {
      setLocationFormError('Address is required');
      return;
    }
    if (!locationFormData.city.trim()) {
      setLocationFormError('City is required');
      return;
    }
    if (!locationFormData.postal_code.trim()) {
      setLocationFormError('Postal code is required');
      return;
    }

    setSavingLocation(true);
    try {
      const locationData: PickupLocationInput = {
        name: locationFormData.name.trim(),
        address_line1: locationFormData.address_line1.trim(),
        address_line2: locationFormData.address_line2.trim() || undefined,
        city: locationFormData.city.trim(),
        state: locationFormData.state,
        postal_code: locationFormData.postal_code.trim(),
        phone: locationFormData.phone.trim() || undefined,
        instructions: locationFormData.instructions.trim() || undefined,
        is_active: locationFormData.is_active,
        sort_order: editingLocation?.sort_order || 0
      };

      const result = editingLocation
        ? await updateLocation(editingLocation.id, locationData)
        : await createLocation(locationData);

      if (result.success) {
        handleCloseLocationModal();
      } else {
        setLocationFormError(result.error || 'Failed to save location');
      }
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (location: PickupLocation) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"? This will also delete all schedules for this location.`)) return;
    await deleteLocation(location.id);
  };

  // Location drag and drop
  const handleLocationDragStart = (e: React.DragEvent, location: PickupLocation) => {
    setDraggedLocation(location);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLocationDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleLocationDrop = async (e: React.DragEvent, targetLocation: PickupLocation) => {
    e.preventDefault();
    if (!draggedLocation || draggedLocation.id === targetLocation.id) {
      setDraggedLocation(null);
      return;
    }

    const draggedIndex = locations.findIndex(l => l.id === draggedLocation.id);
    const targetIndex = locations.findIndex(l => l.id === targetLocation.id);

    const newLocations = [...locations];
    newLocations.splice(draggedIndex, 1);
    newLocations.splice(targetIndex, 0, draggedLocation);

    await reorderLocations(newLocations);
    setDraggedLocation(null);
  };

  // Schedule management modal
  const handleOpenScheduleManageModal = (location: PickupLocation) => {
    setManagingLocation(location);
    setScheduleManageModalOpen(true);
  };

  const handleCloseScheduleManageModal = () => {
    setScheduleManageModalOpen(false);
    setManagingLocation(null);
  };

  // Schedule handlers
  const handleOpenScheduleModal = (schedule?: PickupSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleFormData({
        schedule_type: schedule.schedule_type,
        day_of_week: schedule.day_of_week?.toString() || '6',
        specific_date: schedule.specific_date || '',
        start_time: schedule.start_time.slice(0, 5),
        end_time: schedule.end_time.slice(0, 5),
        max_orders: schedule.max_orders?.toString() || '',
        is_active: schedule.is_active
      });
    } else {
      setEditingSchedule(null);
      setScheduleFormData(defaultScheduleFormData);
    }
    setScheduleFormError(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setScheduleModalOpen(false);
    setEditingSchedule(null);
    setScheduleFormData(defaultScheduleFormData);
    setScheduleFormError(null);
  };

  const handleSaveSchedule = async () => {
    if (!managingLocation) return;

    setScheduleFormError(null);

    // Validate
    if (scheduleFormData.schedule_type === 'one_time' && !scheduleFormData.specific_date) {
      setScheduleFormError('Date is required for one-time schedules');
      return;
    }
    if (!scheduleFormData.start_time || !scheduleFormData.end_time) {
      setScheduleFormError('Start and end times are required');
      return;
    }
    if (scheduleFormData.start_time >= scheduleFormData.end_time) {
      setScheduleFormError('End time must be after start time');
      return;
    }

    setSavingSchedule(true);
    try {
      const scheduleData = {
        location_id: managingLocation.id,
        schedule_type: scheduleFormData.schedule_type,
        day_of_week: scheduleFormData.schedule_type === 'recurring'
          ? parseInt(scheduleFormData.day_of_week, 10)
          : null,
        specific_date: scheduleFormData.schedule_type === 'one_time'
          ? scheduleFormData.specific_date
          : null,
        start_time: scheduleFormData.start_time + ':00',
        end_time: scheduleFormData.end_time + ':00',
        max_orders: scheduleFormData.max_orders
          ? parseInt(scheduleFormData.max_orders, 10)
          : null,
        is_active: scheduleFormData.is_active
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('pickup_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pickup_schedules')
          .insert(scheduleData);
        if (error) throw error;
      }

      await fetchAllSchedules();
      handleCloseScheduleModal();
    } catch (err: any) {
      setScheduleFormError(err.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (schedule: PickupSchedule) => {
    const desc = formatScheduleDisplay(schedule);
    if (!confirm(`Are you sure you want to delete "${desc}"?`)) return;

    try {
      const { error } = await supabase
        .from('pickup_schedules')
        .delete()
        .eq('id', schedule.id);
      if (error) throw error;
      await fetchAllSchedules();
    } catch (err: any) {
      console.error('Error deleting schedule:', err);
    }
  };

  const handleToggleScheduleActive = async (schedule: PickupSchedule) => {
    try {
      const { error } = await supabase
        .from('pickup_schedules')
        .update({ is_active: !schedule.is_active })
        .eq('id', schedule.id);
      if (error) throw error;
      await fetchAllSchedules();
    } catch (err: any) {
      console.error('Error toggling schedule:', err);
    }
  };

  // Get schedules for the currently managing location
  const locationSchedulesList = managingLocation ? (allSchedules[managingLocation.id] || []) : [];
  const recurringSchedules = locationSchedulesList.filter(s => s.schedule_type === 'recurring');
  const oneTimeSchedules = locationSchedulesList.filter(s => s.schedule_type === 'one_time');

  if (locationsLoading) {
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
          <h2 className="text-lg font-semibold text-slate-800">Local Pickup</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage pickup locations and schedules for local customers
          </p>
        </div>
        <button
          onClick={() => handleOpenLocationModal()}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Location
        </button>
      </div>

      {locationsError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          {locationsError}
        </div>
      )}

      {/* Locations List */}
      {locations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">No Pickup Locations</h3>
          <p className="text-slate-500 mb-4">
            Add pickup locations where customers can collect their orders.
          </p>
          <button
            onClick={() => handleOpenLocationModal()}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            Add Your First Location
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
          <div className="divide-y divide-slate-100">
            {locations.map((location) => (
              <div
                key={location.id}
                draggable
                onDragStart={(e) => handleLocationDragStart(e, location)}
                onDragOver={handleLocationDragOver}
                onDrop={(e) => handleLocationDrop(e, location)}
                className={`p-4 hover:bg-slate-50 transition-colors ${
                  draggedLocation?.id === location.id ? 'opacity-50' : ''
                } ${!location.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Drag Handle */}
                  <div className="text-slate-400 cursor-grab active:cursor-grabbing mt-1">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                    </svg>
                  </div>

                  {/* Location Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-slate-800 font-medium">{location.name}</span>
                      {!location.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {location.address_line1}
                      {location.address_line2 && `, ${location.address_line2}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {location.city}, {location.state} {location.postal_code}
                    </p>

                    {/* Schedule Summary */}
                    <div className="mt-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {schedulesLoading ? (
                        <span className="text-sm text-slate-400">Loading...</span>
                      ) : (
                        <span className={`text-sm ${
                          getScheduleSummary(location.id) === 'No schedule'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}>
                          {getScheduleSummary(location.id)}
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenScheduleManageModal(location)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium ml-2"
                      >
                        Manage Schedule
                      </button>
                    </div>
                  </div>

                  {/* Toggle Active */}
                  <button
                    onClick={() => toggleLocationActive(location.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      location.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        location.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenLocationModal(location)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteLocation(location)}
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

      {/* Location Modal */}
      <AnimatePresence>
        {locationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseLocationModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                {editingLocation ? 'Edit Location' : 'Add Location'}
              </h2>

              {locationFormError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {locationFormError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Location Name *</label>
                  <input
                    type="text"
                    value={locationFormData.name}
                    onChange={e => setLocationFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., ATL Urban Farms - Cumming"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={locationFormData.address_line1}
                    onChange={e => setLocationFormData(f => ({ ...f, address_line1: e.target.value }))}
                    placeholder="123 Farm Road"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={locationFormData.address_line2}
                    onChange={e => setLocationFormData(f => ({ ...f, address_line2: e.target.value }))}
                    placeholder="Suite 100"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-slate-600 mb-1">City *</label>
                    <input
                      type="text"
                      value={locationFormData.city}
                      onChange={e => setLocationFormData(f => ({ ...f, city: e.target.value }))}
                      placeholder="Cumming"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-slate-600 mb-1">State *</label>
                    <select
                      value={locationFormData.state}
                      onChange={e => setLocationFormData(f => ({ ...f, state: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {US_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">ZIP *</label>
                    <input
                      type="text"
                      value={locationFormData.postal_code}
                      onChange={e => setLocationFormData(f => ({ ...f, postal_code: e.target.value }))}
                      placeholder="30041"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={locationFormData.phone}
                    onChange={e => setLocationFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(770) 555-0100"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Pickup Instructions</label>
                  <textarea
                    value={locationFormData.instructions}
                    onChange={e => setLocationFormData(f => ({ ...f, instructions: e.target.value }))}
                    placeholder="Park in the gravel lot behind the greenhouse. Ring the doorbell at the main entrance."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Shown to customers when they select this location</p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationFormData.is_active}
                    onChange={e => setLocationFormData(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">Active (visible to customers)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseLocationModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLocation}
                  disabled={savingLocation}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {savingLocation ? 'Saving...' : (editingLocation ? 'Update' : 'Create')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Management Modal */}
      <AnimatePresence>
        {scheduleManageModalOpen && managingLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseScheduleManageModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-2xl border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Schedule for {managingLocation.name}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {managingLocation.city}, {managingLocation.state}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenScheduleModal()}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Time Slot
                </button>
              </div>

              {locationSchedulesList.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 mb-4">
                    No schedules configured for this location.
                  </p>
                  <button
                    onClick={() => handleOpenScheduleModal()}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                  >
                    Add First Time Slot
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Recurring Schedules */}
                  {recurringSchedules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-2">Recurring (Weekly)</h4>
                      <div className="bg-slate-50 rounded-xl overflow-hidden divide-y divide-slate-100">
                        {recurringSchedules.map((schedule) => (
                          <ScheduleRow
                            key={schedule.id}
                            schedule={schedule}
                            onEdit={() => handleOpenScheduleModal(schedule)}
                            onDelete={() => handleDeleteSchedule(schedule)}
                            onToggle={() => handleToggleScheduleActive(schedule)}
                            formatDisplay={formatScheduleDisplay}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* One-time Schedules */}
                  {oneTimeSchedules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-2">One-Time Events</h4>
                      <div className="bg-slate-50 rounded-xl overflow-hidden divide-y divide-slate-100">
                        {oneTimeSchedules.map((schedule) => (
                          <ScheduleRow
                            key={schedule.id}
                            schedule={schedule}
                            onEdit={() => handleOpenScheduleModal(schedule)}
                            onDelete={() => handleDeleteSchedule(schedule)}
                            onToggle={() => handleToggleScheduleActive(schedule)}
                            formatDisplay={formatScheduleDisplay}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleCloseScheduleManageModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Edit Modal */}
      <AnimatePresence>
        {scheduleModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={handleCloseScheduleModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                {editingSchedule ? 'Edit Time Slot' : 'Add Time Slot'}
              </h2>

              {scheduleFormError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {scheduleFormError}
                </div>
              )}

              <div className="space-y-4">
                {/* Schedule Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Schedule Type</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="recurring"
                        checked={scheduleFormData.schedule_type === 'recurring'}
                        onChange={() => setScheduleFormData(f => ({ ...f, schedule_type: 'recurring' }))}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-600">Weekly (Recurring)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="one_time"
                        checked={scheduleFormData.schedule_type === 'one_time'}
                        onChange={() => setScheduleFormData(f => ({ ...f, schedule_type: 'one_time' }))}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-600">One-Time Event</span>
                    </label>
                  </div>
                </div>

                {/* Day of Week (for recurring) */}
                {scheduleFormData.schedule_type === 'recurring' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Day of Week</label>
                    <select
                      value={scheduleFormData.day_of_week}
                      onChange={e => setScheduleFormData(f => ({ ...f, day_of_week: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <option key={day} value={day}>{getDayName(day)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Specific Date (for one-time) */}
                {scheduleFormData.schedule_type === 'one_time' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Date *</label>
                    <input
                      type="date"
                      value={scheduleFormData.specific_date}
                      onChange={e => setScheduleFormData(f => ({ ...f, specific_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Start Time *</label>
                    <input
                      type="time"
                      value={scheduleFormData.start_time}
                      onChange={e => setScheduleFormData(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">End Time *</label>
                    <input
                      type="time"
                      value={scheduleFormData.end_time}
                      onChange={e => setScheduleFormData(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Max Orders */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Maximum Orders</label>
                  <input
                    type="number"
                    min="1"
                    value={scheduleFormData.max_orders}
                    onChange={e => setScheduleFormData(f => ({ ...f, max_orders: e.target.value }))}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Limit the number of orders per time slot</p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleFormData.is_active}
                    onChange={e => setScheduleFormData(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseScheduleModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {savingSchedule ? 'Saving...' : (editingSchedule ? 'Update' : 'Create')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Schedule Row Component
interface ScheduleRowProps {
  schedule: PickupSchedule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  formatDisplay: (schedule: PickupSchedule) => string;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({
  schedule,
  onEdit,
  onDelete,
  onToggle,
  formatDisplay
}) => (
  <div className={`p-4 hover:bg-slate-100 transition-colors ${!schedule.is_active ? 'opacity-60' : ''}`}>
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-slate-800 font-medium">{formatDisplay(schedule)}</span>
          {!schedule.is_active && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-500">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          {schedule.max_orders ? (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Max {schedule.max_orders} orders
            </span>
          ) : (
            <span className="text-emerald-600">Unlimited capacity</span>
          )}
        </div>
      </div>

      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          schedule.is_active ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            schedule.is_active ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>

      <button
        onClick={onEdit}
        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <button
        onClick={onDelete}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
);

export default ShippingPickupTab;
