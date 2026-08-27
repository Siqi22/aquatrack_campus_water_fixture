-- District-scoped tenancy for AquaTrack.
--
-- Existing authenticated accounts retain access to North Valley School District.
-- facilities@silverbridge.test is provisioned for Silverbridge Public Schools;
-- if the Auth account does not exist yet, the assignment is applied on signup.

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_districts_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT school_districts_slug_not_blank CHECK (btrim(slug) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS school_districts_name_unique
  ON public.school_districts (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.school_district_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.school_districts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('district_admin', 'facilities', 'member')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_district_memberships_one_default_per_user
  ON public.school_district_memberships (user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS school_district_memberships_user_idx
  ON public.school_district_memberships (user_id, is_default DESC);

-- This table is intentionally managed through migrations/the SQL editor only.
-- It lets an administrator authorize an email before its Auth account exists.
CREATE TABLE IF NOT EXISTS public.school_district_access_provisions (
  email TEXT PRIMARY KEY,
  district_id UUID NOT NULL REFERENCES public.school_districts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('district_admin', 'facilities', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_district_access_provisions_email_lowercase
    CHECK (email = lower(btrim(email)))
);

INSERT INTO public.school_districts (id, name, slug)
SELECT
  md5('aquatrack-district-north-valley')::UUID,
  'North Valley School District',
  'north-valley'
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_districts
  WHERE lower(btrim(name)) = 'north valley school district'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.school_districts (id, name, slug)
SELECT
  md5('aquatrack-district-silverbridge')::UUID,
  'Silverbridge Public Schools',
  'silverbridge'
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_districts
  WHERE lower(btrim(name)) = 'silverbridge public schools'
)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.school_districts
    WHERE lower(btrim(name)) = 'north valley school district'
  ) THEN
    RAISE EXCEPTION 'North Valley School District could not be created or resolved.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.school_districts
    WHERE lower(btrim(name)) = 'silverbridge public schools'
  ) THEN
    RAISE EXCEPTION 'Silverbridge Public Schools could not be created or resolved.';
  END IF;
END
$$;

-- Preserve concrete legacy district names as district records before campuses
-- receive a real foreign key. Unknown legacy labels remain North Valley.
INSERT INTO public.school_districts (name, slug)
SELECT DISTINCT
  btrim(c.school_district),
  trim(both '-' FROM regexp_replace(lower(btrim(c.school_district)), '[^a-z0-9]+', '-', 'g'))
FROM public.campuses c
WHERE c.organization_mode = 'school_district'
  AND nullif(btrim(c.school_district), '') IS NOT NULL
  AND lower(btrim(c.school_district)) NOT IN (
    'unknown', 'unknown district', 'unknown school district', 'not recorded',
    'district not recorded', 'school district'
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_school_district_member(_district_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_district_memberships membership
    WHERE membership.district_id = _district_id
      AND membership.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_school_district_admin(_district_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_district_memberships membership
    WHERE membership.district_id = _district_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'district_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_district_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT membership.district_id
  FROM public.school_district_memberships membership
  WHERE membership.user_id = auth.uid()
  ORDER BY membership.is_default DESC, membership.created_at, membership.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_district()
RETURNS TABLE (district_id UUID, district_name TEXT, member_role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT district.id, district.name, membership.role
  FROM public.school_district_memberships membership
  JOIN public.school_districts district ON district.id = membership.district_id
  WHERE membership.user_id = auth.uid()
  ORDER BY membership.is_default DESC, membership.created_at, membership.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.is_school_district_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_school_district_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_district_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_district() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_district_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_district_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_district_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_district() TO authenticated;

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;

UPDATE public.campuses campus
SET district_id = COALESCE(
  (
    SELECT district.id
    FROM public.school_districts district
    WHERE lower(btrim(district.name)) = lower(btrim(campus.school_district))
    LIMIT 1
  ),
  (
    SELECT district.id FROM public.school_districts district
    WHERE lower(btrim(district.name)) = 'north valley school district'
    LIMIT 1
  )
)
WHERE campus.organization_mode = 'school_district'
  AND campus.district_id IS NULL;

ALTER TABLE public.campuses
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();

CREATE INDEX IF NOT EXISTS campuses_district_id_idx
  ON public.campuses (district_id, school);

CREATE OR REPLACE FUNCTION public.sync_campus_school_district()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_mode = 'school_district' THEN
    IF NEW.district_id IS NULL THEN
      NEW.district_id := public.current_user_district_id();
    END IF;
    SELECT district.name INTO NEW.school_district
    FROM public.school_districts district
    WHERE district.id = NEW.district_id;
    IF NEW.school_district IS NULL THEN
      RAISE EXCEPTION 'A valid school district membership is required';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sync_campus_school_district_trigger ON public.campuses;
CREATE TRIGGER sync_campus_school_district_trigger
  BEFORE INSERT OR UPDATE OF district_id, organization_mode, school_district
  ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.sync_campus_school_district();

-- Direct district keys on workflow roots make RLS and district-level uniqueness
-- explicit while the fixture relationship remains the source of truth.
ALTER TABLE public.lead_testing_report_uploads
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;
ALTER TABLE public.lead_testing_rounds
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;
ALTER TABLE public.remediation_records
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;
ALTER TABLE public.lead_testing_report_rows
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;
ALTER TABLE public.lead_testing_events
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;
ALTER TABLE public.communication_generated_reports
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.school_districts(id) ON DELETE RESTRICT;

UPDATE public.lead_testing_rounds round_row
SET district_id = campus.district_id
FROM public.fixtures fixture
JOIN public.campuses campus ON campus.id = fixture.campus_id
WHERE fixture.id = round_row.fixture_id
  AND round_row.district_id IS NULL;

UPDATE public.remediation_records remediation
SET district_id = campus.district_id
FROM public.fixtures fixture
JOIN public.campuses campus ON campus.id = fixture.campus_id
WHERE fixture.id = remediation.fixture_id
  AND remediation.district_id IS NULL;

UPDATE public.lead_testing_events event_row
SET district_id = campus.district_id
FROM public.fixtures fixture
JOIN public.campuses campus ON campus.id = fixture.campus_id
WHERE fixture.id = event_row.fixture_id
  AND event_row.district_id IS NULL;

UPDATE public.lead_testing_report_uploads upload
SET district_id = COALESCE(
  (
    SELECT district.id
    FROM public.school_districts district
    WHERE lower(btrim(district.name)) = lower(btrim(upload.district_or_organization))
    LIMIT 1
  ),
  (
    SELECT campus.district_id
    FROM public.lead_testing_report_rows report_row
    JOIN public.fixtures fixture
      ON fixture.id = COALESCE(report_row.confirmed_fixture_id, report_row.proposed_fixture_id)
    JOIN public.campuses campus ON campus.id = fixture.campus_id
    WHERE report_row.report_upload_id = upload.id
      AND campus.district_id IS NOT NULL
    LIMIT 1
  ),
  (
    SELECT testing_round.district_id
    FROM public.lead_testing_report_rows report_row
    JOIN public.lead_testing_rounds testing_round
      ON testing_round.id = report_row.imported_testing_round_id
    WHERE report_row.report_upload_id = upload.id
      AND testing_round.district_id IS NOT NULL
    LIMIT 1
  )
)
WHERE upload.district_id IS NULL;

UPDATE public.lead_testing_report_rows report_row
SET district_id = upload.district_id
FROM public.lead_testing_report_uploads upload
WHERE upload.id = report_row.report_upload_id
  AND report_row.district_id IS NULL;

UPDATE public.communication_generated_reports report
SET district_id = campus.district_id
FROM public.campuses campus
WHERE campus.id = report.campus_id
  AND report.district_id IS NULL
  AND campus.district_id IS NOT NULL;

ALTER TABLE public.lead_testing_report_uploads
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();
ALTER TABLE public.lead_testing_rounds
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();
ALTER TABLE public.remediation_records
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();
ALTER TABLE public.lead_testing_report_rows
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();
ALTER TABLE public.lead_testing_events
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();
ALTER TABLE public.communication_generated_reports
  ALTER COLUMN district_id SET DEFAULT public.current_user_district_id();

DROP INDEX IF EXISTS public.lead_report_file_sha256_unique;
DROP INDEX IF EXISTS public.lead_report_content_sha256_unique;
CREATE UNIQUE INDEX lead_report_file_sha256_unique
  ON public.lead_testing_report_uploads (district_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX lead_report_content_sha256_unique
  ON public.lead_testing_report_uploads (district_id, content_sha256)
  WHERE content_sha256 IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS public.lead_round_sample_id_unique;
DROP INDEX IF EXISTS public.lead_round_lab_sample_id_unique;
CREATE UNIQUE INDEX lead_round_sample_id_unique
  ON public.lead_testing_rounds (district_id, lower(sample_id))
  WHERE sample_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX lead_round_lab_sample_id_unique
  ON public.lead_testing_rounds (district_id, lower(laboratory_sample_id))
  WHERE laboratory_sample_id IS NOT NULL AND deleted_at IS NULL;

-- Existing accounts keep the existing North Valley workspace.
INSERT INTO public.school_district_memberships (district_id, user_id, role, is_default)
SELECT
  (
    SELECT district.id FROM public.school_districts district
    WHERE lower(btrim(district.name)) = 'north valley school district'
    LIMIT 1
  ),
  auth_user.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles user_role
      WHERE user_role.user_id = auth_user.id AND user_role.role = 'Admin'
    ) THEN 'district_admin'
    ELSE 'member'
  END,
  true
FROM auth.users auth_user
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_district_memberships existing
  WHERE existing.user_id = auth_user.id
)
ON CONFLICT (district_id, user_id) DO NOTHING;

INSERT INTO public.school_district_access_provisions (email, district_id, role)
VALUES (
  'facilities@silverbridge.test',
  (
    SELECT district.id FROM public.school_districts district
    WHERE lower(btrim(district.name)) = 'silverbridge public schools'
    LIMIT 1
  ),
  'facilities'
)
ON CONFLICT (email) DO UPDATE SET
  district_id = EXCLUDED.district_id,
  role = EXCLUDED.role;

-- If the Silverbridge user already exists, replace any legacy workspace access
-- so this account can reach Silverbridge and no other district.
DELETE FROM public.school_district_memberships membership
WHERE membership.user_id IN (
  SELECT auth_user.id FROM auth.users auth_user
  WHERE lower(auth_user.email) = 'facilities@silverbridge.test'
);

INSERT INTO public.school_district_memberships (district_id, user_id, role, is_default)
SELECT
  provision.district_id,
  auth_user.id,
  provision.role,
  true
FROM auth.users auth_user
JOIN public.school_district_access_provisions provision
  ON provision.email = lower(auth_user.email)
WHERE lower(auth_user.email) = 'facilities@silverbridge.test'
ON CONFLICT (district_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_default = true;

INSERT INTO public.user_roles (user_id, role)
SELECT auth_user.id, 'Facilities'::public.app_role
FROM auth.users auth_user
WHERE lower(auth_user.email) = 'facilities@silverbridge.test'
ON CONFLICT (user_id, role) DO NOTHING;

-- Preserve profile/role creation and apply pre-authorized district access when
-- a new account is created later.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provision public.school_district_access_provisions;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(btrim(NEW.email)) = 'facilities@silverbridge.test'
        THEN 'Silver Bridge Facilities'
      ELSE COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''), NEW.email)
    END
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Surveyor')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT * INTO provision
  FROM public.school_district_access_provisions access
  WHERE access.email = lower(btrim(NEW.email));

  IF provision.email IS NOT NULL THEN
    INSERT INTO public.school_district_memberships (district_id, user_id, role, is_default)
    VALUES (provision.district_id, NEW.id, provision.role, true)
    ON CONFLICT (district_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      is_default = true;

    IF provision.role = 'facilities' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'Facilities')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- Replace every historical broad/user-owned policy on district data with
-- membership-based policies. Storage policies are handled separately below.
DO $$
DECLARE
  table_name TEXT;
  policy RECORD;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'campuses', 'buildings', 'fixtures', 'floor_progress',
    'maintenance_history_archive', 'lead_testing_report_uploads',
    'lead_testing_rounds', 'remediation_records', 'lead_testing_report_rows',
    'lead_testing_events', 'communication_generated_reports'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy.policyname, table_name);
    END LOOP;
  END LOOP;
END
$$;

ALTER TABLE public.school_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_district_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_district_access_provisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.school_districts TO authenticated;
GRANT SELECT ON public.school_district_memberships TO authenticated;

CREATE POLICY "Members read their districts"
  ON public.school_districts FOR SELECT TO authenticated
  USING (public.is_school_district_member(id));

CREATE POLICY "Users read own district memberships"
  ON public.school_district_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "District members read campuses"
  ON public.campuses FOR SELECT TO authenticated
  USING (district_id IS NOT NULL AND public.is_school_district_member(district_id));
CREATE POLICY "District members create campuses"
  ON public.campuses FOR INSERT TO authenticated
  WITH CHECK (district_id IS NOT NULL AND public.is_school_district_member(district_id));
CREATE POLICY "District members update campuses"
  ON public.campuses FOR UPDATE TO authenticated
  USING (district_id IS NOT NULL AND public.is_school_district_member(district_id))
  WITH CHECK (district_id IS NOT NULL AND public.is_school_district_member(district_id));
CREATE POLICY "District admins delete campuses"
  ON public.campuses FOR DELETE TO authenticated
  USING (public.is_school_district_admin(district_id));

CREATE POLICY "District members read buildings"
  ON public.buildings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = buildings.campus_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District members create buildings"
  ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = buildings.campus_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District members update buildings"
  ON public.buildings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = buildings.campus_id
      AND public.is_school_district_member(campus.district_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = buildings.campus_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District admins delete buildings"
  ON public.buildings FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = buildings.campus_id
      AND public.is_school_district_admin(campus.district_id)
  ));

CREATE POLICY "District members read fixtures"
  ON public.fixtures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = fixtures.campus_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District members create fixtures"
  ON public.fixtures FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campuses campus
      WHERE campus.id = fixtures.campus_id
        AND public.is_school_district_member(campus.district_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.buildings building
      WHERE building.id = fixtures.building_id
        AND building.campus_id = fixtures.campus_id
    )
  );
CREATE POLICY "District members update fixtures"
  ON public.fixtures FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = fixtures.campus_id
      AND public.is_school_district_member(campus.district_id)
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campuses campus
      WHERE campus.id = fixtures.campus_id
        AND public.is_school_district_member(campus.district_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.buildings building
      WHERE building.id = fixtures.building_id
        AND building.campus_id = fixtures.campus_id
    )
  );
CREATE POLICY "District admins delete fixtures"
  ON public.fixtures FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campuses campus
    WHERE campus.id = fixtures.campus_id
      AND public.is_school_district_admin(campus.district_id)
  ));

CREATE POLICY "District members read floor progress"
  ON public.floor_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings building
    JOIN public.campuses campus ON campus.id = building.campus_id
    WHERE building.id = floor_progress.building_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District members create floor progress"
  ON public.floor_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.buildings building
    JOIN public.campuses campus ON campus.id = building.campus_id
    WHERE building.id = floor_progress.building_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District members update floor progress"
  ON public.floor_progress FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings building
    JOIN public.campuses campus ON campus.id = building.campus_id
    WHERE building.id = floor_progress.building_id
      AND public.is_school_district_member(campus.district_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.buildings building
    JOIN public.campuses campus ON campus.id = building.campus_id
    WHERE building.id = floor_progress.building_id
      AND public.is_school_district_member(campus.district_id)
  ));
CREATE POLICY "District admins delete floor progress"
  ON public.floor_progress FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings building
    JOIN public.campuses campus ON campus.id = building.campus_id
    WHERE building.id = floor_progress.building_id
      AND public.is_school_district_admin(campus.district_id)
  ));

CREATE POLICY "District members read maintenance archive"
  ON public.maintenance_history_archive FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fixtures fixture
    JOIN public.campuses campus ON campus.id = fixture.campus_id
    WHERE fixture.id = maintenance_history_archive.fixture_id
      AND public.is_school_district_member(campus.district_id)
  ));

CREATE POLICY "District members manage lead uploads"
  ON public.lead_testing_report_uploads FOR ALL TO authenticated
  USING (public.is_school_district_member(district_id))
  WITH CHECK (public.is_school_district_member(district_id));

CREATE POLICY "District members manage lead rounds"
  ON public.lead_testing_rounds FOR ALL TO authenticated
  USING (public.is_school_district_member(district_id))
  WITH CHECK (
    public.is_school_district_member(district_id)
    AND EXISTS (
      SELECT 1 FROM public.fixtures fixture
      JOIN public.campuses campus ON campus.id = fixture.campus_id
      WHERE fixture.id = lead_testing_rounds.fixture_id
        AND campus.district_id = lead_testing_rounds.district_id
    )
  );

