-- Fix storage bucket access policies
-- Allow public (anon) access to read images from the public bucket

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view receipt images" ON storage.objects;

-- Create new policy that allows public read access
CREATE POLICY "Public can view receipt images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Keep upload restricted to authenticated users
-- (existing policy "Users can upload receipt images" is fine)

-- Keep delete restricted to authenticated users
-- (existing policy "Users can delete receipt images" is fine)

-- Keep update restricted to authenticated users
-- (existing policy "Users can update receipt images" is fine)
