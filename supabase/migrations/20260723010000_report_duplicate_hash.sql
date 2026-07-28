ALTER TABLE public.lead_testing_report_uploads ADD COLUMN IF NOT EXISTS file_sha256 TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS lead_report_file_sha256_unique
  ON public.lead_testing_report_uploads(file_sha256)
  WHERE file_sha256 IS NOT NULL AND deleted_at IS NULL;