CREATE POLICY "District members manage remediation"
  ON public.remediation_records FOR ALL TO authenticated
  USING (public.is_school_district_member(district_id))
  WITH CHECK (
    public.is_school_district_member(district_id)
    AND EXISTS (
      SELECT 1 FROM public.fixtures fixture
      JOIN public.campuses campus ON campus.id = fixture.campus_id
      WHERE fixture.id = remediation_records.fixture_id
        AND campus.district_id = remediation_records.district_id
    )
  );

CREATE POLICY "District members manage lead report rows"
  ON public.lead_testing_report_rows FOR ALL TO authenticated
  USING (public.is_school_district_member(district_id))
  WITH CHECK (
    public.is_school_district_member(district_id)
    AND EXISTS (
      SELECT 1 FROM public.lead_testing_report_uploads upload
      WHERE upload.id = lead_testing_report_rows.report_upload_id
        AND upload.district_id = lead_testing_report_rows.district_id
    )
  );

CREATE POLICY "District members manage lead events"
  ON public.lead_testing_events FOR ALL TO authenticated
  USING (public.is_school_district_member(district_id))
  WITH CHECK (
    public.is_school_district_member(district_id)
    AND EXISTS (
      SELECT 1 FROM public.fixtures fixture
      JOIN public.campuses campus ON campus.id = fixture.campus_id
      WHERE fixture.id = lead_testing_events.fixture_id
        AND campus.district_id = lead_testing_events.district_id
    )
  );

