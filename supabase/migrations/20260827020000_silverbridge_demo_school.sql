-- Fictional demonstration inventory and lead-testing workflow for
-- Silverbridge Public Schools.
--
-- Creates exactly:
--   1 school, 2 buildings, 4 floors, and 12 fixtures.
--
-- Current fixture status distribution:
--   3 complete after initial testing
--   2 requiring remediation (one result above 15 ppb)
--   1 remediation in progress
--   1 awaiting post-remediation retest
--   1 complete after a passing post-remediation retest
--   2 awaiting laboratory results
--   2 awaiting initial sampling
--
-- The deterministic IDs and upserts make this migration safe to rerun. It
-- affects only the Silverbridge demo records defined below.

BEGIN;

DO $$
DECLARE
  v_district_id UUID;
  v_owner_id UUID;
  v_campus_id UUID := md5('aquatrack-silverbridge-demo-school')::UUID;
  v_learning_building_id UUID := md5('aquatrack-silverbridge-learning-center')::UUID;
  v_community_building_id UUID := md5('aquatrack-silverbridge-community-center')::UUID;
  v_retest_round_id UUID;
  v_verified_remediation_id UUID;
BEGIN
  SELECT district.id
  INTO v_district_id
  FROM public.school_districts district
  WHERE lower(btrim(district.name)) = 'silverbridge public schools'
  LIMIT 1;

  IF v_district_id IS NULL THEN
    RAISE EXCEPTION
      'Silverbridge Public Schools was not found. Run 20260827000000_school_district_tenancy.sql first.';
  END IF;

  SELECT auth_user.id
  INTO v_owner_id
  FROM auth.users auth_user
  JOIN public.school_district_memberships membership
    ON membership.user_id = auth_user.id
   AND membership.district_id = v_district_id
  WHERE lower(btrim(auth_user.email)) = 'facilities@silverbridge.test'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'facilities@silverbridge.test is not a Silverbridge member. Create the account and verify its district membership first.';
  END IF;

  INSERT INTO public.campuses (
    id,
    name,
    school_district,
    school,
    address,
    organization_mode,
    district_id,
    created_by
  )
  VALUES (
    v_campus_id,
    'Silverbridge Elementary School',
    'Silverbridge Public Schools',
    'Silverbridge Elementary School',
    '100 School Way, Silverbridge, WA',
    'school_district',
    v_district_id,
    v_owner_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    school_district = EXCLUDED.school_district,
    school = EXCLUDED.school,
    address = EXCLUDED.address,
    organization_mode = EXCLUDED.organization_mode,
    district_id = EXCLUDED.district_id,
    created_by = EXCLUDED.created_by;

  INSERT INTO public.buildings (
    id,
    campus_id,
    name,
    floors,
    created_by
  )
  VALUES
    (v_learning_building_id, v_campus_id, 'Learning Center', 2, v_owner_id),
    (v_community_building_id, v_campus_id, 'Community Center', 2, v_owner_id)
  ON CONFLICT (id) DO UPDATE SET
    campus_id = EXCLUDED.campus_id,
    name = EXCLUDED.name,
    floors = EXCLUDED.floors,
    created_by = EXCLUDED.created_by;

  INSERT INTO public.floor_progress (
    building_id,
    floor,
    status,
    updated_by
  )
  VALUES
    (v_learning_building_id, '1', 'Done', v_owner_id),
    (v_learning_building_id, '2', 'Done', v_owner_id),
    (v_community_building_id, '1', 'Done', v_owner_id),
    (v_community_building_id, '2', 'Done', v_owner_id)
  ON CONFLICT (building_id, floor) DO UPDATE SET
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by;

  WITH fixture_specs (
    fixture_rank,
    building_id,
    floor,
    fixture_location,
    fixture_type_label,
    category,
    brand,
    model
  ) AS (
    VALUES
      (1,  v_learning_building_id,  '1', 'Classroom 101 Sink',                 'Classroom Sink',    'Other'::public.fixture_category,              'ClearFlow', 'CF-101'),
      (2,  v_learning_building_id,  '1', 'Main Hall Drinking Fountain',        'Drinking Fountain', 'MetalFountain'::public.fixture_category,      'Elkay',     'EZS8L'),
      (3,  v_learning_building_id,  '1', 'Cafeteria Kitchen Tap',              'Kitchen Tap',       'Other'::public.fixture_category,              'ClearFlow', 'CF-K200'),
      (4,  v_learning_building_id,  '2', 'Classroom 204 Sink',                 'Classroom Sink',    'Other'::public.fixture_category,              'ClearFlow', 'CF-204'),
      (5,  v_learning_building_id,  '2', 'Library Bottle Filling Station',     'Bottle Filler',     'BottleRefillStation'::public.fixture_category,'Elkay',     'LZS8WS'),
      (6,  v_learning_building_id,  '2', 'Staff Lounge Sink',                  'Sink',              'Other'::public.fixture_category,              'ClearFlow', 'CF-S300'),
      (7,  v_community_building_id, '1', 'Gym Lobby Drinking Fountain',        'Drinking Fountain', 'MetalFountain'::public.fixture_category,      'Haws',      '1107L'),
      (8,  v_community_building_id, '1', 'Health Office Sink',                 'Sink',              'Other'::public.fixture_category,              'ClearFlow', 'CF-H100'),
      (9,  v_community_building_id, '1', 'Commons Bottle Filling Station',     'Bottle Filler',     'BottleRefillStation'::public.fixture_category,'Elkay',     'LZSTL8WS'),
      (10, v_community_building_id, '2', 'Art Room Sink',                      'Sink',              'Other'::public.fixture_category,              'Chicago',   '802-665'),
      (11, v_community_building_id, '2', 'Upper Hall Drinking Fountain',       'Drinking Fountain', 'PorcelainFountain'::public.fixture_category,  'Haws',      '1001HPS'),
      (12, v_community_building_id, '2', 'Conference Room Tap',                'Tap',               'Other'::public.fixture_category,              'ClearFlow', 'CF-T120')
  )
  INSERT INTO public.fixtures (
    id,
    campus_id,
    building_id,
    floor,
    nearest_room,
    brand,
    model,
    serial_number,
    category,
    fixture_type_label,
    pressure_rating,
    cleanliness_rating,
    observations,
    last_maintenance_date,
    location_confirmed,
    saved_by_name,
    created_by
  )
  SELECT
    md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID,
    v_campus_id,
    building_id,
    floor,
    fixture_location,
    brand,
    model,
    'SB-DEMO-' || lpad(fixture_rank::TEXT, 3, '0'),
    category,
    fixture_type_label,
    3,
    4,
    'Fictional demonstration fixture for the Silverbridge workspace.',
    CURRENT_DATE - 120,
    true,
    'Silver Bridge Facilities',
    v_owner_id
  FROM fixture_specs
  ON CONFLICT (id) DO UPDATE SET
    campus_id = EXCLUDED.campus_id,
    building_id = EXCLUDED.building_id,
    floor = EXCLUDED.floor,
    nearest_room = EXCLUDED.nearest_room,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    serial_number = EXCLUDED.serial_number,
    category = EXCLUDED.category,
    fixture_type_label = EXCLUDED.fixture_type_label,
    observations = EXCLUDED.observations,
    location_confirmed = EXCLUDED.location_confirmed,
    saved_by_name = EXCLUDED.saved_by_name,
    created_by = EXCLUDED.created_by;

  -- Fixtures 1-8 have laboratory results. Fixtures 9-10 have been sampled
  -- and are waiting for results. Fixtures 11-12 remain ready for sampling.
  WITH testing_specs (fixture_rank, result_value) AS (
    VALUES
      (1, '2'::TEXT),
      (2, '5'::TEXT),
      (3, '1'::TEXT),
      (4, '8'::TEXT),
      (5, '19'::TEXT),
      (6, '11'::TEXT),
      (7, '7'::TEXT),
      (8, '16'::TEXT),
      (9, NULL::TEXT),
      (10, NULL::TEXT)
  )
  INSERT INTO public.lead_testing_rounds (
    id,
    district_id,
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
    matching_method,
    matching_confidence,
    notes,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
    v_district_id,
    md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID,
    'initial_test'::public.lead_round_type,
    1,
    CASE
      WHEN result_value IS NULL THEN 'awaiting_results'::public.lead_testing_status
      ELSE 'results_received'::public.lead_testing_status
    END,
    'SB-SAMPLE-' || lpad(fixture_rank::TEXT, 3, '0'),
    (CURRENT_DATE - (70 - fixture_rank))::TIMESTAMP + TIME '09:00',
    CURRENT_DATE - (70 - fixture_rank),
    'Silver Bridge Facilities',
    'First Draw (250 mL)',
    result_value,
    CASE WHEN result_value IS NULL THEN NULL ELSE 'ppb' END,
    CASE
      WHEN result_value IS NULL THEN NULL
      ELSE (CURRENT_DATE - (63 - fixture_rank))::TIMESTAMP + TIME '14:00'
    END,
    CASE WHEN result_value IS NULL THEN NULL ELSE 'Demonstration record' END,
    CASE WHEN result_value IS NULL THEN NULL ELSE 1 END,
    'Fictional lead-testing record for workflow demonstration.',
    v_owner_id,
    (CURRENT_DATE - (70 - fixture_rank))::TIMESTAMP + TIME '09:00',
    CASE
      WHEN result_value IS NULL
        THEN (CURRENT_DATE - (70 - fixture_rank))::TIMESTAMP + TIME '09:00'
      ELSE (CURRENT_DATE - (63 - fixture_rank))::TIMESTAMP + TIME '14:00'
    END
  FROM testing_specs
  ON CONFLICT (fixture_id, round_number) DO UPDATE SET
    district_id = EXCLUDED.district_id,
    round_type = EXCLUDED.round_type,
    status = EXCLUDED.status,
    sample_id = EXCLUDED.sample_id,
    sample_drawn_at = EXCLUDED.sample_drawn_at,
    sample_draw_date = EXCLUDED.sample_draw_date,
    sample_collector_name = EXCLUDED.sample_collector_name,
    sampling_method = EXCLUDED.sampling_method,
    result_value = EXCLUDED.result_value,
    result_original_unit = EXCLUDED.result_original_unit,
    result_received_at = EXCLUDED.result_received_at,
    matching_method = EXCLUDED.matching_method,
    matching_confidence = EXCLUDED.matching_confidence,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at;

  -- Add remediation at several different stages so the UI can demonstrate
  -- planning, active work, awaiting retest, and verified completion.
  WITH remediation_specs (
    fixture_rank,
    remediation_type,
    remediation_status,
    description,
    started_days_ago,
    completed_days_ago
  ) AS (
    VALUES
      (4, 'flushing'::public.remediation_type,          'planned'::public.remediation_status,        'Complete targeted flushing and inspect the outlet aerator.',            NULL::INTEGER, NULL::INTEGER),
      (5, 'replace_fixture'::public.remediation_type,   'planned'::public.remediation_status,        'Replace the affected bottle filling station and inspect supply piping.', NULL::INTEGER, NULL::INTEGER),
      (6, 'replace_component'::public.remediation_type, 'in_progress'::public.remediation_status,    'Replace the faucet assembly and inspect the supply connection.',         12,            NULL::INTEGER),
      (7, 'install_filter'::public.remediation_type,    'awaiting_retest'::public.remediation_status,'Install a certified point-of-use filter and complete conditioning.',      20,            8),
      (8, 'replace_fixture'::public.remediation_type,   'verified'::public.remediation_status,       'Replace the affected sink fixture and flush the branch line.',           32,            24)
  )
  INSERT INTO public.remediation_records (
    id,
    district_id,
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
    md5('aquatrack-silverbridge-demo-remediation-' || fixture_rank)::UUID,
    v_district_id,
    md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID,
    md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
    remediation_type,
    remediation_status,
    description,
    CURRENT_DATE + 21,
    CASE
      WHEN started_days_ago IS NULL THEN NULL
      ELSE (CURRENT_DATE - started_days_ago)::TIMESTAMP + TIME '08:30'
    END,
    CASE
      WHEN completed_days_ago IS NULL THEN NULL
      ELSE (CURRENT_DATE - completed_days_ago)::TIMESTAMP + TIME '15:30'
    END,
    'Silver Bridge Facilities',
    CASE WHEN fixture_rank IN (5, 8) THEN 'Silverbridge Plumbing Services' ELSE NULL END,
    CASE WHEN fixture_rank IN (5, 8) THEN 'ClearFlow' ELSE NULL END,
    CASE WHEN fixture_rank IN (5, 8) THEN 'Lead-free replacement fixture' ELSE NULL END,
    CASE WHEN fixture_rank IN (5, 8) THEN 'CF-LF250' ELSE NULL END,
    CASE
      WHEN completed_days_ago IS NULL THEN NULL
      ELSE CURRENT_DATE - completed_days_ago
    END,
    'Fictional remediation record for workflow demonstration.',
    true,
    CASE
      WHEN remediation_status IN ('awaiting_retest', 'verified')
        THEN 'completed'::public.conditioning_status
      ELSE 'not_started'::public.conditioning_status
    END,
    v_owner_id,
    (CURRENT_DATE - 40)::TIMESTAMP + TIME '10:00',
    CASE
      WHEN completed_days_ago IS NOT NULL
        THEN (CURRENT_DATE - completed_days_ago)::TIMESTAMP + TIME '15:30'
      WHEN started_days_ago IS NOT NULL
        THEN (CURRENT_DATE - started_days_ago)::TIMESTAMP + TIME '08:30'
      ELSE (CURRENT_DATE - 40)::TIMESTAMP + TIME '10:00'
    END
  FROM remediation_specs
  ON CONFLICT (id) DO UPDATE SET
    district_id = EXCLUDED.district_id,
    triggering_testing_round_id = EXCLUDED.triggering_testing_round_id,
    remediation_type = EXCLUDED.remediation_type,
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

  -- Fixture 8 has a passing post-remediation retest. Insert the round before
  -- adding the result so the summary trigger can safely link the remediation.
  v_retest_round_id := md5('aquatrack-silverbridge-demo-retest-round-8')::UUID;
  v_verified_remediation_id := md5('aquatrack-silverbridge-demo-remediation-8')::UUID;

  INSERT INTO public.lead_testing_rounds (
    id,
    district_id,
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
    matching_method,
    matching_confidence,
    notes,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    v_retest_round_id,
    v_district_id,
    md5('aquatrack-silverbridge-demo-fixture-8')::UUID,
    'post_remediation_retest',
    2,
    'awaiting_retest_results',
    'SB-RETEST-008',
    (CURRENT_DATE - 17)::TIMESTAMP + TIME '09:15',
    CURRENT_DATE - 17,
    'Silver Bridge Facilities',
    'First Draw (250 mL)',
    NULL,
    NULL,
    NULL,
    'Demonstration record',
    1,
    'Passing post-remediation retest for workflow demonstration.',
    v_owner_id,
    (CURRENT_DATE - 17)::TIMESTAMP + TIME '09:15',
    (CURRENT_DATE - 17)::TIMESTAMP + TIME '09:15'
  )
  ON CONFLICT (fixture_id, round_number) DO UPDATE SET
    district_id = EXCLUDED.district_id,
    round_type = EXCLUDED.round_type,
    status = EXCLUDED.status,
    sample_id = EXCLUDED.sample_id,
    sample_drawn_at = EXCLUDED.sample_drawn_at,
    sample_draw_date = EXCLUDED.sample_draw_date,
    sample_collector_name = EXCLUDED.sample_collector_name,
    sampling_method = EXCLUDED.sampling_method,
    result_value = NULL,
    result_original_unit = NULL,
    result_received_at = NULL,
    matching_method = EXCLUDED.matching_method,
    matching_confidence = EXCLUDED.matching_confidence,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_retest_round_id;

  UPDATE public.lead_testing_rounds
  SET
    result_value = '3',
    result_original_unit = 'ppb',
    result_received_at = (CURRENT_DATE - 10)::TIMESTAMP + TIME '13:45',
    updated_at = (CURRENT_DATE - 10)::TIMESTAMP + TIME '13:45'
  WHERE id = v_retest_round_id;

  UPDATE public.remediation_records
  SET
    status = 'verified',
    follow_up_testing_round_id = v_retest_round_id,
    updated_at = (CURRENT_DATE - 10)::TIMESTAMP + TIME '13:45'
  WHERE id = v_verified_remediation_id;

  -- Set the intended present-day summary after every historical record exists.
  WITH fixture_statuses (
    fixture_rank,
    testing_status,
    required_action,
    current_result_ppb,
    result_category,
    availability_status,
    current_round_id
  ) AS (
    VALUES
      (1,  'complete'::public.lead_testing_status,               'No remediation required',                    2::NUMERIC,  '5 ppb or less',                    'available_for_consumption'::public.fixture_availability_status, md5('aquatrack-silverbridge-demo-initial-round-1')::UUID),
      (2,  'complete'::public.lead_testing_status,               'No remediation required',                    5::NUMERIC,  '5 ppb or less',                    'available_for_consumption'::public.fixture_availability_status, md5('aquatrack-silverbridge-demo-initial-round-2')::UUID),
      (3,  'complete'::public.lead_testing_status,               'No remediation required',                    1::NUMERIC,  '5 ppb or less',                    'available_for_consumption'::public.fixture_availability_status, md5('aquatrack-silverbridge-demo-initial-round-3')::UUID),
      (4,  'action_required'::public.lead_testing_status,        'Remediation required',                        8::NUMERIC,  'Greater than 5 through 15 ppb',    'temporarily_restricted'::public.fixture_availability_status,    md5('aquatrack-silverbridge-demo-initial-round-4')::UUID),
      (5,  'action_required'::public.lead_testing_status,        'Immediately restrict access and remediate',  19::NUMERIC, 'Greater than 15 ppb',              'shut_off'::public.fixture_availability_status,                 md5('aquatrack-silverbridge-demo-initial-round-5')::UUID),
      (6,  'remediation_in_progress'::public.lead_testing_status,'Remediation required',                        11::NUMERIC, 'Greater than 5 through 15 ppb',    'temporarily_restricted'::public.fixture_availability_status,    md5('aquatrack-silverbridge-demo-initial-round-6')::UUID),
      (7,  'awaiting_retest'::public.lead_testing_status,        'Post-remediation retest required',             7::NUMERIC,  'Greater than 5 through 15 ppb',    'temporarily_restricted'::public.fixture_availability_status,    md5('aquatrack-silverbridge-demo-initial-round-7')::UUID),
      (8,  'complete'::public.lead_testing_status,               'Remediation verified',                         3::NUMERIC,  '5 ppb or less',                    'available_for_consumption'::public.fixture_availability_status, v_retest_round_id),
      (9,  'awaiting_results'::public.lead_testing_status,       'Awaiting results',                            NULL::NUMERIC,NULL::TEXT,                         'available_for_consumption'::public.fixture_availability_status, md5('aquatrack-silverbridge-demo-initial-round-9')::UUID),
      (10, 'awaiting_results'::public.lead_testing_status,       'Awaiting results',                            NULL::NUMERIC,NULL::TEXT,                         'available_for_consumption'::public.fixture_availability_status, md5('aquatrack-silverbridge-demo-initial-round-10')::UUID),
      (11, 'not_started'::public.lead_testing_status,            'Sampling required',                           NULL::NUMERIC,NULL::TEXT,                         'available_for_consumption'::public.fixture_availability_status, NULL::UUID),
      (12, 'not_started'::public.lead_testing_status,            'Sampling required',                           NULL::NUMERIC,NULL::TEXT,                         'available_for_consumption'::public.fixture_availability_status, NULL::UUID)
  )
  UPDATE public.fixtures fixture
  SET
    current_lead_testing_status = status.testing_status,
    current_required_action = status.required_action,
    current_result_ppb = status.current_result_ppb,
    current_result_category = status.result_category,
    current_testing_round_id = status.current_round_id,
    fixture_availability_status = status.availability_status,
    lead_testing_last_updated_at = CASE
      WHEN status.testing_status = 'not_started' THEN NULL
      ELSE now()
    END
  FROM fixture_statuses status
  WHERE fixture.id = md5(
    'aquatrack-silverbridge-demo-fixture-' || status.fixture_rank
  )::UUID;

  -- Deterministic event IDs keep the sample timelines stable on reruns.
  WITH event_specs (
    fixture_rank,
    event_order,
    testing_round_id,
    remediation_record_id,
    event_type,
    event_timestamp,
    description,
    metadata
  ) AS (
    SELECT
      fixture_rank,
      1,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      NULL::UUID,
      'sample_drawn',
      (CURRENT_DATE - (70 - fixture_rank))::TIMESTAMP + TIME '09:00',
      'Initial first-draw sample collected.',
      jsonb_build_object('demo_data', true)
    FROM generate_series(1, 10) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      2,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      NULL::UUID,
      'result_imported',
      (CURRENT_DATE - (63 - fixture_rank))::TIMESTAMP + TIME '14:00',
      'Laboratory result recorded for the fixture.',
      jsonb_build_object(
        'demo_data', true,
        'normalized_ppb', (ARRAY[2, 5, 1, 8, 19, 11, 7, 16])[fixture_rank]
      )
    FROM generate_series(1, 8) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      3,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      NULL::UUID,
      'verified',
      (CURRENT_DATE - (62 - fixture_rank))::TIMESTAMP + TIME '09:00',
      'Initial result met the 5 ppb completion threshold.',
      jsonb_build_object('demo_data', true)
    FROM generate_series(1, 3) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      3,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      md5('aquatrack-silverbridge-demo-remediation-' || fixture_rank)::UUID,
      'remediation_planned',
      (CURRENT_DATE - 40)::TIMESTAMP + TIME '10:00',
      'Remediation record created.',
      jsonb_build_object('demo_data', true)
    FROM generate_series(4, 8) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      4,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      md5('aquatrack-silverbridge-demo-remediation-' || fixture_rank)::UUID,
      'access_restricted',
      (CURRENT_DATE - 39)::TIMESTAMP + TIME '08:00',
      'Fixture access restricted after a result above 15 ppb.',
      jsonb_build_object('demo_data', true)
    FROM unnest(ARRAY[5, 8]) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      5,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      md5('aquatrack-silverbridge-demo-remediation-' || fixture_rank)::UUID,
      'remediation_started',
      CASE fixture_rank
        WHEN 6 THEN (CURRENT_DATE - 12)::TIMESTAMP + TIME '08:30'
        WHEN 7 THEN (CURRENT_DATE - 20)::TIMESTAMP + TIME '08:30'
        ELSE (CURRENT_DATE - 32)::TIMESTAMP + TIME '08:30'
      END,
      'Corrective work started.',
      jsonb_build_object('demo_data', true)
    FROM generate_series(6, 8) fixture_rank

    UNION ALL

    SELECT
      fixture_rank,
      6,
      md5('aquatrack-silverbridge-demo-initial-round-' || fixture_rank)::UUID,
      md5('aquatrack-silverbridge-demo-remediation-' || fixture_rank)::UUID,
      'remediation_completed',
      CASE fixture_rank
        WHEN 7 THEN (CURRENT_DATE - 8)::TIMESTAMP + TIME '15:30'
        ELSE (CURRENT_DATE - 24)::TIMESTAMP + TIME '15:30'
      END,
      'Remediation completed; post-remediation retest required.',
      jsonb_build_object('demo_data', true)
    FROM generate_series(7, 8) fixture_rank

    UNION ALL

    SELECT
      8,
      7,
      v_retest_round_id,
      v_verified_remediation_id,
      'retest_sample_drawn',
      (CURRENT_DATE - 17)::TIMESTAMP + TIME '09:15',
      'Post-remediation retest sample collected.',
      jsonb_build_object('demo_data', true)

    UNION ALL

    SELECT
      8,
      8,
      v_retest_round_id,
      v_verified_remediation_id,
      'remediation_verified',
      (CURRENT_DATE - 10)::TIMESTAMP + TIME '13:45',
      'Retest result recorded at 3 ppb; remediation verified.',
      jsonb_build_object('demo_data', true, 'normalized_ppb', 3)
  )
  INSERT INTO public.lead_testing_events (
    id,
    district_id,
    fixture_id,
    testing_round_id,
    remediation_record_id,
    event_type,
    event_timestamp,
    description,
    performed_by,
    metadata,
    created_at
  )
  SELECT
    md5(
      'aquatrack-silverbridge-demo-event-' || fixture_rank || '-' ||
      event_order || '-' || event_type
    )::UUID,
    v_district_id,
    md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID,
    testing_round_id,
    remediation_record_id,
    event_type,
    event_timestamp,
    description,
    v_owner_id,
    metadata,
    event_timestamp
  FROM event_specs
  ON CONFLICT (id) DO UPDATE SET
    district_id = EXCLUDED.district_id,
    testing_round_id = EXCLUDED.testing_round_id,
    remediation_record_id = EXCLUDED.remediation_record_id,
    event_timestamp = EXCLUDED.event_timestamp,
    description = EXCLUDED.description,
    performed_by = EXCLUDED.performed_by,
    metadata = EXCLUDED.metadata;

  IF (
    SELECT count(*)
    FROM public.campuses campus
    WHERE campus.id = v_campus_id
      AND campus.district_id = v_district_id
  ) <> 1 THEN
    RAISE EXCEPTION 'Silverbridge demo validation failed: expected one school.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.fixtures fixture
    WHERE fixture.id IN (
      SELECT md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID
      FROM generate_series(1, 12) fixture_rank
    )
  ) <> 12 THEN
    RAISE EXCEPTION 'Silverbridge demo validation failed: expected 12 fixtures.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.fixtures fixture
    WHERE fixture.id IN (
      SELECT md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID
      FROM generate_series(1, 12) fixture_rank
    )
      AND fixture.current_lead_testing_status = 'complete'
  ) <> 4 THEN
    RAISE EXCEPTION 'Silverbridge demo validation failed: expected 4 complete fixtures.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.fixtures fixture
    WHERE fixture.id IN (
      SELECT md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID
      FROM generate_series(1, 12) fixture_rank
    )
      AND fixture.current_lead_testing_status = 'awaiting_results'
  ) <> 2 THEN
    RAISE EXCEPTION 'Silverbridge demo validation failed: expected 2 fixtures awaiting results.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.fixtures fixture
    WHERE fixture.id IN (
      SELECT md5('aquatrack-silverbridge-demo-fixture-' || fixture_rank)::UUID
      FROM generate_series(1, 12) fixture_rank
    )
      AND fixture.current_lead_testing_status = 'not_started'
  ) <> 2 THEN
    RAISE EXCEPTION 'Silverbridge demo validation failed: expected 2 fixtures awaiting sampling.';
  END IF;
END
$$;

COMMIT;

-- Verification summary for the SQL editor result panel.
SELECT
  district.name AS school_district,
  campus.school AS school,
  count(DISTINCT building.id) AS buildings,
  count(DISTINCT (building.id, fixture.floor)) AS floors,
  count(DISTINCT fixture.id) AS fixtures,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'not_started') AS awaiting_sampling,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'awaiting_results') AS awaiting_results,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'action_required') AS remediation_required,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'remediation_in_progress') AS remediation_active,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'awaiting_retest') AS awaiting_retest,
  count(*) FILTER (WHERE fixture.current_lead_testing_status = 'complete') AS complete
FROM public.campuses campus
JOIN public.school_districts district ON district.id = campus.district_id
LEFT JOIN public.buildings building ON building.campus_id = campus.id
LEFT JOIN public.fixtures fixture ON fixture.building_id = building.id
WHERE campus.id = md5('aquatrack-silverbridge-demo-school')::UUID
GROUP BY district.name, campus.school;
