-- Migration: Add blog-media storage bucket for blog images
-- Created: 2026-02-21
-- Description: Creates a dedicated bucket for blog post images (featured + inline)

-- ============================================
-- 1. CREATE THE STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-media',
  'blog-media',
  true,  -- Public bucket for blog images
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. STORAGE POLICIES
-- ============================================

-- Allow public read access to all blog media
DROP POLICY IF EXISTS "Public read access for blog media" ON storage.objects;
CREATE POLICY "Public read access for blog media" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'blog-media');

-- Allow authenticated admins to upload blog media
DROP POLICY IF EXISTS "Admin upload access for blog media" ON storage.objects;
CREATE POLICY "Admin upload access for blog media" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to update blog media
DROP POLICY IF EXISTS "Admin update access for blog media" ON storage.objects;
CREATE POLICY "Admin update access for blog media" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to delete blog media
DROP POLICY IF EXISTS "Admin delete access for blog media" ON storage.objects;
CREATE POLICY "Admin delete access for blog media" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );
