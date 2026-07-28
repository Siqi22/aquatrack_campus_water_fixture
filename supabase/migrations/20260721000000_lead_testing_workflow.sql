-- Complete fixture-centered lead testing workflow.
-- Legacy maintenance values are preserved in maintenance_history_archive before
-- the maintenance UI is retired. The fixture column remains for compatibility.

CREATE TYPE public.lead_round_type AS ENUM ('initial_test','confirmation_test','flush_sample','retest','post_remediation_retest','other');
CREATE TYPE public.lead_testing_status AS ENUM ('not_started','scheduled','sample_drawn','awaiting_results','results_received','action_required','remediation_in_progress','awaiting_retest','retest_sample_drawn','awaiting_retest_results','complete','invalid_or_inconclusive');
CREATE TYPE public.fixture_availability_status AS ENUM ('available_for_consumption','temporarily_restricted','handwash_only','shut_off','inaccessible','permanently_removed');
CREATE TYPE public.remediation_type AS ENUM ('shut_off_outlet','make_inaccessible','restrict_to_handwashing','remove_from_service','replace_fixture','replace_component','install_filter','replace_filter','replace_plumbing','fixture_conditioning','flushing','other');
CREATE TYPE public.remediation_status AS ENUM ('not_started','planned','in_progress','completed','awaiting_retest','verified','unsuccessful','additional_action_required');
CREATE TYPE public.conditioning_status AS ENUM ('not_required','not_started','in_progress','completed');
CREATE TYPE public.report_processing_status AS ENUM ('uploaded','extracting','ready_for_review','partially_matched','imported','failed');
CREATE TYPE public.report_match_status AS ENUM ('high_confidence_match','possible_match','multiple_matches','no_match','manually_matched','excluded','imported');

CREATE TABLE public.maintenance_history_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  legacy_last_maintenance_date DATE NOT NULL, legacy_filter_type TEXT, archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, legacy_last_maintenance_date)
);
INSERT INTO public.maintenance_history_archive (fixture_id, legacy_last_maintenance_date, legacy_filter_type)
SELECT id, last_maintenance_date, filter_type FROM public.fixtures ON CONFLICT DO NOTHING;

ALTER TABLE public.fixtures
  ADD COLUMN current_lead_testing_status public.lead_testing_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN current_required_action TEXT NOT NULL DEFAULT 'Sampling required',
  ADD COLUMN current_result_ppb NUMERIC,
  ADD COLUMN current_result_category TEXT,
  ADD COLUMN current_testing_round_id UUID,
  ADD COLUMN fixture_availability_status public.fixture_availability_status NOT NULL DEFAULT 'available_for_consumption',
  ADD COLUMN lead_testing_last_updated_at TIMESTAMPTZ;

