-- Demo inventory for the School District subsystem.
-- Prerequisite: 20260728000000_separate_organization_subsystems.sql
--
-- The SQL editor does not have an auth.uid(), so the seed is assigned to the
-- earliest existing AquaTrack user. To seed a different account, replace the
-- owner lookup below with:
--   SELECT id INTO owner_id FROM auth.users WHERE email = 'you@example.com';

DO $$
DECLARE
  owner_id UUID;
  seeded_school_count INTEGER;
  seeded_building_count INTEGER;
  seeded_floor_count INTEGER;
  seeded_fixture_count INTEGER;
  invalid_school_count INTEGER;
  invalid_building_count INTEGER;
  invalid_floor_count INTEGER;
BEGIN
  SELECT id INTO owner_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Create an AquaTrack user before running the School District demo seed.';
  END IF;

  -- Remove only the empty starter record automatically created for a brand-new
  -- School District workspace. User-entered schools are never removed.
  DELETE FROM public.campuses c
  WHERE c.created_by = owner_id
    AND c.organization_mode = 'school_district'
    AND c.school = 'My School'
    AND NOT EXISTS (SELECT 1 FROM public.buildings b WHERE b.campus_id = c.id);

  WITH school_data(school_key, school_name, address) AS (
    VALUES
      ('cedar-valley', 'Pine Creek Elementary School', '100 Pine Creek Way, North Valley, WA'),
      ('port-susan', 'Maple Grove Middle School', '200 Maple Grove Avenue, North Valley, WA'),
      ('summit-ridge', 'Riverstone High School', '300 Riverstone Boulevard, North Valley, WA')
  )
  INSERT INTO public.campuses (
    id, name, school_district, school, address, organization_mode, created_by
  )
  SELECT
    (
      substr(md5('aquatrack-demo-school-' || school_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 21, 12)
    )::uuid,
    school_name,
    'North Valley School District',
    school_name,
    address,
    'school_district',
    owner_id
  FROM school_data
  ON CONFLICT (id) DO UPDATE SET
    school_district = EXCLUDED.school_district,
    school = EXCLUDED.school,
    address = EXCLUDED.address,
    organization_mode = EXCLUDED.organization_mode,
    created_by = EXCLUDED.created_by;

  WITH building_data(school_key, building_key, building_name, floor_total) AS (
    VALUES
      ('cedar-valley', 'cv-main', 'Learning Center', 2),
      ('cedar-valley', 'cv-early', 'Commons Building', 2),
      ('port-susan', 'ps-academic', 'Academic Building', 3),
      ('port-susan', 'ps-commons', 'Innovation Building', 2),
      ('port-susan', 'ps-gym', 'Student Center', 2),
      ('summit-ridge', 'sr-academic', 'North Academic Building', 3),
      ('summit-ridge', 'sr-stem', 'South Academic Building', 3),
      ('summit-ridge', 'sr-arts', 'STEM Center', 2),
      ('summit-ridge', 'sr-athletics', 'Athletics Center', 2)
  )
  INSERT INTO public.buildings (id, campus_id, name, floors, created_by)
  SELECT
    (
      substr(md5('aquatrack-demo-building-' || building_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 21, 12)
    )::uuid,
    (
      substr(md5('aquatrack-demo-school-' || school_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 21, 12)
    )::uuid,
    building_name,
    floor_total,
    owner_id
  FROM building_data
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    floors = EXCLUDED.floors,
    created_by = EXCLUDED.created_by;

  WITH building_data(building_key, floor_total) AS (
    VALUES
      ('cv-main', 2), ('cv-early', 2),
      ('ps-academic', 3), ('ps-commons', 2), ('ps-gym', 2),
      ('sr-academic', 3), ('sr-stem', 3), ('sr-arts', 2), ('sr-athletics', 2)
  )
  INSERT INTO public.floor_progress (building_id, floor, status, updated_by)
  SELECT
    (
      substr(md5('aquatrack-demo-building-' || building_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 21, 12)
    )::uuid,
    floor_number::text,
    'Done'::public.floor_status,
    owner_id
  FROM building_data
  CROSS JOIN LATERAL generate_series(1, floor_total) AS floor_number
  ON CONFLICT (building_id, floor) DO UPDATE SET
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by;

  -- Fixture counts per floor. The sum is exactly 51 and every floor has 2–3.
  WITH floor_specs(school_key, building_key, floor_number, fixture_total) AS (
    VALUES
      ('cedar-valley', 'cv-main', 1, 3),
      ('cedar-valley', 'cv-main', 2, 2),
      ('cedar-valley', 'cv-early', 1, 3),
      ('cedar-valley', 'cv-early', 2, 2),
      ('port-susan', 'ps-academic', 1, 3),
      ('port-susan', 'ps-academic', 2, 2),
      ('port-susan', 'ps-academic', 3, 3),
      ('port-susan', 'ps-commons', 1, 2),
      ('port-susan', 'ps-commons', 2, 2),
      ('port-susan', 'ps-gym', 1, 3),
      ('port-susan', 'ps-gym', 2, 2),
      ('summit-ridge', 'sr-academic', 1, 3),
      ('summit-ridge', 'sr-academic', 2, 2),
      ('summit-ridge', 'sr-academic', 3, 2),
      ('summit-ridge', 'sr-stem', 1, 3),
      ('summit-ridge', 'sr-stem', 2, 2),
      ('summit-ridge', 'sr-stem', 3, 3),
      ('summit-ridge', 'sr-arts', 1, 2),
      ('summit-ridge', 'sr-arts', 2, 3),
      ('summit-ridge', 'sr-athletics', 1, 2),
      ('summit-ridge', 'sr-athletics', 2, 2)
  ),
  expanded AS (
    SELECT floor_specs.*, fixture_number
    FROM floor_specs
    CROSS JOIN LATERAL generate_series(1, fixture_total) AS fixture_number
  )
  INSERT INTO public.fixtures (
    id, campus_id, building_id, floor, nearest_room,
    brand, model, serial_number, category,
    pressure_rating, cleanliness_rating, observations,
    last_maintenance_date, location_confirmed, saved_by_name, created_by
  )
  SELECT
    (
      substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 21, 12)
    )::uuid,
    (
      substr(md5('aquatrack-demo-school-' || school_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-school-' || school_key), 21, 12)
    )::uuid,
    (
      substr(md5('aquatrack-demo-building-' || building_key), 1, 8) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 9, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 13, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 17, 4) || '-' ||
      substr(md5('aquatrack-demo-building-' || building_key), 21, 12)
    )::uuid,
    floor_number::text,
    CASE fixture_number
      WHEN 1 THEN 'Classroom area · Floor ' || floor_number || ' · Sink A'
      WHEN 2 THEN 'East hallway · Floor ' || floor_number || ' · Drinking Fountain B'
      ELSE 'Commons area · Floor ' || floor_number || ' · Bottle Filler C'
    END,
    CASE fixture_number
      WHEN 1 THEN 'Chicago Faucets'
      WHEN 2 THEN 'Elkay'
      ELSE 'Elkay'
    END,
    CASE fixture_number
      WHEN 1 THEN '802-665ABCP'
      WHEN 2 THEN 'EZS8L'
      ELSE 'LZS8WS'
    END,
    upper(replace(building_key, '-', '')) || '-F' || floor_number || '-' || lpad(fixture_number::text, 2, '0'),
    CASE fixture_number
      WHEN 1 THEN 'Other'::public.fixture_category
      WHEN 2 THEN 'MetalFountain'::public.fixture_category
      ELSE 'BottleRefillStation'::public.fixture_category
    END,
    3,
    CASE WHEN fixture_number = 1 THEN 3 ELSE 4 END,
    CASE fixture_number
      WHEN 1 THEN 'Cold-water sink serving a general classroom area.'
      WHEN 2 THEN 'Drinking fountain located along an east hallway.'
      ELSE 'Bottle filling station located near a shared commons area.'
    END,
    CURRENT_DATE - ((floor_number * 18 + fixture_number * 7) || ' days')::interval,
    true,
    'District Inventory Import',
    owner_id
  FROM expanded
  ON CONFLICT (id) DO UPDATE SET
    campus_id = EXCLUDED.campus_id,
    building_id = EXCLUDED.building_id,
    floor = EXCLUDED.floor,
    nearest_room = EXCLUDED.nearest_room,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    serial_number = EXCLUDED.serial_number,
    category = EXCLUDED.category,
    observations = EXCLUDED.observations,
    created_by = EXCLUDED.created_by;

  -- Give the existing 51 fixtures fictional, school-like names and locations
  -- without changing their building/floor distribution or creating new rows.
  WITH location_specs(building_key, floor_number, fixture_names) AS (
    VALUES
      ('cv-main', 1, ARRAY['Classroom A101 Sink','First Floor Hallway Drinking Fountain','Main Office Sink']),
      ('cv-main', 2, ARRAY['Classroom A201 Sink','Library Bottle Filling Station']),
      ('cv-early', 1, ARRAY['Cafeteria Food Preparation Sink','Student Commons Bottle Filling Station','Staff Lounge Sink']),
      ('cv-early', 2, ARRAY['Art Studio Sink','Second Floor Hallway Drinking Fountain']),
      ('ps-academic', 1, ARRAY['Classroom A103 Sink','North Corridor Drinking Fountain','Administrative Office Sink']),
      ('ps-academic', 2, ARRAY['Classroom A203 Faucet','East Hallway Bottle Filling Station']),
      ('ps-academic', 3, ARRAY['Classroom A303 Sink','Third Floor Hallway Fountain','Media Center Sink']),
      ('ps-commons', 1, ARRAY['Science Lab 1 Sink','Innovation Lobby Bottle Filling Station']),
      ('ps-commons', 2, ARRAY['Science Lab 2 Sink','West Hallway Drinking Fountain']),
      ('ps-gym', 1, ARRAY['Cafeteria Sink','Student Commons Bottle Filling Station','Student Services Sink']),
      ('ps-gym', 2, ARRAY['Gym Entrance Drinking Fountain','Staff Lounge Sink']),
      ('sr-academic', 1, ARRAY['Classroom B101 Sink','North Corridor Fountain','Student Services Sink']),
      ('sr-academic', 2, ARRAY['Classroom B205 Faucet','Second Floor Bottle Filling Station']),
      ('sr-academic', 3, ARRAY['Classroom B302 Sink','Third Floor Hallway Fountain']),
      ('sr-stem', 1, ARRAY['Classroom C101 Sink','South Corridor Fountain','Administrative Office Sink']),
      ('sr-stem', 2, ARRAY['Classroom C204 Sink','East Hallway Bottle Filling Station']),
      ('sr-stem', 3, ARRAY['Classroom C303 Sink','West Hallway Fountain','Third Floor Bottle Filling Station']),
      ('sr-arts', 1, ARRAY['Engineering Lab Sink','Laboratory Bottle Filling Station']),
      ('sr-arts', 2, ARRAY['Chemistry Lab Sink','Science Corridor Fountain','STEM Commons Sink']),
      ('sr-athletics', 1, ARRAY['Gym Entrance Bottle Filling Station','Athletics Hallway Fountain']),
      ('sr-athletics', 2, ARRAY['Staff Lounge Sink','Upper Gym Hallway Fountain'])
  ),
  expanded_locations AS (
    SELECT
      building_key,
      floor_number,
      fixture_name,
      fixture_number
    FROM location_specs
    CROSS JOIN LATERAL unnest(fixture_names) WITH ORDINALITY
      AS fixture(fixture_name, fixture_number)
  ),
  resolved_locations AS (
    SELECT
      (
        substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 1, 8) || '-' ||
        substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 9, 4) || '-' ||
        substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 13, 4) || '-' ||
        substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 17, 4) || '-' ||
        substr(md5('aquatrack-demo-fixture-' || building_key || '-' || floor_number || '-' || fixture_number), 21, 12)
      )::uuid AS fixture_id,
      fixture_name
    FROM expanded_locations
  )
  UPDATE public.fixtures fixture
  SET
    nearest_room = location.fixture_name,
    category = CASE
      WHEN location.fixture_name ILIKE '%Bottle Filling%'
        THEN 'BottleRefillStation'::public.fixture_category
      WHEN location.fixture_name ILIKE '%Fountain%'
        THEN 'MetalFountain'::public.fixture_category
      ELSE 'Other'::public.fixture_category
    END,
    observations = location.fixture_name || ' serving the surrounding school area.'
  FROM resolved_locations location
  WHERE fixture.id = location.fixture_id;

  -- Assertions keep future edits from silently violating the requested shape.
  SELECT count(*) INTO seeded_school_count
  FROM public.campuses
  WHERE school_district = 'North Valley School District'
    AND organization_mode = 'school_district'
    AND created_by = owner_id;

  SELECT count(*) INTO seeded_building_count
  FROM public.buildings b
  JOIN public.campuses c ON c.id = b.campus_id
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district'
    AND c.created_by = owner_id;

  SELECT count(*) INTO seeded_floor_count
  FROM public.floor_progress fp
  JOIN public.buildings b ON b.id = fp.building_id
  JOIN public.campuses c ON c.id = b.campus_id
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district'
    AND c.created_by = owner_id;

  SELECT count(*) INTO seeded_fixture_count
  FROM public.fixtures f
  JOIN public.campuses c ON c.id = f.campus_id
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district'
    AND c.created_by = owner_id;

  SELECT count(*) INTO invalid_school_count
  FROM (
    SELECT c.id
    FROM public.campuses c
    LEFT JOIN public.buildings b ON b.campus_id = c.id
    WHERE c.school_district = 'North Valley School District'
      AND c.organization_mode = 'school_district'
      AND c.created_by = owner_id
    GROUP BY c.id
    HAVING count(b.id) NOT BETWEEN 2 AND 4
  ) invalid_schools;

  SELECT count(*) INTO invalid_building_count
  FROM public.buildings b
  JOIN public.campuses c ON c.id = b.campus_id
  WHERE c.school_district = 'North Valley School District'
    AND c.organization_mode = 'school_district'
    AND c.created_by = owner_id
    AND b.floors NOT BETWEEN 2 AND 3;

  SELECT count(*) INTO invalid_floor_count
  FROM (
    SELECT f.building_id, f.floor
    FROM public.fixtures f
    JOIN public.campuses c ON c.id = f.campus_id
    WHERE c.school_district = 'North Valley School District'
      AND c.organization_mode = 'school_district'
      AND c.created_by = owner_id
    GROUP BY f.building_id, f.floor
    HAVING count(*) NOT BETWEEN 2 AND 3
  ) invalid_floors;

  IF seeded_school_count <> 3
     OR seeded_building_count <> 9
     OR seeded_floor_count <> 21
     OR seeded_fixture_count <> 51
     OR invalid_school_count <> 0
     OR invalid_building_count <> 0
     OR invalid_floor_count <> 0 THEN
    RAISE EXCEPTION
      'Invalid demo shape: schools %, buildings %, floors %, fixtures %, invalid schools %, buildings %, floors %',
      seeded_school_count, seeded_building_count, seeded_floor_count, seeded_fixture_count,
      invalid_school_count, invalid_building_count, invalid_floor_count;
  END IF;
END $$;
