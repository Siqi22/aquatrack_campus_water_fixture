-- Remove every unresolved lead-report match without touching imported results.
-- Safe to run more than once.

BEGIN;

DELETE FROM public.lead_testing_report_rows
WHERE imported_testing_round_id IS NULL
  AND user_confirmed = false
  AND match_status <> 'excluded'::public.report_match_status
  AND deleted_at IS NULL;

UPDATE public.lead_testing_report_uploads AS upload
SET
  unresolved_row_count = (
    SELECT count(*)::integer
    FROM public.lead_testing_report_rows AS report_row
    WHERE report_row.report_upload_id = upload.id
      AND report_row.imported_testing_round_id IS NULL
      AND report_row.user_confirmed = false
      AND report_row.match_status <> 'excluded'::public.report_match_status
      AND report_row.deleted_at IS NULL
  ),
  processing_status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.lead_testing_report_rows AS imported_row
      WHERE imported_row.report_upload_id = upload.id
        AND imported_row.imported_testing_round_id IS NOT NULL
        AND imported_row.deleted_at IS NULL
    )
      THEN 'imported'::public.report_processing_status
    ELSE upload.processing_status
  END;

COMMIT;

SELECT count(*) AS unresolved_matches_remaining
FROM public.lead_testing_report_rows
WHERE imported_testing_round_id IS NULL
  AND user_confirmed = false
  AND match_status <> 'excluded'::public.report_match_status
  AND deleted_at IS NULL;
