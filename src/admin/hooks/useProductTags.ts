import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  tag_type: string | null;
  created_at: string;
}

export const useProductTags = () => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('product_tags')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  };

  return { tags, loading, error, refetch: fetchTags };
};
