-- Run once in the Supabase SQL Editor.
-- Keeps every concrete district name and only replaces missing/unknown values.

BEGIN;

UPDATE public.campuses
SET school_district = 'North Valley School District'
WHERE organization_mode = 'school_district'
  AND lower(btrim(coalesce(school_district, ''))) IN (
    '',
    'unknown',
    'unknown district',
    'unknown school district',
    'not recorded',
    'district not recorded',
    'school district'
  );

UPDATE public.lead_testing_report_rows AS report_row
SET school_district = coalesce(
  (
    SELECT campus.school_district
    FROM public.campuses AS campus
    WHERE campus.organization_mode = 'school_district'
      AND lower(btrim(campus.school)) = lower(btrim(report_row.school_name))
    ORDER BY campus.created_at
    LIMIT 1
  ),
  'North Valley School District'
)
WHERE lower(btrim(coalesce(report_row.school_district, ''))) IN (
  '',
  'unknown',
  'unknown district',
  'unknown school district',
  'not recorded',
  'district not recorded',
  'school district'
);

UPDATE public.lead_testing_report_uploads AS report_upload
SET district_or_organization = coalesce(
  (
    SELECT report_row.school_district
    FROM public.lead_testing_report_rows AS report_row
    WHERE report_row.report_upload_id = report_upload.id
      AND nullif(btrim(report_row.school_district), '') IS NOT NULL
    ORDER BY report_row.row_number
    LIMIT 1
  ),
  'North Valley School District'
)
WHERE lower(btrim(coalesce(report_upload.district_or_organization, ''))) IN (
  '',
  'unknown',
  'unknown district',
  'unknown school district',
  'not recorded',
  'district not recorded',
  'school district'
);

COMMIT;

SELECT
  school_district,
  count(*) AS school_count
FROM public.campuses
WHERE organization_mode = 'school_district'
GROUP BY school_district
ORDER BY school_district;
