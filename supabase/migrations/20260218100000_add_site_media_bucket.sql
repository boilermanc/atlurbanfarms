-- Migration: Add site-media storage bucket for video and large media uploads
-- Created: 2026-02-18
-- Description: Creates a separate bucket for site-level media (videos, large assets)

-- ============================================
-- 1. CREATE THE STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,  -- Public bucket for site media
  104857600,  -- 100MB limit
  ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. STORAGE POLICIES
-- ============================================

-- Allow public read access to all site media
DROP POLICY IF EXISTS "Public read access for site media" ON storage.objects;
CREATE POLICY "Public read access for site media" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'site-media');

-- Allow authenticated admins to upload site media
DROP POLICY IF EXISTS "Admin upload access for site media" ON storage.objects;
CREATE POLICY "Admin upload access for site media" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to update site media
DROP POLICY IF EXISTS "Admin update access for site media" ON storage.objects;
CREATE POLICY "Admin update access for site media" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to delete site media
DROP POLICY IF EXISTS "Admin delete access for site media" ON storage.objects;
CREATE POLICY "Admin delete access for site media" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );
