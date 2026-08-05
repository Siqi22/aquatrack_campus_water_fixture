export interface LeadSamplingDraft {
  schoolId: string;
  fixtureQuery: string;
  selectedFixtureIds: string[];
  sampleDrawDate: string;
  collector: string;
  method: string;
  methodDescription: string;
  notes: string;
}

export const LEAD_SAMPLING_DRAFT_KEY = 'aquatrack:lead-testing:sampling-draft:v1';

export function emptyLeadSamplingDraft(): LeadSamplingDraft {
  return {
    schoolId: '',
    fixtureQuery: '',
    selectedFixtureIds: [],
    sampleDrawDate: '',
    collector: '',
    method: 'first_draw_250ml',
    methodDescription: '',
    notes: '',
  };
}

function browserSessionStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export function loadLeadSamplingDraft(
  storage: Storage | null = browserSessionStorage(),
): LeadSamplingDraft {
  if (!storage) return emptyLeadSamplingDraft();
  try {
    const parsed = JSON.parse(storage.getItem(LEAD_SAMPLING_DRAFT_KEY) || '{}');
    const fallback = emptyLeadSamplingDraft();
    return {
      schoolId: typeof parsed.schoolId === 'string' ? parsed.schoolId : fallback.schoolId,
      fixtureQuery: typeof parsed.fixtureQuery === 'string' ? parsed.fixtureQuery : fallback.fixtureQuery,
      selectedFixtureIds: Array.isArray(parsed.selectedFixtureIds)
        ? parsed.selectedFixtureIds.filter((id: unknown): id is string => typeof id === 'string')
        : fallback.selectedFixtureIds,
      sampleDrawDate: typeof parsed.sampleDrawDate === 'string' ? parsed.sampleDrawDate : fallback.sampleDrawDate,
      collector: typeof parsed.collector === 'string' ? parsed.collector : fallback.collector,
      method: typeof parsed.method === 'string' && parsed.method ? parsed.method : fallback.method,
      methodDescription: typeof parsed.methodDescription === 'string'
        ? parsed.methodDescription
        : fallback.methodDescription,
      notes: typeof parsed.notes === 'string' ? parsed.notes : fallback.notes,
    };
  } catch {
    return emptyLeadSamplingDraft();
  }
}

export function saveLeadSamplingDraft(
  draft: LeadSamplingDraft,
  storage: Storage | null = browserSessionStorage(),
): void {
  storage?.setItem(LEAD_SAMPLING_DRAFT_KEY, JSON.stringify(draft));
}

export function defaultSamplingFixtureIds(
  fixtures: Array<{ id: string; campusId: string; currentLeadTestingStatus?: string }>,
  schoolId: string,
): string[] {
  return fixtures
    .filter(
      (fixture) =>
        fixture.campusId === schoolId
        && ['not_started', 'scheduled'].includes(
          fixture.currentLeadTestingStatus ?? 'not_started',
        ),
    )
    .map((fixture) => fixture.id);
}