CREATE POLICY "District members read communication reports"
  ON public.communication_generated_reports FOR SELECT TO authenticated
  USING (public.is_school_district_member(district_id));
CREATE POLICY "District members create own communication reports"
  ON public.communication_generated_reports FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_school_district_member(district_id)
    AND (
      campus_id IS NULL OR EXISTS (
        SELECT 1 FROM public.campuses campus
        WHERE campus.id = communication_generated_reports.campus_id
          AND campus.district_id = communication_generated_reports.district_id
      )
    )
  );
CREATE POLICY "Users update own communication reports"
  ON public.communication_generated_reports FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_school_district_member(district_id))
  WITH CHECK (created_by = auth.uid() AND public.is_school_district_member(district_id));
CREATE POLICY "Users delete own communication reports"
  ON public.communication_generated_reports FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() OR public.is_school_district_admin(district_id))
    AND public.is_school_district_member(district_id)
  );

-- Lead report objects remain private to their uploader. The database review
-- rows are shared with authorized district teammates.
DROP POLICY IF EXISTS "Authenticated upload lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Users read own lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Users update own lead reports" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own lead reports" ON storage.objects;

CREATE POLICY "Users upload own lead reports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-testing-reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users read own lead reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-testing-reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users update own lead reports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lead-testing-reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'lead-testing-reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users delete own lead reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lead-testing-reports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Fixture photos were originally public. Keep new objects private and scoped
-- to the authenticated uploader; fixture rows themselves remain district-shared.
UPDATE storage.buckets
SET public = false
WHERE id = 'fixture-photos';

DROP POLICY IF EXISTS "Public read fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner update fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read own fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own fixture photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own fixture photos" ON storage.objects;

CREATE POLICY "Users upload own fixture photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fixture-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users read own fixture photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fixture-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users update own fixture photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fixture-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'fixture-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
CREATE POLICY "Users delete own fixture photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fixture-photos'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification after running in Supabase SQL Editor:
SELECT
  district.name AS district,
  auth_user.email,
  membership.role,
  membership.is_default
FROM public.school_district_memberships membership
JOIN public.school_districts district ON district.id = membership.district_id
JOIN auth.users auth_user ON auth_user.id = membership.user_id
ORDER BY district.name, auth_user.email;
