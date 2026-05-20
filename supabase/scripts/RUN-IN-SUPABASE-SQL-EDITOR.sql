-- =============================================================================
-- COPY THIS ENTIRE FILE → Supabase Dashboard → SQL Editor → Run
-- Project: uamxdcridplfbjfyrrbb (Aqua Map Keeper)
-- Safe to re-run where marked IF NOT EXISTS / DO blocks
-- =============================================================================

-- ── A) Columns the app expects on fixtures (survey / add fixture) ─────────────
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS no_label_reason text,
  ADD COLUMN IF NOT EXISTS no_label_reason_other text,
  ADD COLUMN IF NOT EXISTS photos_provided text[],
  ADD COLUMN IF NOT EXISTS location_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_by_name text,
  ADD COLUMN IF NOT EXISTS import_metadata text;

-- ── B) Fountain types v2 (REQUIRED — fixes "fountain type update" error) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'fixture_category'
      AND e.enumlabel = 'PorcelainFountain'
  ) THEN
    -- Clean up a failed prior attempt, if any
    DROP TYPE IF EXISTS public.fixture_category_new;

    CREATE TYPE public.fixture_category_new AS ENUM (
      'PorcelainFountain',
      'MetalFountain',
      'VendingMachine',
      'BottleRefillStation',
      'Other'
    );

    ALTER TABLE public.fixtures ALTER COLUMN category DROP DEFAULT;

    ALTER TABLE public.fixtures
      ALTER COLUMN category TYPE public.fixture_category_new
      USING (
        CASE category::text
          WHEN 'BottleFiller' THEN 'BottleRefillStation'::public.fixture_category_new
          WHEN 'CombinationUnit' THEN 'BottleRefillStation'::public.fixture_category_new
          WHEN 'FilteredTap' THEN 'Other'::public.fixture_category_new
          WHEN 'WallFountain' THEN 'Other'::public.fixture_category_new
          WHEN 'PorcelainFountain' THEN 'PorcelainFountain'::public.fixture_category_new
          WHEN 'MetalFountain' THEN 'MetalFountain'::public.fixture_category_new
          WHEN 'VendingMachine' THEN 'VendingMachine'::public.fixture_category_new
          WHEN 'BottleRefillStation' THEN 'BottleRefillStation'::public.fixture_category_new
          WHEN 'Other' THEN 'Other'::public.fixture_category_new
          ELSE 'Other'::public.fixture_category_new
        END
      );

    DROP TYPE public.fixture_category;
    ALTER TYPE public.fixture_category_new RENAME TO fixture_category;

    ALTER TABLE public.fixtures
      ALTER COLUMN category SET DEFAULT 'Other'::public.fixture_category;
  END IF;
END $$;

-- ── C) Location: drop room_number, use nearest_room only ─────────────────────
ALTER TABLE public.fixtures DROP COLUMN IF EXISTS room_number;

UPDATE public.fixtures
SET nearest_room = COALESCE(NULLIF(TRIM(nearest_room), ''), 'Unknown')
WHERE nearest_room IS NULL OR TRIM(nearest_room) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fixtures' AND column_name = 'nearest_room'
  ) THEN
    ALTER TABLE public.fixtures ALTER COLUMN nearest_room SET NOT NULL;
  END IF;
END $$;

-- ── D) Floor as text (G, 2M, B1, …) ───────────────────────────────────────────
ALTER TABLE public.fixtures
  ALTER COLUMN floor TYPE text USING floor::text;

ALTER TABLE public.floor_progress
  ALTER COLUMN floor TYPE text USING floor::text;

-- ── E) Move legacy import lines out of observations ───────────────────────────
UPDATE public.fixtures
SET
  import_metadata = trim(observations),
  observations = NULL
WHERE observations IS NOT NULL
  AND trim(observations) ~ '^Imported\.'
  AND (import_metadata IS NULL OR trim(import_metadata) = '');

-- ── F) Refresh API schema cache (important after enum change) ───────────────
NOTIFY pgrst, 'reload schema';

-- ── G) VERIFY — you should see 5 fountain types below ───────────────────────
SELECT enumlabel AS fountain_type
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'fixture_category'
ORDER BY e.enumsortorder;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fixtures'
  AND column_name IN ('category', 'nearest_room', 'room_number', 'floor', 'import_metadata', 'location_confirmed')
ORDER BY column_name;
