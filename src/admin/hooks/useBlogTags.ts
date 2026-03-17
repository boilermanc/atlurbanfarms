import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export const useBlogTags = () => {
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('blog_tags')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err) {
      console.error('Error fetching blog tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch blog tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(async (name: string) => {
    setError(null);
    try {
      const slug = generateSlug(name);
      const { data, error: insertError } = await supabase
        .from('blog_tags')
        .insert({ name: name.trim(), slug })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchTags();
      return { success: true, data };
    } catch (err: any) {
      setError(err.message || 'Failed to create tag');
      return { success: false, error: err.message };
    }
  }, [fetchTags]);

  const deleteTag = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('blog_tags')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setTags(prev => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to delete tag');
      return { success: false, error: err.message };
    }
  }, []);

  return { tags, loading, error, refetch: fetchTags, createTag, deleteTag };
};

/** Hook to manage tags assigned to a specific blog post */
export const useBlogPostTags = (postId: string | null) => {
  const [postTags, setPostTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPostTags = useCallback(async () => {
    if (!postId) {
      setPostTags([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_post_tags')
        .select('tag_id, blog_tags ( id, name, slug, created_at )')
        .eq('blog_post_id', postId);

      if (error) throw error;
      const tags = (data || [])
        .map((row: any) => row.blog_tags)
        .filter(Boolean)
        .sort((a: BlogTag, b: BlogTag) => a.name.localeCompare(b.name));
      setPostTags(tags);
    } catch (err) {
      console.error('Error fetching post tags:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPostTags();
  }, [fetchPostTags]);

  const addTagToPost = useCallback(async (tagId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase
        .from('blog_post_tags')
        .insert({ blog_post_id: postId, tag_id: tagId });

      if (error) throw error;
      await fetchPostTags();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [postId, fetchPostTags]);

  const removeTagFromPost = useCallback(async (tagId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase
        .from('blog_post_tags')
        .delete()
        .eq('blog_post_id', postId)
        .eq('tag_id', tagId);

      if (error) throw error;
      setPostTags(prev => prev.filter(t => t.id !== tagId));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [postId, fetchPostTags]);

  const setPostTagIds = useCallback(async (tagIds: string[]) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('blog_post_tags')
        .delete()
        .eq('blog_post_id', postId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (tagIds.length > 0) {
        const { error: insertError } = await supabase
          .from('blog_post_tags')
          .insert(tagIds.map(tag_id => ({ blog_post_id: postId, tag_id })));

        if (insertError) throw insertError;
      }

      await fetchPostTags();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [postId, fetchPostTags]);

  return { postTags, loading, refetch: fetchPostTags, addTagToPost, removeTagFromPost, setPostTagIds };
};
