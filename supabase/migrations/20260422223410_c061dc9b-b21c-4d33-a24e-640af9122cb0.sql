
-- ============================================================
-- AquaTrack: schema, roles, RLS, storage
-- ============================================================

-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('Surveyor', 'Facilities', 'Admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Updated-at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default Surveyor role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Surveyor');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Domain tables
-- ============================================================
CREATE TABLE public.campuses (
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
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_campuses_updated_at BEFORE UPDATE ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.buildings (
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
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_buildings_campus ON public.buildings(campus_id);
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.fixture_category AS ENUM (
  'BottleFiller','WallFountain','CombinationUnit','FilteredTap','Other'
);
CREATE TYPE public.floor_status AS ENUM ('NotStarted','InProgress','Done','Restricted');

CREATE TABLE public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
  room_number TEXT NOT NULL,
  nearest_room TEXT,
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
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fixtures_building ON public.fixtures(building_id);
CREATE INDEX idx_fixtures_campus ON public.fixtures(campus_id);
CREATE TRIGGER update_fixtures_updated_at BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.floor_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
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
ALTER TABLE public.floor_progress ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_floor_progress_updated_at BEFORE UPDATE ON public.floor_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS: any authenticated user can read everything;
-- Surveyors+ can write. Admins can delete.
-- ============================================================
CREATE POLICY "Auth read campuses" ON public.campuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert campuses" ON public.campuses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update campuses" ON public.campuses FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete campuses" ON public.campuses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Auth read buildings" ON public.buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert buildings" ON public.buildings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update buildings" ON public.buildings FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete buildings" ON public.buildings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Auth read fixtures" ON public.fixtures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fixtures" ON public.fixtures FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update fixtures" ON public.fixtures FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete fixtures" ON public.fixtures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Auth read floor_progress" ON public.floor_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert floor_progress" ON public.floor_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update floor_progress" ON public.floor_progress FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete floor_progress" ON public.floor_progress FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));

-- ============================================================
-- Storage: public bucket for fixture photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('fixture-photos', 'fixture-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read fixture photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fixture-photos');

CREATE POLICY "Auth upload fixture photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fixture-photos');

CREATE POLICY "Owner update fixture photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fixture-photos' AND owner = auth.uid());

CREATE POLICY "Owner delete fixture photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fixture-photos' AND owner = auth.uid());
