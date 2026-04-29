
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS no_label_reason text,
  ADD COLUMN IF NOT EXISTS no_label_reason_other text,
  ADD COLUMN IF NOT EXISTS photos_provided text[],
  ADD COLUMN IF NOT EXISTS location_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_by_name text;