CREATE TABLE public.lead_testing_report_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), file_name TEXT NOT NULL, file_url TEXT NOT NULL, file_type TEXT NOT NULL CHECK (file_type IN ('csv','xlsx','pdf')),
  file_sha256 TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), district_or_organization TEXT,
  laboratory_name TEXT, report_date DATE, processing_status public.report_processing_status NOT NULL DEFAULT 'uploaded', extracted_row_count INTEGER NOT NULL DEFAULT 0,
  matched_row_count INTEGER NOT NULL DEFAULT 0, unresolved_row_count INTEGER NOT NULL DEFAULT 0, error_message TEXT, deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX lead_report_file_sha256_unique ON public.lead_testing_report_uploads(file_sha256) WHERE file_sha256 IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.lead_testing_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  round_type public.lead_round_type NOT NULL DEFAULT 'initial_test', round_number INTEGER NOT NULL CHECK (round_number > 0),
  status public.lead_testing_status NOT NULL DEFAULT 'not_started', sample_id TEXT, laboratory_sample_id TEXT, sample_drawn_at TIMESTAMPTZ,
  sample_draw_date DATE, sample_collector_name TEXT, sampling_method TEXT, sampling_method_description TEXT, stagnation_start_at TIMESTAMPTZ, result_value TEXT, result_original_unit TEXT,
  result_ppb NUMERIC CHECK (result_ppb >= 0), result_category TEXT, result_received_at TIMESTAMPTZ, required_action TEXT NOT NULL DEFAULT 'Sampling required',
  report_upload_id UUID REFERENCES public.lead_testing_report_uploads(id) ON DELETE SET NULL, report_row_reference TEXT, matching_method TEXT,
  matching_confidence NUMERIC CHECK (matching_confidence BETWEEN 0 AND 1), notes TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
  UNIQUE (fixture_id, round_number)
);
CREATE UNIQUE INDEX lead_round_sample_id_unique ON public.lead_testing_rounds (lower(sample_id)) WHERE sample_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX lead_round_lab_sample_id_unique ON public.lead_testing_rounds (lower(laboratory_sample_id)) WHERE laboratory_sample_id IS NOT NULL AND deleted_at IS NULL;
ALTER TABLE public.fixtures ADD CONSTRAINT fixtures_current_testing_round_fk FOREIGN KEY (current_testing_round_id) REFERENCES public.lead_testing_rounds(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.remediation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  triggering_testing_round_id UUID NOT NULL REFERENCES public.lead_testing_rounds(id) ON DELETE RESTRICT, remediation_type public.remediation_type NOT NULL,
  status public.remediation_status NOT NULL DEFAULT 'not_started', description TEXT, target_date DATE, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  responsible_person TEXT, contractor_or_company TEXT, manufacturer TEXT, product_name TEXT, model TEXT, serial_number TEXT, fixture_type TEXT,
  installation_date DATE, photo_url TEXT, notes TEXT, retest_required BOOLEAN NOT NULL DEFAULT true,
  follow_up_testing_round_id UUID REFERENCES public.lead_testing_rounds(id) ON DELETE SET NULL, conditioning_status public.conditioning_status NOT NULL DEFAULT 'not_required',
  conditioning_method TEXT, conditioning_started_at TIMESTAMPTZ, conditioning_completed_at TIMESTAMPTZ, conditioning_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE public.lead_testing_report_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), report_upload_id UUID NOT NULL REFERENCES public.lead_testing_report_uploads(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL, raw_text_or_raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, sample_id TEXT, laboratory_sample_id TEXT, school_district TEXT, school_name TEXT,
  building_name TEXT, room TEXT, fixture_description TEXT, fixture_type TEXT, sample_date DATE, result_value TEXT, result_unit TEXT, normalized_result_ppb NUMERIC,
  proposed_fixture_id UUID REFERENCES public.fixtures(id) ON DELETE SET NULL, confirmed_fixture_id UUID REFERENCES public.fixtures(id) ON DELETE SET NULL,
  match_status public.report_match_status NOT NULL DEFAULT 'no_match', match_confidence NUMERIC, match_reasons TEXT[], user_confirmed BOOLEAN NOT NULL DEFAULT false,
  imported_testing_round_id UUID REFERENCES public.lead_testing_rounds(id) ON DELETE SET NULL, notes TEXT, deleted_at TIMESTAMPTZ,
  UNIQUE (report_upload_id, row_number), UNIQUE (imported_testing_round_id)
);

CREATE TABLE public.lead_testing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  testing_round_id UUID REFERENCES public.lead_testing_rounds(id) ON DELETE SET NULL, remediation_record_id UUID REFERENCES public.remediation_records(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), description TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lead_rounds_fixture_idx ON public.lead_testing_rounds(fixture_id, round_number);
CREATE INDEX remediation_fixture_idx ON public.remediation_records(fixture_id, created_at);
CREATE INDEX lead_events_fixture_idx ON public.lead_testing_events(fixture_id, event_timestamp DESC);
CREATE INDEX report_rows_upload_idx ON public.lead_testing_report_rows(report_upload_id, row_number);

