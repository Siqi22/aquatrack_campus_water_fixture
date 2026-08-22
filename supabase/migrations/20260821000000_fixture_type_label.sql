-- Preserve a specific, user-facing fixture type while keeping the existing
-- category enum for broad grouping and backwards compatibility.

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS fixture_type_label TEXT;

UPDATE public.fixtures f
SET fixture_type_label = CASE
  WHEN f.category::TEXT <> 'Other' THEN
    CASE f.category::TEXT
      WHEN 'PorcelainFountain' THEN 'Porcelain Fountain'
      WHEN 'MetalFountain' THEN 'Metal Fountain'
      WHEN 'VendingMachine' THEN 'Vending Machine'
      WHEN 'BottleRefillStation' THEN 'Bottle Refill Station'
      WHEN 'BottleFiller' THEN 'Bottle Filler'
      WHEN 'CombinationUnit' THEN 'Combination Unit'
      WHEN 'FilteredTap' THEN 'Filtered Tap'
      WHEN 'WallFountain' THEN 'Wall Fountain'
      ELSE 'Fixture'
    END
  WHEN concat_ws(' ', f.nearest_room, f.observations, f.brand, f.model)
       ~* '(kitchen|cafeteria|culinary|food[ -]?prep|dishwash)' THEN 'Kitchen Tap'
  WHEN concat_ws(' ', f.nearest_room, f.observations, f.brand, f.model)
       ~* '(laboratory|science[ -]?lab|(^|[^a-z])lab([^a-z]|$))' THEN 'Laboratory Sink'
  WHEN concat_ws(' ', f.nearest_room, f.observations, f.brand, f.model)
       ~* '(classroom|class[ -]?room)' THEN 'Classroom Sink'
  ELSE (ARRAY['Tap', 'Sink', 'Drinking Fountain', 'Wall Fountain'])[
    1 + mod(abs(hashtext(f.id::TEXT)::BIGINT), 4)::INTEGER
  ]
END
WHERE f.fixture_type_label IS NULL
   OR btrim(f.fixture_type_label) = ''
   OR lower(btrim(f.fixture_type_label)) = 'other';

ALTER TABLE public.fixtures
  DROP CONSTRAINT IF EXISTS fixtures_fixture_type_label_not_blank;

ALTER TABLE public.fixtures
  ADD CONSTRAINT fixtures_fixture_type_label_not_blank
  CHECK (fixture_type_label IS NULL OR btrim(fixture_type_label) <> '');

COMMENT ON COLUMN public.fixtures.fixture_type_label IS
  'Specific fixture type shown to users, such as Tap, Sink, or Kitchen Tap. The category enum remains the broad grouping.';
