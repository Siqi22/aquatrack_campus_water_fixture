-- =============================================================================
-- COPY THIS ENTIRE FILE → Supabase Dashboard → SQL Editor → Run
-- Project: uamxdcridplfbjfyrrbb (Aqua Map Keeper)
-- Safe to re-run where marked IF NOT EXISTS / DO blocks
--
-- Covers incremental migrations #3–#8 (see repo supabase/migrations/).
-- NOT included (already on a live project): initial schema + tables (#1).
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

-- ── E2) Backfill category from "Original category: …" in import text ──────────
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

-- ── H) Storage: require auth to read fixture photos ─────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'fixture-photos';

DROP POLICY IF EXISTS "Public read fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth read fixture photos" ON storage.objects;

CREATE POLICY "Auth read fixture photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fixture-photos');

-- ── I) User-scoped RLS (each account sees only its own campuses/data) ─────────
-- Re-run safe: drops old global policies first.

DROP POLICY IF EXISTS "Auth read campuses" ON public.campuses;
DROP POLICY IF EXISTS "Auth insert campuses" ON public.campuses;
DROP POLICY IF EXISTS "Auth update campuses" ON public.campuses;
DROP POLICY IF EXISTS "Admin delete campuses" ON public.campuses;

DROP POLICY IF EXISTS "Auth read buildings" ON public.buildings;
DROP POLICY IF EXISTS "Auth insert buildings" ON public.buildings;
DROP POLICY IF EXISTS "Auth update buildings" ON public.buildings;
DROP POLICY IF EXISTS "Admin delete buildings" ON public.buildings;

DROP POLICY IF EXISTS "Auth read fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Auth insert fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Auth update fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Admin delete fixtures" ON public.fixtures;

DROP POLICY IF EXISTS "Auth read floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Auth insert floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Auth update floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Admin delete floor_progress" ON public.floor_progress;

DROP POLICY IF EXISTS "Users read own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users insert own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users update own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users delete own campuses" ON public.campuses;

DROP POLICY IF EXISTS "Users read own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users insert own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users update own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users delete own buildings" ON public.buildings;

DROP POLICY IF EXISTS "Users read own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users insert own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users update own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users delete own fixtures" ON public.fixtures;

DROP POLICY IF EXISTS "Users read own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users insert own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users update own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users delete own floor_progress" ON public.floor_progress;

CREATE POLICY "Users read own campuses"
  ON public.campuses FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users insert own campuses"
  ON public.campuses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users update own campuses"
  ON public.campuses FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users delete own campuses"
  ON public.campuses FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users read own buildings"
  ON public.buildings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users insert own buildings"
  ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users update own buildings"
  ON public.buildings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users delete own buildings"
  ON public.buildings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users read own fixtures"
  ON public.fixtures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users insert own fixtures"
  ON public.fixtures FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users update own fixtures"
  ON public.fixtures FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users delete own fixtures"
  ON public.fixtures FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campuses c
      WHERE c.id = campus_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users read own floor_progress"
  ON public.floor_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.campuses c ON c.id = b.campus_id
      WHERE b.id = building_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users insert own floor_progress"
  ON public.floor_progress FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.campuses c ON c.id = b.campus_id
      WHERE b.id = building_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users update own floor_progress"
  ON public.floor_progress FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.campuses c ON c.id = b.campus_id
      WHERE b.id = building_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users delete own floor_progress"
  ON public.floor_progress FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.campuses c ON c.id = b.campus_id
      WHERE b.id = building_id AND c.created_by = auth.uid()
    )
  );
