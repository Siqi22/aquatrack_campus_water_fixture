-- Allow alphanumeric floor identifiers (e.g. G, L2, 2A)
ALTER TABLE public.fixtures
  ALTER COLUMN floor TYPE TEXT USING floor::TEXT;

ALTER TABLE public.floor_progress
  ALTER COLUMN floor TYPE TEXT USING floor::TEXT;
