import type { Fixture } from '@/store/fixtureStore';

export type LeadFixtureFilter =
  | 'all'
  | 'sample'
  | 'awaiting'
  | 'retest'
  | 'remediation'
  | 'above5'
  | 'immediate';

export const LEAD_FIXTURE_FILTER_OPTIONS: Array<{ value: LeadFixtureFilter; label: string }> = [
  { value: 'all', label: 'All lead testing statuses' },
  { value: 'sample', label: 'Awaiting initial sampling' },
  { value: 'awaiting', label: 'Awaiting laboratory results' },
  { value: 'retest', label: 'Awaiting retesting' },
  { value: 'remediation', label: 'In active remediation' },
  { value: 'above5', label: 'Results 5–15 ppb' },
  { value: 'immediate', label: 'Results above 15 ppb' },
];

export function isLeadFixtureFilter(value: string | null): value is LeadFixtureFilter {
  return LEAD_FIXTURE_FILTER_OPTIONS.some((option) => option.value === value);
}

export function matchesLeadFixtureFilter(fixture: Fixture, filter: LeadFixtureFilter): boolean {
  const status = fixture.currentLeadTestingStatus ?? 'not_started';
  const ppb = fixture.currentResultPpb ?? null;
  if (filter === 'sample') return ['not_started', 'scheduled'].includes(status);
  if (filter === 'awaiting') return ['awaiting_results', 'awaiting_retest_results'].includes(status);
  if (filter === 'retest') return ['awaiting_retest', 'retest_sample_drawn', 'awaiting_retest_results'].includes(status);
  if (filter === 'remediation') return ['action_required', 'remediation_in_progress'].includes(status);
  if (filter === 'above5') return ppb !== null && ppb > 5 && ppb <= 15;
  if (filter === 'immediate') return ppb !== null && ppb > 15;
  return true;
}
