
-- Make bucket non-public; require auth to read
UPDATE storage.buckets SET public = false WHERE id = 'fixture-photos';

DROP POLICY IF EXISTS "Public read fixture photos" ON storage.objects;

CREATE POLICY "Auth read fixture photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fixture-photos');
