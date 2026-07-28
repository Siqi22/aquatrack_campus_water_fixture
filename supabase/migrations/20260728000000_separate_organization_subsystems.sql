-- Separate University of Washington and School District inventories while
-- preserving the existing fixture -> building -> campus source-of-truth chain.

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS organization_mode TEXT NOT NULL DEFAULT 'uw';

ALTER TABLE public.campuses
  DROP CONSTRAINT IF EXISTS campuses_organization_mode_check;

ALTER TABLE public.campuses
  ADD CONSTRAINT campuses_organization_mode_check
  CHECK (organization_mode IN ('uw', 'school_district'));

-- All records that predate subsystem support belong to the original UW
-- workspace. This update is intentionally explicit for databases where the
-- column may have been added previously without a default.
UPDATE public.campuses
SET organization_mode = 'uw'
WHERE organization_mode IS NULL
   OR organization_mode NOT IN ('uw', 'school_district');

CREATE INDEX IF NOT EXISTS campuses_created_by_organization_mode_idx
  ON public.campuses (created_by, organization_mode);
