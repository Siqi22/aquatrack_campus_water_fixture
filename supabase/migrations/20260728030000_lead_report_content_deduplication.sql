-- Treat reports with the same extracted testing content as one report even
-- when the file name or binary representation differs.

ALTER TABLE public.lead_testing_report_uploads
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS lead_report_content_sha256_unique
  ON public.lead_testing_report_uploads(content_sha256)
  WHERE content_sha256 IS NOT NULL AND deleted_at IS NULL;

