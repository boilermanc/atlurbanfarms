import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface ShippingPackage {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  empty_weight: number;
  min_quantity: number;
  max_quantity: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useShippingPackages() {
  const [packages, setPackages] = useState<ShippingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('shipping_packages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setPackages(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch packages');
      console.error('Error fetching shipping packages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const createPackage = useCallback(async (
    packageData: Omit<ShippingPackage, 'id' | 'created_at' | 'updated_at'>
  ) => {
    setError(null);
    try {
      // If setting as default, unset other defaults first
      if (packageData.is_default) {
        await supabase
          .from('shipping_packages')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const maxOrder = packages.length > 0
        ? Math.max(...packages.map(p => p.sort_order))
        : 0;

      const { data, error: insertError } = await supabase
        .from('shipping_packages')
        .insert({
          ...packageData,
          sort_order: packageData.sort_order || maxOrder + 1
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchPackages();
      return { success: true, data };
    } catch (err: any) {
      setError(err.message || 'Failed to create package');
      return { success: false, error: err.message };
    }
  }, [packages, fetchPackages]);

  const updatePackage = useCallback(async (
    id: string,
    updates: Partial<Omit<ShippingPackage, 'id' | 'created_at' | 'updated_at'>>
  ) => {
    setError(null);
    try {
      // If setting as default, unset other defaults first
      if (updates.is_default) {
        await supabase
          .from('shipping_packages')
          .update({ is_default: false })
          .neq('id', id);
      }

      const { error: updateError } = await supabase
        .from('shipping_packages')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchPackages();
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update package');
      return { success: false, error: err.message };
    }
  }, [fetchPackages]);

  const deletePackage = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('shipping_packages')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setPackages(prev => prev.filter(p => p.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
      return { success: false, error: err.message };
    }
  }, []);

  const reorderPackages = useCallback(async (reorderedPackages: ShippingPackage[]) => {
    try {
      const updates = reorderedPackages.map((pkg, index) => ({
        id: pkg.id,
        sort_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('shipping_packages')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setPackages(reorderedPackages.map((pkg, index) => ({
        ...pkg,
        sort_order: index + 1
      })));
      return { success: true };
    } catch (err: any) {
      await fetchPackages(); // Revert on error
      return { success: false, error: err.message };
    }
  }, [fetchPackages]);

  // Get appropriate package for a given quantity
  const getPackageForQuantity = useCallback((quantity: number): ShippingPackage | null => {
    const activePackages = packages.filter(p => p.is_active);

    // Find package where quantity fits in range
    const matchingPackage = activePackages.find(
      p => quantity >= p.min_quantity && quantity <= p.max_quantity
    );

    if (matchingPackage) return matchingPackage;

    // Fallback to default package
    const defaultPackage = activePackages.find(p => p.is_default);
    if (defaultPackage) return defaultPackage;

    // Fallback to largest package
    return activePackages.sort((a, b) => b.max_quantity - a.max_quantity)[0] || null;
  }, [packages]);

  // Validate quantity ranges don't overlap
  const validateQuantityRanges = useCallback((
    newPackage: Pick<ShippingPackage, 'min_quantity' | 'max_quantity'>,
    excludeId?: string
  ): { valid: boolean; message?: string } => {
    const activePackages = packages
      .filter(p => p.is_active && p.id !== excludeId);

    for (const pkg of activePackages) {
      // Check for overlap: ranges overlap if one starts before the other ends
      const overlaps =
        (newPackage.min_quantity <= pkg.max_quantity && newPackage.max_quantity >= pkg.min_quantity);

      if (overlaps) {
        return {
          valid: false,
          message: `Quantity range overlaps with "${pkg.name}" (${pkg.min_quantity}-${pkg.max_quantity})`
        };
      }
    }

    return { valid: true };
  }, [packages]);

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
    createPackage,
    updatePackage,
    deletePackage,
    reorderPackages,
    getPackageForQuantity,
    validateQuantityRanges
  };
}