CREATE OR REPLACE FUNCTION public.normalize_lead_result(value_text TEXT, unit_text TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n NUMERIC; u TEXT := lower(trim(unit_text)); v TEXT := lower(trim(value_text));
BEGIN
  IF v IS NULL OR v = '' OR v IN ('nd','non-detect','non detect','below detection limit','invalid','inconclusive') THEN RETURN NULL; END IF;
  IF v LIKE '<%' THEN RETURN NULL; END IF;
  BEGIN n := v::numeric; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
  IF n < 0 THEN RAISE EXCEPTION 'Lead concentration cannot be negative'; END IF;
  IF u IN ('ppb','µg/l','ug/l') THEN RETURN n; ELSIF u IN ('mg/l','ppm') THEN RETURN n * 1000; ELSE RAISE EXCEPTION 'Invalid lead result unit: %', unit_text; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_lead_round_summary() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_category TEXT; v_action TEXT; v_next_status public.lead_testing_status; v_is_bound BOOLEAN; v_latest_remediation public.remediation_records;
BEGIN
  IF NEW.result_received_at IS NOT NULL AND NEW.sample_drawn_at IS NOT NULL AND NEW.result_received_at < NEW.sample_drawn_at THEN RAISE EXCEPTION 'Result date cannot be before sample date'; END IF;
  NEW.result_ppb := public.normalize_lead_result(NEW.result_value, NEW.result_original_unit);
  v_is_bound := NEW.result_value ~ '^\s*<\s*[0-9]+(\.[0-9]+)?\s*$';
  IF NEW.result_ppb IS NOT NULL OR v_is_bound THEN
    IF (v_is_bound AND substring(NEW.result_value from '[0-9]+[.]?[0-9]*')::numeric <= 5) OR NEW.result_ppb <= 5 THEN
      v_category := '5 ppb or less';
      IF NEW.round_type = 'post_remediation_retest' THEN v_action := 'Remediation verified'; ELSE v_action := 'No remediation required'; END IF;
      v_next_status := 'complete';
    ELSIF NEW.result_ppb <= 15 THEN v_category := 'Greater than 5 through 15 ppb'; v_action := CASE WHEN NEW.round_type='post_remediation_retest' THEN 'Additional remediation required' ELSE 'Remediation required' END; v_next_status := 'action_required';
    ELSE v_category := 'Greater than 15 ppb'; v_action := CASE WHEN NEW.round_type='post_remediation_retest' THEN 'Additional remediation required' ELSE 'Immediately restrict access and remediate' END; v_next_status := 'action_required';
    END IF;
  ELSIF NEW.result_value IS NOT NULL THEN v_next_status := 'invalid_or_inconclusive'; v_action := 'Valid result required'; v_category := NULL;
  ELSE RETURN NEW;
  END IF;
  NEW.result_category := v_category; NEW.required_action := v_action; NEW.status := v_next_status; NEW.updated_at := now();
  UPDATE public.fixtures SET current_lead_testing_status=v_next_status,current_required_action=v_action,current_result_ppb=NEW.result_ppb,
    current_result_category=v_category,current_testing_round_id=NEW.id,lead_testing_last_updated_at=now() WHERE id=NEW.fixture_id;
  IF NEW.round_type='post_remediation_retest' THEN
    SELECT * INTO v_latest_remediation FROM public.remediation_records WHERE fixture_id=NEW.fixture_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
    IF v_latest_remediation.id IS NOT NULL THEN UPDATE public.remediation_records SET status=CASE WHEN v_action='Remediation verified' THEN 'verified'::public.remediation_status ELSE 'additional_action_required'::public.remediation_status END, follow_up_testing_round_id=NEW.id, updated_at=now() WHERE id=v_latest_remediation.id; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_lead_round_summary_trigger BEFORE INSERT OR UPDATE OF result_value,result_original_unit,result_received_at ON public.lead_testing_rounds FOR EACH ROW EXECUTE FUNCTION public.sync_lead_round_summary();

CREATE OR REPLACE FUNCTION public.sync_remediation_completion() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('completed','awaiting_retest') AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status := 'awaiting_retest'; NEW.retest_required := true;
    UPDATE public.lead_testing_rounds SET status='awaiting_retest', required_action='Post-remediation retest required' WHERE id=NEW.triggering_testing_round_id;
    UPDATE public.fixtures SET current_lead_testing_status='awaiting_retest',current_required_action='Post-remediation retest required',lead_testing_last_updated_at=now() WHERE id=NEW.fixture_id;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER sync_remediation_completion_trigger BEFORE UPDATE OF status ON public.remediation_records FOR EACH ROW EXECUTE FUNCTION public.sync_remediation_completion();

DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['maintenance_history_archive','lead_testing_report_uploads','lead_testing_rounds','remediation_records','lead_testing_report_rows','lead_testing_events'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)','Authenticated read '||t,t); EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)','Authenticated insert '||t,t); EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL)','Authenticated update '||t,t); END LOOP; END $$;

CREATE TRIGGER update_lead_testing_rounds_updated_at BEFORE UPDATE ON public.lead_testing_rounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_remediation_records_updated_at BEFORE UPDATE ON public.remediation_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id,name,public) VALUES ('lead-testing-reports','lead-testing-reports',false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated upload lead reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='lead-testing-reports' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated read lead reports" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='lead-testing-reports');
