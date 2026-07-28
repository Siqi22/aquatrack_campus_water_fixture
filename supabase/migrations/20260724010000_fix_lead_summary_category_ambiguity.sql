-- Avoid a PL/pgSQL name collision between the local result-category variable
-- and fixtures.category when importing laboratory results.
CREATE OR REPLACE FUNCTION public.sync_lead_round_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_action TEXT;
  v_next_status public.lead_testing_status;
  v_is_bound BOOLEAN;
  v_latest_remediation public.remediation_records;
BEGIN
  IF NEW.result_received_at IS NOT NULL
     AND NEW.sample_drawn_at IS NOT NULL
     AND NEW.result_received_at < NEW.sample_drawn_at THEN
    RAISE EXCEPTION 'Result date cannot be before sample date';
  END IF;

  NEW.result_ppb := public.normalize_lead_result(
    NEW.result_value,
    NEW.result_original_unit
  );
  v_is_bound := NEW.result_value ~ '^\s*<\s*[0-9]+(\.[0-9]+)?\s*$';

  IF NEW.result_ppb IS NOT NULL OR v_is_bound THEN
    IF (
      v_is_bound
      AND substring(NEW.result_value from '[0-9]+[.]?[0-9]*')::numeric <= 5
    ) OR NEW.result_ppb <= 5 THEN
      v_category := '5 ppb or less';
      v_action := CASE
        WHEN NEW.round_type = 'post_remediation_retest'
          THEN 'Remediation verified'
        ELSE 'No remediation required'
      END;
      v_next_status := 'complete';
    ELSIF NEW.result_ppb <= 15 THEN
      v_category := 'Greater than 5 through 15 ppb';
      v_action := CASE
        WHEN NEW.round_type = 'post_remediation_retest'
          THEN 'Additional remediation required'
        ELSE 'Remediation required'
      END;
      v_next_status := 'action_required';
    ELSE
      v_category := 'Greater than 15 ppb';
      v_action := CASE
        WHEN NEW.round_type = 'post_remediation_retest'
          THEN 'Additional remediation required'
        ELSE 'Immediately restrict access and remediate'
      END;
      v_next_status := 'action_required';
    END IF;
  ELSIF NEW.result_value IS NOT NULL THEN
    v_next_status := 'invalid_or_inconclusive';
    v_action := 'Valid result required';
    v_category := NULL;
  ELSE
    RETURN NEW;
  END IF;

  NEW.result_category := v_category;
  NEW.required_action := v_action;
  NEW.status := v_next_status;
  NEW.updated_at := now();

  UPDATE public.fixtures
  SET current_lead_testing_status = v_next_status,
      current_required_action = v_action,
      current_result_ppb = NEW.result_ppb,
      current_result_category = v_category,
      current_testing_round_id = NEW.id,
      lead_testing_last_updated_at = now()
  WHERE id = NEW.fixture_id;

  IF NEW.round_type = 'post_remediation_retest' THEN
    SELECT *
    INTO v_latest_remediation
    FROM public.remediation_records
    WHERE fixture_id = NEW.fixture_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_latest_remediation.id IS NOT NULL THEN
      UPDATE public.remediation_records
      SET status = CASE
            WHEN v_action = 'Remediation verified'
              THEN 'verified'::public.remediation_status
            ELSE 'additional_action_required'::public.remediation_status
          END,
          follow_up_testing_round_id = NEW.id,
          updated_at = now()
      WHERE id = v_latest_remediation.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
