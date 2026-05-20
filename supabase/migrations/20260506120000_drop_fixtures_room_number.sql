-- Location is stored only in nearest_room (room_number removed from app + DB).
ALTER TABLE public.fixtures
  DROP COLUMN IF EXISTS room_number;

-- Ensure location is always present where room_number used to be required.
UPDATE public.fixtures
SET nearest_room = COALESCE(NULLIF(TRIM(nearest_room), ''), 'Unknown')
WHERE nearest_room IS NULL OR TRIM(nearest_room) = '';

ALTER TABLE public.fixtures
  ALTER COLUMN nearest_room SET NOT NULL;
