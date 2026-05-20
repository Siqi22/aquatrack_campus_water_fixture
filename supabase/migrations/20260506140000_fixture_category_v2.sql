-- Replace fixture_category enum with current fountain types.
-- Maps each ORIGINAL category to its successor (see ORIGINAL_CATEGORY_MIGRATION in fixtureStore.ts).

CREATE TYPE public.fixture_category_new AS ENUM (
  'PorcelainFountain',
  'MetalFountain',
  'VendingMachine',
  'BottleRefillStation',
  'Other'
);

ALTER TABLE public.fixtures
  ALTER COLUMN category DROP DEFAULT;

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
