-- Continuous lead-testing demo history for the 51 North Valley fixtures.
-- Prerequisites:
--   20260721000000_lead_testing_workflow.sql
--   20260724010000_fix_lead_summary_category_ambiguity.sql
--   20260728010000_school_district_dummy_data.sql
--
-- Final fixture distribution:
--   22 complete, 6 remediation required, 2 immediate restriction,
--   2 awaiting post-remediation retest, 5 awaiting results,
--   and 14 awaiting initial sampling.

DO $$
DECLARE
  owner_id UUID;
  report_id UUID := md5('aquatrack-north-valley-demo-lead-report')::uuid;
  seeded_fixture_count INTEGER;
BEGIN
  SELECT c.created_by
  INTO owner_id
  FROM public.campuses c
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district'
  ORDER BY c.created_at
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Run 20260728010000_school_district_dummy_data.sql before this migration.';
  END IF;

  DROP TABLE IF EXISTS seed_north_valley_lead_fixtures;
  CREATE TEMP TABLE seed_north_valley_lead_fixtures ON COMMIT DROP AS
  SELECT
    f.id AS fixture_id,
    f.serial_number,
    f.floor,
    f.nearest_room,
    f.category::text AS fixture_type,
    c.school,
    b.name AS building_name,
    row_number() OVER (ORDER BY f.serial_number, f.id)::integer AS fixture_rank
  FROM public.fixtures f
  JOIN public.campuses c ON c.id = f.campus_id
  JOIN public.buildings b ON b.id = f.building_id
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district';

  SELECT count(*) INTO seeded_fixture_count
  FROM seed_north_valley_lead_fixtures;

  IF seeded_fixture_count <> 51 THEN
    RAISE EXCEPTION
      'Expected 51 North Valley fixtures, found %. Run the inventory seed first.',
      seeded_fixture_count;
  END IF;

  ALTER TABLE seed_north_valley_lead_fixtures
    ADD COLUMN result_ppb NUMERIC;

  UPDATE seed_north_valley_lead_fixtures
  SET result_ppb = CASE
    WHEN fixture_rank BETWEEN 1 AND 22 THEN
      (ARRAY[0.350, 0.720, 1.100, 1.850, 2.400, 3.150, 3.900, 4.600, 5.000])[
        ((fixture_rank - 1) % 9) + 1
      ]
    WHEN fixture_rank BETWEEN 23 AND 28 THEN
      (ARRAY[5.700, 7.250, 8.900, 10.400, 12.850, 14.600])[fixture_rank - 22]
    WHEN fixture_rank BETWEEN 29 AND 30 THEN
      (ARRAY[22.700, 31.500])[fixture_rank - 28]
    WHEN fixture_rank = 31 THEN 9.350
    WHEN fixture_rank = 32 THEN 18.200
    ELSE NULL
  END;

  INSERT INTO public.lead_testing_report_uploads (
    id,
    file_name,
    file_url,
    file_type,
    file_sha256,
    uploaded_by,
    uploaded_at,
    district_or_organization,
    laboratory_name,
    report_date,
    processing_status,
    extracted_row_count,
    matched_row_count,
    unresolved_row_count
  )
  VALUES (
    report_id,
    'north-valley-demo-lead-results.csv',
    'seed/north-valley-demo-lead-results.csv',
    'csv',
    md5('north-valley-demo-lead-results-v1'),
    owner_id,
    '2026-04-10 09:00:00-07',
    'North Valley School District',
    'Regional Water Quality Laboratory',
    DATE '2026-04-09',
    'imported',
    32,
    32,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    uploaded_by = EXCLUDED.uploaded_by,
    processing_status = EXCLUDED.processing_status,
    extracted_row_count = EXCLUDED.extracted_row_count,
    matched_row_count = EXCLUDED.matched_row_count,
    unresolved_row_count = EXCLUDED.unresolved_row_count;

  -- Ranks 1–32 have laboratory results. Ranks 33–37 have been sampled and
  -- are waiting for the laboratory. Each fixture keeps its own round history.
  INSERT INTO public.lead_testing_rounds (
    id,
    fixture_id,
    round_type,
    round_number,
    status,
    sample_id,
    sample_drawn_at,
    sample_draw_date,
    sample_collector_name,
    sampling_method,
    result_value,
    result_original_unit,
    result_received_at,
    report_upload_id,
    report_row_reference,
    matching_method,
    matching_confidence,
    notes,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    md5('north-valley-demo-lead-round-1-' || fixture_id::text)::uuid,
    fixture_id,
    'initial_test'::public.lead_round_type,
    1,
    CASE
      WHEN fixture_rank <= 32 THEN 'results_received'::public.lead_testing_status
      ELSE 'awaiting_results'::public.lead_testing_status
    END,
    'NVSD-S-' || lpad(fixture_rank::text, 3, '0'),
    (DATE '2026-03-03' + ((fixture_rank - 1) % 18))::timestamp + TIME '09:00',
    DATE '2026-03-03' + ((fixture_rank - 1) % 18),
    'North Valley Facilities Team',
    'First Draw (250 mL)',
    CASE WHEN result_ppb IS NULL THEN NULL ELSE result_ppb::text END,
    CASE WHEN result_ppb IS NULL THEN NULL ELSE 'ppb' END,
    CASE
      WHEN result_ppb IS NULL THEN NULL
      ELSE (DATE '2026-03-10' + ((fixture_rank - 1) % 18))::timestamp + TIME '14:00'
    END,
    CASE WHEN result_ppb IS NULL THEN NULL ELSE report_id END,
    CASE WHEN result_ppb IS NULL THEN NULL ELSE 'Row ' || fixture_rank END,
    CASE WHEN result_ppb IS NULL THEN NULL ELSE 'Demo exact fixture match' END,
    CASE WHEN result_ppb IS NULL THEN NULL ELSE 1 END,
    'Fictional demonstration record.',
    owner_id,
    (DATE '2026-03-03' + ((fixture_rank - 1) % 18))::timestamp + TIME '09:00',
    (DATE '2026-03-03' + ((fixture_rank - 1) % 18))::timestamp + TIME '09:00'
  FROM seed_north_valley_lead_fixtures
  WHERE fixture_rank <= 37
  ON CONFLICT (fixture_id, round_number) DO UPDATE SET
    sample_id = EXCLUDED.sample_id,
    sample_drawn_at = EXCLUDED.sample_drawn_at,
    sample_draw_date = EXCLUDED.sample_draw_date,
    sample_collector_name = EXCLUDED.sample_collector_name,
    sampling_method = EXCLUDED.sampling_method,
    result_value = EXCLUDED.result_value,
    result_original_unit = EXCLUDED.result_original_unit,
    result_received_at = EXCLUDED.result_received_at,
    report_upload_id = EXCLUDED.report_upload_id,
    report_row_reference = EXCLUDED.report_row_reference,
    matching_method = EXCLUDED.matching_method,
    matching_confidence = EXCLUDED.matching_confidence,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.lead_testing_report_rows (
    id,
    report_upload_id,
    row_number,
    raw_text_or_raw_data,
    sample_id,
    school_district,
    school_name,
    building_name,
    room,
    fixture_description,
    fixture_type,
    sample_date,
    result_value,
    result_unit,
    normalized_result_ppb,
    proposed_fixture_id,
    confirmed_fixture_id,
    match_status,
    match_confidence,
    match_reasons,
    user_confirmed,
    imported_testing_round_id,
    notes
  )
  SELECT
    md5('north-valley-demo-report-row-' || fixture_rank)::uuid,
    report_id,
    fixture_rank,
    jsonb_build_object(
      'School', school,
      'Building', building_name,
      'Floor', floor,
      'Fixture', nearest_room,
      'Sample ID', 'NVSD-S-' || lpad(fixture_rank::text, 3, '0'),
      'Lead Result', result_ppb,
      'Unit', 'ppb'
    ),
    'NVSD-S-' || lpad(fixture_rank::text, 3, '0'),
    'North Valley School District',
    school,
    building_name,
    nearest_room,
    nearest_room,
    fixture_type,
    DATE '2026-03-03' + ((fixture_rank - 1) % 18),
    result_ppb::text,
    'ppb',
    result_ppb,
    fixture_id,
    fixture_id,
    'imported',
    1,
    ARRAY['School, building, floor, location, and fixture type matched'],
    true,
    md5('north-valley-demo-lead-round-1-' || fixture_id::text)::uuid,
    'Fictional demonstration row.'
  FROM seed_north_valley_lead_fixtures
  WHERE fixture_rank <= 32
  ON CONFLICT (report_upload_id, row_number) DO UPDATE SET
    raw_text_or_raw_data = EXCLUDED.raw_text_or_raw_data,
    confirmed_fixture_id = EXCLUDED.confirmed_fixture_id,
    match_status = EXCLUDED.match_status,
    user_confirmed = EXCLUDED.user_confirmed,
    imported_testing_round_id = EXCLUDED.imported_testing_round_id,
    normalized_result_ppb = EXCLUDED.normalized_result_ppb;

  -- Results over 5 ppb continue into remediation. Ranks 31–32 have completed
  -- remediation and are now waiting for a new post-remediation testing round.
  INSERT INTO public.remediation_records (
    id,
    fixture_id,
    triggering_testing_round_id,
    remediation_type,
    status,
    description,
    target_date,
    started_at,
    completed_at,
    responsible_person,
    contractor_or_company,
    manufacturer,
    product_name,
    model,
    installation_date,
    notes,
    retest_required,
    conditioning_status,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    md5('north-valley-demo-remediation-' || fixture_id::text)::uuid,
    fixture_id,
    md5('north-valley-demo-lead-round-1-' || fixture_id::text)::uuid,
    CASE
      WHEN fixture_rank IN (29, 30, 32) THEN 'replace_fixture'::public.remediation_type
      ELSE 'fixture_conditioning'::public.remediation_type
    END,
    CASE
      WHEN fixture_rank >= 31 THEN 'awaiting_retest'::public.remediation_status
      ELSE 'planned'::public.remediation_status
    END,
    CASE
      WHEN fixture_rank IN (29, 30, 32) THEN 'Replace the affected outlet and inspect the supply connection.'
      ELSE 'Condition the fixture and complete targeted flushing.'
    END,
    DATE '2026-04-30',
    CASE WHEN fixture_rank >= 31 THEN '2026-03-24 08:30:00-07'::timestamptz ELSE NULL END,
    CASE WHEN fixture_rank >= 31 THEN '2026-03-29 15:30:00-07'::timestamptz ELSE NULL END,
    'Jordan Lee',
    CASE WHEN fixture_rank IN (29, 30, 32) THEN 'North Valley Plumbing Services' ELSE NULL END,
    CASE WHEN fixture_rank IN (29, 30, 32) THEN 'Demo Water Systems' ELSE NULL END,
    CASE WHEN fixture_rank IN (29, 30, 32) THEN 'Lead-Free Replacement Outlet' ELSE NULL END,
    CASE WHEN fixture_rank IN (29, 30, 32) THEN 'LF-250' ELSE NULL END,
    CASE WHEN fixture_rank >= 31 THEN DATE '2026-03-29' ELSE NULL END,
    'Fictional remediation record for workflow demonstration.',
    true,
    CASE
      WHEN fixture_rank >= 31 THEN 'completed'::public.conditioning_status
      ELSE 'not_started'::public.conditioning_status
    END,
    owner_id,
    '2026-03-21 10:00:00-07'::timestamptz,
    CASE
      WHEN fixture_rank >= 31 THEN '2026-03-29 15:30:00-07'::timestamptz
      ELSE '2026-03-21 10:00:00-07'::timestamptz
    END
  FROM seed_north_valley_lead_fixtures
  WHERE fixture_rank BETWEEN 23 AND 32
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    description = EXCLUDED.description,
    target_date = EXCLUDED.target_date,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    responsible_person = EXCLUDED.responsible_person,
    contractor_or_company = EXCLUDED.contractor_or_company,
    manufacturer = EXCLUDED.manufacturer,
    product_name = EXCLUDED.product_name,
    model = EXCLUDED.model,
    installation_date = EXCLUDED.installation_date,
    notes = EXCLUDED.notes,
    retest_required = EXCLUDED.retest_required,
    conditioning_status = EXCLUDED.conditioning_status,
    updated_at = EXCLUDED.updated_at;

  -- Store a readable, ordered event history. Deterministic IDs make reruns safe.
  WITH event_rows AS (
    SELECT
      fixture_id,
      fixture_rank,
      'sample_drawn'::text AS event_type,
      ((DATE '2026-03-03' + ((fixture_rank - 1) % 18))::timestamp + TIME '09:00')::timestamptz AS event_timestamp,
      'Initial water sample drawn.'::text AS description
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank <= 37

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'results_imported',
      ((DATE '2026-03-10' + ((fixture_rank - 1) % 18))::timestamp + TIME '14:00')::timestamptz,
      'Laboratory result imported and matched to the fixture.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank <= 32

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'remediation_planned',
      '2026-03-21 10:00:00-07'::timestamptz,
      'Remediation record created.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank BETWEEN 23 AND 32

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'access_restricted',
      '2026-03-21 10:15:00-07'::timestamptz,
      'Fixture access restricted after a result above 15 ppb.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank IN (29, 30, 32)

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'remediation_started',
      '2026-03-24 08:30:00-07'::timestamptz,
      'Remediation work started.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank BETWEEN 31 AND 32

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'remediation_completed',
      '2026-03-29 15:30:00-07'::timestamptz,
      'Remediation completed; post-remediation retest required.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank BETWEEN 31 AND 32

    UNION ALL

    SELECT
      fixture_id,
      fixture_rank,
      'verified',
      ((DATE '2026-03-11' + ((fixture_rank - 1) % 18))::timestamp + TIME '09:00')::timestamptz,
      'Result met the 5 ppb completion threshold.'
    FROM seed_north_valley_lead_fixtures
    WHERE fixture_rank <= 22
  )
  INSERT INTO public.lead_testing_events (
    id,
    fixture_id,
    testing_round_id,
    remediation_record_id,
    event_type,
    event_timestamp,
    description,
    performed_by,
    metadata
  )
  SELECT
    md5(
      'north-valley-demo-event-' || fixture_id::text || '-' ||
      event_type || '-' || event_timestamp::text
    )::uuid,
    fixture_id,
    md5('north-valley-demo-lead-round-1-' || fixture_id::text)::uuid,
    CASE
      WHEN event_type IN (
        'remediation_planned',
        'access_restricted',
        'remediation_started',
        'remediation_completed'
      )
      THEN md5('north-valley-demo-remediation-' || fixture_id::text)::uuid
      ELSE NULL
    END,
    event_type,
    event_timestamp,
    description,
    owner_id,
    jsonb_build_object('demo_data', true, 'fixture_rank', fixture_rank)
  FROM event_rows
  ON CONFLICT (id) DO UPDATE SET
    event_timestamp = EXCLUDED.event_timestamp,
    description = EXCLUDED.description,
    performed_by = EXCLUDED.performed_by,
    metadata = EXCLUDED.metadata;

  -- Set the present-day fixture summary after all historical rows exist.
  UPDATE public.fixtures f
  SET
    current_lead_testing_status = CASE
      WHEN s.fixture_rank <= 22 THEN 'complete'::public.lead_testing_status
      WHEN s.fixture_rank <= 30 THEN 'action_required'::public.lead_testing_status
      WHEN s.fixture_rank <= 32 THEN 'awaiting_retest'::public.lead_testing_status
      WHEN s.fixture_rank <= 37 THEN 'awaiting_results'::public.lead_testing_status
      ELSE 'not_started'::public.lead_testing_status
    END,
    current_required_action = CASE
      WHEN s.fixture_rank <= 22 THEN 'No remediation required'
      WHEN s.fixture_rank <= 28 THEN 'Remediation required'
      WHEN s.fixture_rank <= 30 THEN 'Immediately restrict access and remediate'
      WHEN s.fixture_rank <= 32 THEN 'Post-remediation retest required'
      WHEN s.fixture_rank <= 37 THEN 'Awaiting results'
      ELSE 'Sampling required'
    END,
    current_result_ppb = s.result_ppb,
    current_result_category = CASE
      WHEN s.result_ppb IS NULL THEN NULL
      WHEN s.result_ppb <= 5 THEN '5 ppb or less'
      WHEN s.result_ppb <= 15 THEN 'Greater than 5 through 15 ppb'
      ELSE 'Greater than 15 ppb'
    END,
    current_testing_round_id = CASE
      WHEN s.fixture_rank <= 37
      THEN md5('north-valley-demo-lead-round-1-' || s.fixture_id::text)::uuid
      ELSE NULL
    END,
    fixture_availability_status = CASE
      WHEN s.fixture_rank IN (29, 30, 32) THEN 'shut_off'::public.fixture_availability_status
      WHEN s.fixture_rank BETWEEN 23 AND 31 THEN 'temporarily_restricted'::public.fixture_availability_status
      ELSE 'available_for_consumption'::public.fixture_availability_status
    END,
    lead_testing_last_updated_at = CASE
      WHEN s.fixture_rank <= 32 THEN '2026-03-29 15:30:00-07'::timestamptz
      WHEN s.fixture_rank <= 37 THEN '2026-03-20 09:00:00-07'::timestamptz
      ELSE NULL
    END
  FROM seed_north_valley_lead_fixtures s
  WHERE f.id = s.fixture_id;

  IF (
    SELECT count(*) FROM public.fixtures f
    JOIN seed_north_valley_lead_fixtures s ON s.fixture_id = f.id
    WHERE f.current_lead_testing_status = 'complete'
  ) <> 22 THEN
    RAISE EXCEPTION 'Lead demo validation failed: expected 22 complete fixtures.';
  END IF;

  IF (
    SELECT count(*) FROM public.fixtures f
    JOIN seed_north_valley_lead_fixtures s ON s.fixture_id = f.id
    WHERE f.current_lead_testing_status = 'action_required'
  ) <> 8 THEN
    RAISE EXCEPTION 'Lead demo validation failed: expected 8 fixtures requiring remediation.';
  END IF;

  IF (
    SELECT count(*) FROM public.fixtures f
    JOIN seed_north_valley_lead_fixtures s ON s.fixture_id = f.id
    WHERE f.current_lead_testing_status = 'awaiting_retest'
  ) <> 2 THEN
    RAISE EXCEPTION 'Lead demo validation failed: expected 2 fixtures awaiting retest.';
  END IF;

  IF (
    SELECT count(*) FROM public.fixtures f
    JOIN seed_north_valley_lead_fixtures s ON s.fixture_id = f.id
    WHERE f.current_lead_testing_status = 'awaiting_results'
  ) <> 5 THEN
    RAISE EXCEPTION 'Lead demo validation failed: expected 5 fixtures awaiting results.';
  END IF;

  IF (
    SELECT count(*) FROM public.fixtures f
    JOIN seed_north_valley_lead_fixtures s ON s.fixture_id = f.id
    WHERE f.current_lead_testing_status = 'not_started'
  ) <> 14 THEN
    RAISE EXCEPTION 'Lead demo validation failed: expected 14 fixtures awaiting sampling.';
  END IF;
END
$$;
