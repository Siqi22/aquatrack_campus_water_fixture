-- One-time Riverstone High School cleanup.
--
-- Keeps the inventory currently named "River Stone High School", renames it
-- to "Riverstone High School", removes the older campus already using that
-- name, and clears lead-testing data for both inventories. The retained
-- fixtures are reset to Sampling Required.
--
-- Run the complete file in Supabase SQL Editor. All work is transactional;
-- an unexpected campus count or retained-fixture change aborts the operation.

BEGIN;

DO $$
DECLARE
  retained_campus_id UUID;
  old_campus_ids UUID[] := ARRAY[]::UUID[];
  affected_fixture_ids UUID[] := ARRAY[]::UUID[];
  affected_round_ids UUID[] := ARRAY[]::UUID[];
  affected_report_ids UUID[] := ARRAY[]::UUID[];
  retained_fixture_count_before INTEGER := 0;
  retained_fixture_count_after INTEGER := 0;
  retained_campus_count INTEGER := 0;
  old_campus_count INTEGER := 0;
  deleted_report_row_count INTEGER := 0;
  deleted_event_count INTEGER := 0;
  deleted_remediation_count INTEGER := 0;
  deleted_round_count INTEGER := 0;
BEGIN
  SELECT count(*)
  INTO retained_campus_count
  FROM public.campuses c
  WHERE c.organization_mode = 'school_district'
    AND lower(btrim(coalesce(nullif(c.school, ''), c.name))) =
        lower('River Stone High School');

  IF retained_campus_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one River Stone High School campus to retain; found %.',
      retained_campus_count;
  END IF;

  SELECT c.id
  INTO retained_campus_id
  FROM public.campuses c
  WHERE c.organization_mode = 'school_district'
    AND lower(btrim(coalesce(nullif(c.school, ''), c.name))) =
        lower('River Stone High School')
  LIMIT 1;

  SELECT coalesce(array_agg(c.id), ARRAY[]::UUID[]), count(*)
  INTO old_campus_ids, old_campus_count
  FROM public.campuses c
  WHERE c.organization_mode = 'school_district'
    AND lower(btrim(coalesce(nullif(c.school, ''), c.name))) =
        lower('Riverstone High School')
    AND c.id <> retained_campus_id;

  SELECT count(*)
  INTO retained_fixture_count_before
  FROM public.fixtures f
  WHERE f.campus_id = retained_campus_id;

  IF retained_fixture_count_before = 0 THEN
    RAISE EXCEPTION
      'The River Stone High School campus has no fixtures. Cleanup was cancelled.';
  END IF;

  SELECT coalesce(array_agg(f.id), ARRAY[]::UUID[])
  INTO affected_fixture_ids
  FROM public.fixtures f
  WHERE f.campus_id = retained_campus_id
     OR f.campus_id = ANY(old_campus_ids);

  SELECT coalesce(array_agg(r.id), ARRAY[]::UUID[])
  INTO affected_round_ids
  FROM public.lead_testing_rounds r
  WHERE r.fixture_id = ANY(affected_fixture_ids);

  SELECT coalesce(array_agg(DISTINCT report_id), ARRAY[]::UUID[])
  INTO affected_report_ids
  FROM (
    SELECT r.report_upload_id AS report_id
    FROM public.lead_testing_rounds r
    WHERE r.id = ANY(affected_round_ids)
      AND r.report_upload_id IS NOT NULL

    UNION

    SELECT rr.report_upload_id
    FROM public.lead_testing_report_rows rr
    WHERE rr.proposed_fixture_id = ANY(affected_fixture_ids)
       OR rr.confirmed_fixture_id = ANY(affected_fixture_ids)
       OR rr.imported_testing_round_id = ANY(affected_round_ids)
       OR lower(btrim(coalesce(rr.school_name, ''))) IN (
            lower('Riverstone High School'),
            lower('River Stone High School')
          )
  ) affected_reports
  WHERE report_id IS NOT NULL;

  -- Remove report rows first so deleted results do not return as unresolved
  -- matches on the Lead Testing dashboard.
  DELETE FROM public.lead_testing_report_rows rr
  WHERE rr.proposed_fixture_id = ANY(affected_fixture_ids)
     OR rr.confirmed_fixture_id = ANY(affected_fixture_ids)
     OR rr.imported_testing_round_id = ANY(affected_round_ids)
     OR lower(btrim(coalesce(rr.school_name, ''))) IN (
          lower('Riverstone High School'),
          lower('River Stone High School')
        );
  GET DIAGNOSTICS deleted_report_row_count = ROW_COUNT;

  DELETE FROM public.lead_testing_events e
  WHERE e.fixture_id = ANY(affected_fixture_ids)
     OR e.testing_round_id = ANY(affected_round_ids);
  GET DIAGNOSTICS deleted_event_count = ROW_COUNT;

  -- Remediation has a restrictive reference to its triggering round, so it
  -- must be deleted before the testing rounds.
  DELETE FROM public.remediation_records r
  WHERE r.fixture_id = ANY(affected_fixture_ids)
     OR r.triggering_testing_round_id = ANY(affected_round_ids)
     OR r.follow_up_testing_round_id = ANY(affected_round_ids);
  GET DIAGNOSTICS deleted_remediation_count = ROW_COUNT;

  UPDATE public.fixtures f
  SET
    current_lead_testing_status = 'not_started'::public.lead_testing_status,
    current_required_action = 'Sampling required',
    current_result_ppb = NULL,
    current_result_category = NULL,
    current_testing_round_id = NULL,
    fixture_availability_status =
      'available_for_consumption'::public.fixture_availability_status,
    lead_testing_last_updated_at = NULL
  WHERE f.id = ANY(affected_fixture_ids);

  DELETE FROM public.lead_testing_rounds r
  WHERE r.id = ANY(affected_round_ids);
  GET DIAGNOSTICS deleted_round_count = ROW_COUNT;

  -- Keep report metadata consistent. Fully emptied reports are soft-deleted
  -- and have their hashes cleared so the same file may be uploaded again.
  WITH report_stats AS (
    SELECT
      u.id,
      count(rr.id)::INTEGER AS total_rows,
      count(rr.id) FILTER (
        WHERE rr.imported_testing_round_id IS NOT NULL
           OR rr.match_status = 'imported'
      )::INTEGER AS imported_rows,
      count(rr.id) FILTER (
        WHERE rr.imported_testing_round_id IS NULL
          AND rr.match_status <> 'excluded'
      )::INTEGER AS unresolved_rows
    FROM public.lead_testing_report_uploads u
    LEFT JOIN public.lead_testing_report_rows rr
      ON rr.report_upload_id = u.id
     AND rr.deleted_at IS NULL
    WHERE u.id = ANY(affected_report_ids)
    GROUP BY u.id
  )
  UPDATE public.lead_testing_report_uploads u
  SET
    extracted_row_count = s.total_rows,
    matched_row_count = s.imported_rows,
    unresolved_row_count = s.unresolved_rows,
    processing_status = CASE
      WHEN s.total_rows = 0
        THEN 'failed'::public.report_processing_status
      WHEN s.unresolved_rows = 0
        THEN 'imported'::public.report_processing_status
      WHEN s.imported_rows > 0
        THEN 'partially_matched'::public.report_processing_status
      ELSE 'ready_for_review'::public.report_processing_status
    END,
    file_sha256 = CASE WHEN s.total_rows = 0 THEN NULL ELSE u.file_sha256 END,
    content_sha256 = CASE WHEN s.total_rows = 0 THEN NULL ELSE u.content_sha256 END,
    error_message = CASE
      WHEN s.total_rows = 0 THEN 'Testing data removed during Riverstone school cleanup.'
      ELSE NULL
    END,
    deleted_at = CASE WHEN s.total_rows = 0 THEN now() ELSE u.deleted_at END
  FROM report_stats s
  WHERE u.id = s.id;

  -- Deleting the old campus cascades to its buildings, fixtures, floor
  -- progress, and fixture maintenance archive.
  DELETE FROM public.campuses c
  WHERE c.id = ANY(old_campus_ids);

  UPDATE public.campuses c
  SET
    name = 'Riverstone High School',
    school = 'Riverstone High School'
  WHERE c.id = retained_campus_id;

  SELECT count(*)
  INTO retained_fixture_count_after
  FROM public.fixtures f
  WHERE f.campus_id = retained_campus_id;

  IF retained_fixture_count_after <> retained_fixture_count_before THEN
    RAISE EXCEPTION
      'Retained fixture count changed from % to %. Cleanup was rolled back.',
      retained_fixture_count_before,
      retained_fixture_count_after;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lead_testing_rounds r
    JOIN public.fixtures f ON f.id = r.fixture_id
    WHERE f.campus_id = retained_campus_id
  ) THEN
    RAISE EXCEPTION
      'Lead testing rounds remain for the retained Riverstone fixtures.';
  END IF;

  RAISE NOTICE
    'Riverstone cleanup complete: removed % old campus(es), retained % fixture(s), deleted % report row(s), % event(s), % remediation record(s), and % testing round(s).',
    old_campus_count,
    retained_fixture_count_after,
    deleted_report_row_count,
    deleted_event_count,
    deleted_remediation_count,
    deleted_round_count;
END
$$;

COMMIT;

-- Verification result: exactly one renamed school, retained fixture count,
-- and zero lead-testing rounds for those fixtures.
SELECT
  c.id AS campus_id,
  c.school_district,
  c.school AS school_name,
  count(DISTINCT f.id) AS fixture_count,
  count(DISTINCT r.id) AS lead_testing_round_count
FROM public.campuses c
LEFT JOIN public.fixtures f ON f.campus_id = c.id
LEFT JOIN public.lead_testing_rounds r ON r.fixture_id = f.id
WHERE c.organization_mode = 'school_district'
  AND lower(btrim(coalesce(nullif(c.school, ''), c.name))) =
      lower('Riverstone High School')
GROUP BY c.id, c.school_district, c.school;
