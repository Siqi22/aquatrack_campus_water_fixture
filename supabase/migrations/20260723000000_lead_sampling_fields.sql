ALTER TABLE public.lead_testing_rounds
  ADD COLUMN IF NOT EXISTS sample_draw_date DATE,
  ADD COLUMN IF NOT EXISTS sampling_method_description TEXT;

UPDATE public.lead_testing_rounds
SET sample_draw_date = sample_drawn_at::date
WHERE sample_draw_date IS NULL AND sample_drawn_at IS NOT NULL;
