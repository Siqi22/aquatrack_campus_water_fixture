ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS school_district TEXT;

ALTER TABLE public.lead_testing_report_rows
  ADD COLUMN IF NOT EXISTS school_district TEXT;
