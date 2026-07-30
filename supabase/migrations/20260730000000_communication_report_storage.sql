-- Private persistence for the independently deployed Water Quality Reporter.

CREATE TABLE IF NOT EXISTS public.communication_generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  fixture_ids UUID[] NOT NULL DEFAULT '{}',
  school_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_upload_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_generated_reports_created_by_idx
  ON public.communication_generated_reports (created_by, created_at DESC);

ALTER TABLE public.communication_generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own communication reports"
  ON public.communication_generated_reports;
CREATE POLICY "Users read own communication reports"
  ON public.communication_generated_reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users create own communication reports"
  ON public.communication_generated_reports;
CREATE POLICY "Users create own communication reports"
  ON public.communication_generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND (
      campus_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.campuses campus
        WHERE campus.id = campus_id
          AND campus.created_by = (SELECT auth.uid())
      )
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-reports', 'communication-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own communication files" ON storage.objects;
CREATE POLICY "Users upload own communication files"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users update own communication files" ON storage.objects;
CREATE POLICY "Users update own communication files"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'communication-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users read own communication files" ON storage.objects;
CREATE POLICY "Users read own communication files"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users delete own communication files" ON storage.objects;
CREATE POLICY "Users delete own communication files"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'communication-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
