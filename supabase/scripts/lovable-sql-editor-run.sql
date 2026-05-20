-- =============================================================================
-- Run in Lovable / Supabase → SQL Editor (one paste, then Run)
-- Safe to re-run: uses IF NOT EXISTS / checks where possible
--
-- NOTE: AI label scanning (Claude Haiku) CANNOT be turned on with SQL.
--       You must add Edge Function secrets in Lovable/Supabase (see README).
--       This script only updates the DATABASE schema + backfills data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Fountain types (fixture_category v2)
-- Skip this block if you already see PorcelainFountain, MetalFountain, etc.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'fixture_category'
      AND EXISTS (
        SELECT 1 FROM pg_enum e
        WHERE e.enumtypid = t.oid AND e.enumlabel = 'PorcelainFountain'
      )
  ) THEN
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

-- -----------------------------------------------------------------------------
-- 2) Import provenance column (original floor/category from CSV)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS import_metadata text;

-- Move legacy import lines out of observations
UPDATE public.fixtures
SET
  import_metadata = trim(observations),
  observations = NULL
WHERE observations IS NOT NULL
  AND trim(observations) ~ '^Imported\.'
  AND (import_metadata IS NULL OR trim(import_metadata) = '');

-- -----------------------------------------------------------------------------
-- 3) Floor labels as text (2M, B1, G, etc.)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fixtures
  ALTER COLUMN floor TYPE text USING floor::text;

ALTER TABLE public.floor_progress
  ALTER COLUMN floor TYPE text USING floor::text;

-- -----------------------------------------------------------------------------
-- 4) Backfill fountain type (category) from "Original category: …" text
--    Example: Original category: Metal Fountain. → MetalFountain
-- -----------------------------------------------------------------------------
UPDATE public.fixtures
SET category = CASE
  WHEN src ~* 'original category:.*porcelain' THEN 'PorcelainFountain'::public.fixture_category
  WHEN src ~* 'original category:.*metal' THEN 'MetalFountain'::public.fixture_category
  WHEN src ~* 'original category:.*vending' THEN 'VendingMachine'::public.fixture_category
  WHEN src ~* 'original category:.*(bottle|refill|combo|combination)' THEN 'BottleRefillStation'::public.fixture_category
  ELSE category
END
FROM (
  SELECT
    id,
    COALESCE(import_metadata, '') || ' ' || COALESCE(observations, '') AS src
  FROM public.fixtures
) AS x
WHERE fixtures.id = x.id
  AND x.src ~* 'original category:'
  AND fixtures.category IS DISTINCT FROM CASE
    WHEN x.src ~* 'original category:.*porcelain' THEN 'PorcelainFountain'::public.fixture_category
    WHEN x.src ~* 'original category:.*metal' THEN 'MetalFountain'::public.fixture_category
    WHEN x.src ~* 'original category:.*vending' THEN 'VendingMachine'::public.fixture_category
    WHEN x.src ~* 'original category:.*(bottle|refill|combo|combination)' THEN 'BottleRefillStation'::public.fixture_category
    ELSE fixtures.category
  END;

-- -----------------------------------------------------------------------------
-- Done. Verify (optional):
-- SELECT category, count(*) FROM fixtures GROUP BY 1 ORDER BY 1;
-- SELECT id, category, import_metadata, observations FROM fixtures LIMIT 20;
-- =============================================================================
