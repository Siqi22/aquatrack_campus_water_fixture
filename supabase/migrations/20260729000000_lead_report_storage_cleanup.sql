-- Allow users to remove their own temporary PDF upload when content
-- deduplication determines that the report already exists.

CREATE POLICY "Authenticated delete own lead reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-testing-reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
