import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface PickupSchedule {
  id: string;
  location_id: string;
  schedule_type: 'recurring' | 'one_time';
  day_of_week: number | null; // 0-6 (Sunday-Saturday)
  specific_date: string | null; // ISO date string for one_time
  start_time: string; // HH:MM:SS
  end_time: string;
  max_orders: number | null; // null = unlimited
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PickupSlot {
  schedule_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_orders: number | null;
  current_count: number;
  slots_available: number;
}

export type PickupScheduleInput = Omit<PickupSchedule, 'id' | 'created_at' | 'updated_at'>;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function usePickupSchedules(locationId?: string) {
  const [schedules, setSchedules] = useState<PickupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    if (!locationId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('pickup_schedules')
        .select('*')
        .eq('location_id', locationId)
        .order('day_of_week', { ascending: true, nullsFirst: false })
        .order('specific_date', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setSchedules(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pickup schedules');
      console.error('Error fetching pickup schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const createSchedule = useCallback(async (scheduleData: PickupScheduleInput) => {
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('pickup_schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchSchedules();
      return { success: true, data };
    } catch (err: any) {
      setError(err.message || 'Failed to create schedule');
      return { success: false, error: err.message };
    }
  }, [fetchSchedules]);

  const updateSchedule = useCallback(async (
    id: string,
    updates: Partial<PickupScheduleInput>
  ) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('pickup_schedules')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchSchedules();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule');
      return { success: false, error: err.message };
    }
  }, [fetchSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('pickup_schedules')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSchedules(prev => prev.filter(s => s.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to delete schedule');
      return { success: false, error: err.message };
    }
  }, []);

  const toggleActive = useCallback(async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return { success: false, error: 'Schedule not found' };

    return updateSchedule(id, { is_active: !schedule.is_active });
  }, [schedules, updateSchedule]);

  // Get available slots for a location within a date range
  const getAvailableSlots = useCallback(async (
    locId: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; slots?: PickupSlot[]; error?: string }> => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_available_pickup_slots', {
          p_location_id: locId,
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (rpcError) throw rpcError;
      return { success: true, slots: data || [] };
    } catch (err: any) {
      console.error('Error getting available slots:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Helper: format schedule for display
  const formatScheduleDisplay = (schedule: PickupSchedule): string => {
    const startTime = formatTime(schedule.start_time);
    const endTime = formatTime(schedule.end_time);

    if (schedule.schedule_type === 'recurring') {
      const dayName = DAY_NAMES[schedule.day_of_week ?? 0];
      return `Every ${dayName} ${startTime} - ${endTime}`;
    } else {
      const date = new Date(schedule.specific_date + 'T00:00:00');
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return `${dateStr} ${startTime} - ${endTime}`;
    }
  };

  // Group schedules by type
  const recurringSchedules = schedules.filter(s => s.schedule_type === 'recurring');
  const oneTimeSchedules = schedules.filter(s => s.schedule_type === 'one_time');

  return {
    schedules,
    recurringSchedules,
    oneTimeSchedules,
    loading,
    error,
    refetch: fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    getAvailableSlots,
    formatScheduleDisplay,
    DAY_NAMES
  };
}

// Helper function to format time for display
export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Helper function to get day name
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || '';
}
