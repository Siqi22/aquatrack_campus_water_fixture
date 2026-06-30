-- ============================================================
-- AquaTrack shared inventory RLS migration
-- ============================================================
-- Run this in Supabase Dashboard -> SQL Editor for an existing project.
--
-- This changes app data from "only the creator can see/edit it" to a shared
-- authenticated workspace:
--   - all logged-in users can read, insert, and update campuses/buildings/
--     fixtures/floor_progress
--   - only Admin users can delete shared app data
--
-- It does not delete or rewrite any app data.

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

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_progress ENABLE ROW LEVEL SECURITY;

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

NOTIFY pgrst, 'reload schema';

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campuses', 'buildings', 'fixtures', 'floor_progress')
ORDER BY tablename, policyname;
