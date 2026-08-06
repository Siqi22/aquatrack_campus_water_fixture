-- One-time Riverstone floor cleanup.
-- Canonicalizes labels such as "Floor", "Floor 1", and "1st Floor" to "1",
-- then rebuilds one floor_progress row per actual building/floor combination.

BEGIN;

CREATE TEMP TABLE riverstone_buildings ON COMMIT DROP AS
SELECT b.id
FROM public.buildings b
JOIN public.campuses c ON c.id = b.campus_id
WHERE c.organization_mode = 'school_district'
  AND lower(regexp_replace(btrim(coalesce(nullif(c.school, ''), c.name)), '\s+', '', 'g')) =
      lower('RiverstoneHighSchool');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM riverstone_buildings) THEN
    RAISE EXCEPTION 'Riverstone High School was not found. No data was changed.';
  END IF;
END
$$;

CREATE TEMP TABLE riverstone_floor_status ON COMMIT DROP AS
SELECT
  fp.building_id,
  CASE
    WHEN lower(btrim(fp.floor)) ~ '^(floor\s*)+$' THEN '1'
    WHEN lower(replace(btrim(fp.floor), '.', '')) ~ '^fl\s*$' THEN '1'
    WHEN lower(replace(btrim(fp.floor), '.', '')) ~ '^((floor|fl)\s*)*[0-9]+(st|nd|rd|th)?(\s*(floor|fl))*$'
      THEN (regexp_match(lower(btrim(fp.floor)), '([0-9]+)'))[1]::INTEGER::TEXT
    WHEN lower(btrim(fp.floor)) IN ('first', 'first floor') THEN '1'
    WHEN lower(btrim(fp.floor)) IN ('second', 'second floor') THEN '2'
    WHEN lower(btrim(fp.floor)) IN ('third', 'third floor') THEN '3'
    WHEN lower(btrim(fp.floor)) IN ('ground', 'ground floor') THEN 'G'
    ELSE btrim(fp.floor)
  END AS floor,
  CASE max(
    CASE fp.status::TEXT
      WHEN 'Restricted' THEN 4
      WHEN 'Done' THEN 3
      WHEN 'InProgress' THEN 2
      ELSE 1
    END
  )
    WHEN 4 THEN 'Restricted'::public.floor_status
    WHEN 3 THEN 'Done'::public.floor_status
    WHEN 2 THEN 'InProgress'::public.floor_status
    ELSE 'NotStarted'::public.floor_status
  END AS status,
  min(fp.started_at) AS started_at,
  max(fp.ended_at) AS ended_at
FROM public.floor_progress fp
WHERE fp.building_id IN (SELECT id FROM riverstone_buildings)
GROUP BY fp.building_id, 2;

UPDATE public.fixtures f
SET floor = CASE
  WHEN lower(btrim(f.floor)) ~ '^(floor\s*)+$' THEN '1'
  WHEN lower(replace(btrim(f.floor), '.', '')) ~ '^fl\s*$' THEN '1'
  WHEN lower(replace(btrim(f.floor), '.', '')) ~ '^((floor|fl)\s*)*[0-9]+(st|nd|rd|th)?(\s*(floor|fl))*$'
    THEN (regexp_match(lower(btrim(f.floor)), '([0-9]+)'))[1]::INTEGER::TEXT
  WHEN lower(btrim(f.floor)) IN ('first', 'first floor') THEN '1'
  WHEN lower(btrim(f.floor)) IN ('second', 'second floor') THEN '2'
  WHEN lower(btrim(f.floor)) IN ('third', 'third floor') THEN '3'
  WHEN lower(btrim(f.floor)) IN ('ground', 'ground floor') THEN 'G'
  ELSE btrim(f.floor)
END
WHERE f.building_id IN (SELECT id FROM riverstone_buildings);

DELETE FROM public.floor_progress fp
WHERE fp.building_id IN (SELECT id FROM riverstone_buildings);

INSERT INTO public.floor_progress (
  building_id,
  floor,
  status,
  started_at,
  ended_at
)
SELECT
  fixture_floor.building_id,
  fixture_floor.floor,
  coalesce(saved.status, 'InProgress'::public.floor_status),
  saved.started_at,
  saved.ended_at
FROM (
  SELECT DISTINCT f.building_id, f.floor
  FROM public.fixtures f
  WHERE f.building_id IN (SELECT id FROM riverstone_buildings)
) fixture_floor
LEFT JOIN riverstone_floor_status saved
  ON saved.building_id = fixture_floor.building_id
 AND saved.floor = fixture_floor.floor;

UPDATE public.buildings b
SET floors = floor_count.count
FROM (
  SELECT f.building_id, count(DISTINCT f.floor)::INTEGER AS count
  FROM public.fixtures f
  WHERE f.building_id IN (SELECT id FROM riverstone_buildings)
  GROUP BY f.building_id
) floor_count
WHERE b.id = floor_count.building_id;

COMMIT;

-- Verification: each line is now one unique floor within one building.
SELECT
  b.name AS building,
  f.floor,
  count(*) AS fixture_count
FROM public.fixtures f
JOIN public.buildings b ON b.id = f.building_id
JOIN public.campuses c ON c.id = f.campus_id
WHERE c.organization_mode = 'school_district'
  AND lower(regexp_replace(btrim(coalesce(nullif(c.school, ''), c.name)), '\s+', '', 'g')) =
      lower('RiverstoneHighSchool')
GROUP BY b.id, b.name, f.floor
ORDER BY b.name, f.floor;
