import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

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
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PickupLocationInput = Omit<PickupLocation, 'id' | 'created_at' | 'updated_at'>;

export function usePickupLocations() {
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('pickup_locations')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setLocations(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pickup locations');
      console.error('Error fetching pickup locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const createLocation = useCallback(async (locationData: PickupLocationInput) => {
    setError(null);
    try {
      const maxOrder = locations.length > 0
        ? Math.max(...locations.map(l => l.sort_order))
        : 0;

      const { data, error: insertError } = await supabase
        .from('pickup_locations')
        .insert({
          ...locationData,
          sort_order: locationData.sort_order || maxOrder + 1
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchLocations();
      return { success: true, data };
    } catch (err: any) {
      setError(err.message || 'Failed to create location');
      return { success: false, error: err.message };
    }
  }, [locations, fetchLocations]);

  const updateLocation = useCallback(async (
    id: string,
    updates: Partial<PickupLocationInput>
  ) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('pickup_locations')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchLocations();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update location');
      return { success: false, error: err.message };
    }
  }, [fetchLocations]);

  const deleteLocation = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('pickup_locations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setLocations(prev => prev.filter(l => l.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to delete location');
      return { success: false, error: err.message };
    }
  }, []);

  const reorderLocations = useCallback(async (reorderedLocations: PickupLocation[]) => {
    try {
      const updates = reorderedLocations.map((loc, index) => ({
        id: loc.id,
        sort_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('pickup_locations')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setLocations(reorderedLocations.map((loc, index) => ({
        ...loc,
        sort_order: index + 1
      })));
      return { success: true };
    } catch (err: any) {
      await fetchLocations(); // Revert on error
      return { success: false, error: err.message };
    }
  }, [fetchLocations]);

  const toggleActive = useCallback(async (id: string) => {
    const location = locations.find(l => l.id === id);
    if (!location) return { success: false, error: 'Location not found' };

    return updateLocation(id, { is_active: !location.is_active });
  }, [locations, updateLocation]);

  return {
    locations,
    activeLocations: locations.filter(l => l.is_active),
    loading,
    error,
    refetch: fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    reorderLocations,
    toggleActive
  };
}
