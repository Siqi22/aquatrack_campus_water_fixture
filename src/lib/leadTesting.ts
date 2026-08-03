export const ROUND_TYPES = ['initial_test','retest','post_remediation_retest'] as const;
export const AVAILABILITY_STATUSES = ['available_for_consumption','temporarily_restricted','handwash_only','shut_off','inaccessible','permanently_removed'] as const;
export const REMEDIATION_TYPES = ['shut_off_outlet','make_inaccessible','restrict_to_handwashing','remove_from_service','replace_fixture','replace_component','install_filter','replace_filter','replace_plumbing','fixture_conditioning','flushing','other'] as const;

export type RoundType = typeof ROUND_TYPES[number];
export type AvailabilityStatus = typeof AVAILABILITY_STATUSES[number];
export type LeadTestingStatus = 'not_started'|'scheduled'|'sample_drawn'|'awaiting_results'|'results_received'|'action_required'|'remediation_in_progress'|'awaiting_retest'|'retest_sample_drawn'|'awaiting_retest_results'|'complete'|'invalid_or_inconclusive';
export type ResultCategory = '5 ppb or less'|'Greater than 5 through 15 ppb'|'Greater than 15 ppb';

export interface LeadResult {
  original: string;
  ppb: number | null;
  category: ResultCategory | null;
  requiredAction: string;
  status: LeadTestingStatus;
  isUpperBound: boolean;
}

const NON_DETECT = new Set(['nd','non-detect','non detect','below detection limit']);

export function normalizeLeadResult(value: string, unit: string, postRemediation = false): LeadResult {
  const original = value.trim();
  const lower = original.toLowerCase();
  const bound = lower.match(/^<\s*(\d+(?:\.\d+)?)$/);
  if (!original || NON_DETECT.has(lower)) {
    return { original, ppb: null, category: null, requiredAction: 'Valid result required', status: 'invalid_or_inconclusive', isUpperBound: false };
  }
  let numeric: number;
  let isUpperBound = false;
  if (bound) { numeric = Number(bound[1]); isUpperBound = true; }
  else numeric = Number(original);
  if (!Number.isFinite(numeric)) return { original, ppb: null, category: null, requiredAction: 'Valid result required', status: 'invalid_or_inconclusive', isUpperBound: false };
  if (numeric < 0) throw new Error('Lead concentration cannot be negative.');
  const normalizedUnit = unit.trim().toLowerCase();
  const multiplier = normalizedUnit === 'ppb' || normalizedUnit === 'µg/l' || normalizedUnit === 'ug/l' ? 1 : normalizedUnit === 'mg/l' || normalizedUnit === 'ppm' ? 1000 : null;
  if (multiplier === null) throw new Error('Unit must be ppb, µg/L, mg/L, or ppm.');
  const ppb = numeric * multiplier;
  if (isUpperBound && ppb > 5) return { original, ppb: null, category: null, requiredAction: 'Valid result required', status: 'invalid_or_inconclusive', isUpperBound };
  if (ppb <= 5) return { original, ppb: isUpperBound ? null : ppb, category: '5 ppb or less', requiredAction: postRemediation ? 'Remediation verified' : 'No remediation required', status: 'complete', isUpperBound };
  if (ppb <= 15) return { original, ppb, category: 'Greater than 5 through 15 ppb', requiredAction: postRemediation ? 'Additional remediation required' : 'Remediation required', status: 'action_required', isUpperBound };
  return { original, ppb, category: 'Greater than 15 ppb', requiredAction: postRemediation ? 'Additional remediation required' : 'Immediately restrict access and remediate', status: 'action_required', isUpperBound };
}

export function formatPpb(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

export function formatLeadMeasurement(
  value: string | null | undefined,
  unit: string | null | undefined,
  ppb: number | null | undefined,
) {
  if (ppb != null && Number.isFinite(ppb)) return `${formatPpb(ppb)} ppb`;
  const original = value?.trim();
  const originalUnit = unit?.trim() || 'ppb';
  const displayUnit = originalUnit.toLowerCase() === 'ppb' ? 'ppb' : originalUnit;
  if (!original) return '—';
  const bound = original.match(/^<\s*(\d+(?:\.\d+)?)$/);
  if (bound) {
    const normalizedUnit = originalUnit.toLowerCase();
    const multiplier =
      normalizedUnit === 'ppb' || normalizedUnit === 'µg/l' || normalizedUnit === 'ug/l'
        ? 1
        : normalizedUnit === 'mg/l' || normalizedUnit === 'ppm'
          ? 1000
          : null;
    if (multiplier != null) return `<${formatPpb(Number(bound[1]) * multiplier)} ppb`;
  }
  return `${original} ${displayUnit}`;
}

export function leadResultColor(value: number | null | undefined) {
  if (value == null) return 'text-foreground';
  if (value > 15) return 'text-destructive';
  if (value > 5) return 'text-status-warning';
  return 'text-foreground';
}

export function label(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function requiredActionLabel(status?: string, requiredAction?: string) {
  if (status === 'not_started' || status === 'scheduled') return 'Sampling Required';
  if (['sample_drawn','awaiting_results','retest_sample_drawn','awaiting_retest_results'].includes(status ?? '')) return 'Awaiting Results';
  if (requiredAction?.includes('Immediately')) return 'Immediately Restrict Access';
  if (requiredAction?.includes('Remediation') && !requiredAction.includes('verified')) return 'Remediation Required';
  if (status === 'awaiting_retest' || requiredAction?.includes('retest')) return 'Retesting Required';
  if (status === 'complete' || requiredAction?.includes('verified') || requiredAction?.includes('No remediation')) return 'Complete';
  return 'Sampling Required';
}

export function overallWorkflowLabel(status?: string) {
  if (status === 'sample_drawn' || status === 'retest_sample_drawn') return 'Sample Collected';
  if (['awaiting_results','awaiting_retest_results','results_received'].includes(status ?? '')) return 'Awaiting Results';
  if (['action_required','remediation_in_progress'].includes(status ?? '')) return 'Remediation Required';
  if (status === 'awaiting_retest') return 'Retesting Required';
  if (status === 'complete') return 'Complete';
  return 'Sampling Required';
}

export function drinkingStatusLabel(status?: string) {
  if (status === 'available_for_consumption') return 'Ready for Consumption';
  if (['shut_off','inaccessible','permanently_removed'].includes(status ?? '')) return 'Out of Service';
  return 'Restricted – Do Not Drink';
}
