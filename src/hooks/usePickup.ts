import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PickupLocation {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  instructions?: string;
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

export interface PickupSelection {
  locationId: string;
  location: PickupLocation;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Hook for fetching active pickup locations (customer-facing)
 */
export function usePickupLocations() {
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocations() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('pickup_locations')
          .select('id, name, address_line1, address_line2, city, state, postal_code, phone, instructions')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (fetchError) throw fetchError;
        setLocations(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load pickup locations');
        console.error('Error fetching pickup locations:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLocations();
  }, []);

  return { locations, loading, error };
}

/**
 * Hook for fetching available pickup slots for a location
 */
export function useAvailablePickupSlots(
  locationId: string | null,
  startDate?: string,
  endDate?: string
) {
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!locationId) {
      setSlots([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Default to next 14 days if no dates provided
      // Require 3-day lead time for order preparation (farm needs time to pull orders)
      const today = new Date();
      const LEAD_TIME_DAYS = 3;
      const minPickupDate = new Date(today.getTime() + LEAD_TIME_DAYS * 24 * 60 * 60 * 1000);
      const start = startDate || minPickupDate.toISOString().split('T')[0];
      const end = endDate || new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error: rpcError } = await supabase
        .rpc('get_available_pickup_slots', {
          p_location_id: locationId,
          p_start_date: start,
          p_end_date: end
        });

      if (rpcError) throw rpcError;

      // Filter out past slots for today
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
      const todayStr = now.toISOString().split('T')[0];

      const availableSlots = (data || []).filter((slot: PickupSlot) => {
        // If slot is today, check if it hasn't passed yet
        if (slot.slot_date === todayStr) {
          return slot.end_time > currentTime;
        }
        return true;
      });

      // Sort by date then by start time
      availableSlots.sort((a: PickupSlot, b: PickupSlot) => {
        if (a.slot_date !== b.slot_date) {
          return a.slot_date.localeCompare(b.slot_date);
        }
        return a.start_time.localeCompare(b.start_time);
      });

      setSlots(availableSlots);
    } catch (err: any) {
      setError(err.message || 'Failed to load available slots');
      console.error('Error fetching pickup slots:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId, startDate, endDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, loading, error, refetch: fetchSlots };
}

/**
 * Helper function to format time for display
 */
export function formatPickupTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Helper function to format date for display
 */
export function formatPickupDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Helper to group slots by date
 */
export function groupSlotsByDate(slots: PickupSlot[]): Map<string, PickupSlot[]> {
  const grouped = new Map<string, PickupSlot[]>();

  for (const slot of slots) {
    const existing = grouped.get(slot.slot_date) || [];
    existing.push(slot);
    grouped.set(slot.slot_date, existing);
  }

  return grouped;
}

/**
 * Format full pickup info for display
 */
export function formatPickupSummary(
  location: PickupLocation,
  date: string,
  startTime: string,
  endTime: string
): string {
  const dateStr = formatPickupDate(date);
  const timeRange = `${formatPickupTime(startTime)} - ${formatPickupTime(endTime)}`;
  return `${location.name} - ${dateStr}, ${timeRange}`;
}
