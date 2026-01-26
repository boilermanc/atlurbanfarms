-- Migration: Add product-images storage bucket
-- Created: 2026-01-25
-- Description: Creates the product-images storage bucket for product and category images

-- ============================================
-- 1. CREATE THE STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- Public bucket for product/category images
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. STORAGE POLICIES
-- ============================================

-- Allow public read access to all images
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
CREATE POLICY "Public read access for product images" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Allow authenticated admins to upload images
DROP POLICY IF EXISTS "Admin upload access for product images" ON storage.objects;
CREATE POLICY "Admin upload access for product images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to update images
DROP POLICY IF EXISTS "Admin update access for product images" ON storage.objects;
CREATE POLICY "Admin update access for product images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );

-- Allow authenticated admins to delete images
DROP POLICY IF EXISTS "Admin delete access for product images" ON storage.objects;
CREATE POLICY "Admin delete access for product images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_user_roles
      WHERE customer_id = auth.uid() AND is_active = true
    )
  );
