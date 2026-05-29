DROP POLICY IF EXISTS "Public read product images" ON storage.objects;

-- Allow only admin/support to list objects in product-images.
-- Public viewing still works via the public bucket's CDN URLs (getPublicUrl),
-- which do not require a SELECT policy on storage.objects.
CREATE POLICY "Admin/support list product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
);