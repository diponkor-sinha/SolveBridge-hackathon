DROP POLICY IF EXISTS "Read media of published problems" ON storage.objects;
DROP POLICY IF EXISTS "Read media of visible solutions" ON storage.objects;
CREATE POLICY "Solvers read own solution files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'solution-media' AND (storage.foldername(name))[1] = (select auth.uid()::text));