-- Create storage bucket for receipt images
-- This allows users to upload transaction receipt images

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload receipt images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to view their own images
CREATE POLICY "Users can view receipt images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete receipt images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update receipt images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');
