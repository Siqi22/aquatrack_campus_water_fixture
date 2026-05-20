-- Import provenance (original CSV labels) — separate from survey observations.

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS import_metadata text;

UPDATE public.fixtures
SET
  import_metadata = trim(observations),
  observations = NULL
WHERE observations IS NOT NULL
  AND trim(observations) ~ '^Imported\.';
