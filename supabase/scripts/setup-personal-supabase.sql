-- ============================================================
-- AquaTrack personal Supabase setup
-- ============================================================
-- Use this for a fresh Supabase project OR a partially-created AquaTrack project.
-- Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- This script is data-preserving. It creates missing objects and repairs older
-- AquaTrack/Lovable-era schema shapes, but it does not drop app data tables.
--
-- After running this, set your app env vars:
-- VITE_SUPABASE_URL
-- VITE_SUPABASE_PUBLISHABLE_KEY
-- VITE_SUPABASE_PROJECT_ID

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Enums
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('Surveyor', 'Facilities', 'Admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'fixture_category') THEN
    CREATE TYPE public.fixture_category AS ENUM (
      'PorcelainFountain',
      'MetalFountain',
      'VendingMachine',
      'BottleRefillStation',
      'Other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'floor_status') THEN
    CREATE TYPE public.floor_status AS ENUM ('NotStarted', 'InProgress', 'Done', 'Restricted');
  END IF;
END $$;

-- If an older AquaTrack fixture_category enum already exists, migrate it to the
-- current values the app expects while preserving fixture rows.
DO $$
DECLARE
  has_old_category_values BOOLEAN;
  fixtures_category_uses_enum BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'fixture_category'
      AND e.enumlabel IN ('BottleFiller', 'WallFountain', 'CombinationUnit', 'FilteredTap')
  )
  INTO has_old_category_values;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fixtures'
      AND column_name = 'category'
      AND udt_name = 'fixture_category'
  )
  INTO fixtures_category_uses_enum;

  IF has_old_category_values THEN
    DROP TYPE IF EXISTS public.fixture_category_new;

    CREATE TYPE public.fixture_category_new AS ENUM (
      'PorcelainFountain',
      'MetalFountain',
      'VendingMachine',
      'BottleRefillStation',
      'Other'
    );

    IF fixtures_category_uses_enum THEN
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
            ELSE 'Other'::public.fixture_category_new
          END
        );
    END IF;

    DROP TYPE public.fixture_category;
    ALTER TYPE public.fixture_category_new RENAME TO fixture_category;

    IF fixtures_category_uses_enum THEN
      ALTER TABLE public.fixtures
        ALTER COLUMN category SET DEFAULT 'Other'::public.fixture_category;
    END IF;
  END IF;
END $$;

-- ============================================================
-- Shared functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Auth profile and roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Surveyor')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- App data tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS school TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floors INTEGER NOT NULL DEFAULT 1,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  collection_started_at DATE,
  collection_ended_at DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS floors INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS collection_started_at DATE,
  ADD COLUMN IF NOT EXISTS collection_ended_at DATE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor TEXT NOT NULL,
  nearest_room TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  filter_type TEXT,
  category public.fixture_category NOT NULL DEFAULT 'Other',
  pressure_rating INTEGER NOT NULL DEFAULT 3 CHECK (pressure_rating BETWEEN 1 AND 5),
  cleanliness_rating INTEGER NOT NULL DEFAULT 3 CHECK (cleanliness_rating BETWEEN 1 AND 5),
  observations TEXT,
  issues TEXT[],
  pos_x NUMERIC,
  pos_y NUMERIC,
  photo_url TEXT,
  model_plate_photo_url TEXT,
  installation_date DATE,
  last_maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  no_label_reason TEXT,
  no_label_reason_other TEXT,
  photos_provided TEXT[],
  location_confirmed BOOLEAN NOT NULL DEFAULT false,
  saved_by_name TEXT,
  import_metadata TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS nearest_room TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS filter_type TEXT,
  ADD COLUMN IF NOT EXISTS category public.fixture_category NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS pressure_rating INTEGER NOT NULL DEFAULT 3 CHECK (pressure_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER NOT NULL DEFAULT 3 CHECK (cleanliness_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS issues TEXT[],
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC,
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS model_plate_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS installation_date DATE,
  ADD COLUMN IF NOT EXISTS last_maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS no_label_reason TEXT,
  ADD COLUMN IF NOT EXISTS no_label_reason_other TEXT,
  ADD COLUMN IF NOT EXISTS photos_provided TEXT[],
  ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS import_metadata TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Older schema used room_number and numeric floors. The current app uses
-- nearest_room and text floors such as G, LL, 2M.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fixtures'
      AND column_name = 'room_number'
  ) THEN
    UPDATE public.fixtures
    SET nearest_room = COALESCE(NULLIF(TRIM(nearest_room), ''), NULLIF(TRIM(room_number), ''), 'Unknown')
    WHERE nearest_room IS NULL OR TRIM(nearest_room) = '';
  ELSE
    UPDATE public.fixtures
    SET nearest_room = COALESCE(NULLIF(TRIM(nearest_room), ''), 'Unknown')
    WHERE nearest_room IS NULL OR TRIM(nearest_room) = '';
  END IF;
END $$;

ALTER TABLE public.fixtures
  ALTER COLUMN floor TYPE TEXT USING floor::TEXT,
  ALTER COLUMN nearest_room SET NOT NULL;

ALTER TABLE public.fixtures
  DROP COLUMN IF EXISTS room_number;

UPDATE public.fixtures
SET floor = '1'
WHERE floor IS NULL OR TRIM(floor) = '';

ALTER TABLE public.fixtures
  ALTER COLUMN floor SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.floor_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor TEXT NOT NULL,
  status public.floor_status NOT NULL DEFAULT 'NotStarted',
  restricted_reason TEXT,
  notes TEXT,
  started_at DATE,
  ended_at DATE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, floor)
);

