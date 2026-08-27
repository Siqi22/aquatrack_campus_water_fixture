-- Give the pre-authorized Silverbridge facilities account a consistent name.
-- This works whether the account already exists or is created after this runs.

UPDATE auth.users
SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('display_name', 'Silver Bridge Facilities')
WHERE lower(btrim(email)) = 'facilities@silverbridge.test';

UPDATE public.profiles profile
SET display_name = 'Silver Bridge Facilities'
FROM auth.users auth_user
WHERE profile.user_id = auth_user.id
  AND lower(btrim(auth_user.email)) = 'facilities@silverbridge.test';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provision public.school_district_access_provisions;
  profile_display_name TEXT;
BEGIN
  profile_display_name := CASE
    WHEN lower(btrim(NEW.email)) = 'facilities@silverbridge.test'
      THEN 'Silver Bridge Facilities'
    ELSE COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''), NEW.email)
  END;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, profile_display_name)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = CASE
      WHEN lower(btrim(NEW.email)) = 'facilities@silverbridge.test'
        THEN EXCLUDED.display_name
      ELSE public.profiles.display_name
    END;

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

SELECT
  auth_user.email,
  profile.display_name,
  auth_user.raw_user_meta_data->>'display_name' AS auth_display_name
FROM auth.users auth_user
LEFT JOIN public.profiles profile ON profile.user_id = auth_user.id
WHERE lower(btrim(auth_user.email)) = 'facilities@silverbridge.test';
