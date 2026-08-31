-- Replace generic "My School" placeholders in Silverbridge with stable,
-- user-facing school names. Existing buildings, fixtures, and testing records
-- remain attached to the same campus IDs.

WITH silverbridge_placeholders AS (
  SELECT
    campus.id,
    row_number() OVER (ORDER BY campus.created_at, campus.id) AS school_number
  FROM public.campuses campus
  JOIN public.school_districts district ON district.id = campus.district_id
  WHERE lower(btrim(district.name)) = 'silverbridge public schools'
    AND lower(btrim(coalesce(nullif(campus.school, ''), campus.name))) = 'my school'
),
school_names AS (
  SELECT
    placeholder.id,
    CASE placeholder.school_number
      WHEN 1 THEN 'Willow Creek Elementary School'
      WHEN 2 THEN 'Lakeside Middle School'
      WHEN 3 THEN 'Summit View High School'
      WHEN 4 THEN 'Cedar Ridge Elementary School'
      WHEN 5 THEN 'Meadow Park Middle School'
      WHEN 6 THEN 'Harbor Point High School'
      ELSE 'Silverbridge School ' || placeholder.school_number
    END AS school_name
  FROM silverbridge_placeholders placeholder
)
UPDATE public.campuses campus
SET
  name = school_names.school_name,
  school = school_names.school_name,
  updated_at = now()
FROM school_names
WHERE campus.id = school_names.id;

-- Verification result for the SQL editor.
SELECT
  campus.school,
  count(DISTINCT building.id) AS buildings,
  count(DISTINCT fixture.id) AS fixtures
FROM public.campuses campus
JOIN public.school_districts district ON district.id = campus.district_id
LEFT JOIN public.buildings building ON building.campus_id = campus.id
LEFT JOIN public.fixtures fixture ON fixture.campus_id = campus.id
WHERE lower(btrim(district.name)) = 'silverbridge public schools'
GROUP BY campus.id, campus.school
ORDER BY campus.school;