ALTER TABLE public.floor_progress
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS status public.floor_status NOT NULL DEFAULT 'NotStarted',
  ADD COLUMN IF NOT EXISTS restricted_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS started_at DATE,
  ADD COLUMN IF NOT EXISTS ended_at DATE,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.floor_progress
  ALTER COLUMN floor TYPE TEXT USING floor::TEXT,
  ALTER COLUMN floor DROP NOT NULL;

UPDATE public.floor_progress
SET floor = '1'
WHERE floor IS NULL OR TRIM(floor) = '';

ALTER TABLE public.floor_progress
  ALTER COLUMN floor SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'floor_progress_building_id_floor_key'
      AND conrelid = 'public.floor_progress'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.floor_progress
    GROUP BY building_id, floor
    HAVING COUNT(*) > 1
  ) THEN
    ALTER TABLE public.floor_progress
      ADD CONSTRAINT floor_progress_building_id_floor_key UNIQUE (building_id, floor);
  ELSIF EXISTS (
    SELECT 1
    FROM public.floor_progress
    GROUP BY building_id, floor
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped floor_progress unique constraint because duplicate building/floor rows exist.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buildings_campus ON public.buildings(campus_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_building ON public.fixtures(building_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_campus ON public.fixtures(campus_id);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_progress ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_campuses_updated_at ON public.campuses;
CREATE TRIGGER update_campuses_updated_at
  BEFORE UPDATE ON public.campuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_buildings_updated_at ON public.buildings;
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fixtures_updated_at ON public.fixtures;
CREATE TRIGGER update_fixtures_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_floor_progress_updated_at ON public.floor_progress;
CREATE TRIGGER update_floor_progress_updated_at
  BEFORE UPDATE ON public.floor_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users insert own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users update own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Users delete own campuses" ON public.campuses;
DROP POLICY IF EXISTS "Authenticated users read shared campuses" ON public.campuses;
DROP POLICY IF EXISTS "Authenticated users insert shared campuses" ON public.campuses;
DROP POLICY IF EXISTS "Authenticated users update shared campuses" ON public.campuses;
DROP POLICY IF EXISTS "Admins delete shared campuses" ON public.campuses;

CREATE POLICY "Authenticated users read shared campuses"
  ON public.campuses FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users insert shared campuses"
  ON public.campuses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users update shared campuses"
  ON public.campuses FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins delete shared campuses"
  ON public.campuses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS "Users read own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users insert own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users update own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users delete own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated users read shared buildings" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated users insert shared buildings" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated users update shared buildings" ON public.buildings;
DROP POLICY IF EXISTS "Admins delete shared buildings" ON public.buildings;

CREATE POLICY "Authenticated users read shared buildings"
  ON public.buildings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users insert shared buildings"
  ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users update shared buildings"
  ON public.buildings FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins delete shared buildings"
  ON public.buildings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS "Users read own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users insert own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users update own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Users delete own fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Authenticated users read shared fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Authenticated users insert shared fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Authenticated users update shared fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Admins delete shared fixtures" ON public.fixtures;

CREATE POLICY "Authenticated users read shared fixtures"
  ON public.fixtures FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users insert shared fixtures"
  ON public.fixtures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users update shared fixtures"
  ON public.fixtures FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins delete shared fixtures"
  ON public.fixtures FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

DROP POLICY IF EXISTS "Users read own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users insert own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users update own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Users delete own floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Authenticated users read shared floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Authenticated users insert shared floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Authenticated users update shared floor_progress" ON public.floor_progress;
DROP POLICY IF EXISTS "Admins delete shared floor_progress" ON public.floor_progress;

CREATE POLICY "Authenticated users read shared floor_progress"
  ON public.floor_progress FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users insert shared floor_progress"
  ON public.floor_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users update shared floor_progress"
  ON public.floor_progress FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins delete shared floor_progress"
  ON public.floor_progress FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));

-- ============================================================
-- Fixture photo storage
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fixture-photos', 'fixture-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Public read fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth read fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner update fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete fixture photos" ON storage.objects;

CREATE POLICY "Auth read fixture photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fixture-photos');

CREATE POLICY "Auth upload fixture photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fixture-photos');

CREATE POLICY "Owner update fixture photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fixture-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'fixture-photos' AND owner = auth.uid());

CREATE POLICY "Owner delete fixture photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fixture-photos' AND owner = auth.uid());

NOTIFY pgrst, 'reload schema';

-- Quick checks: these should return rows after running.
SELECT 'tables' AS check_name, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_roles', 'campuses', 'buildings', 'fixtures', 'floor_progress')
ORDER BY table_name;

SELECT 'bucket' AS check_name, id, public
FROM storage.buckets
WHERE id = 'fixture-photos';
