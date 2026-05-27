-- Scope campus inventory to the user who created each campus (and related rows).

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
