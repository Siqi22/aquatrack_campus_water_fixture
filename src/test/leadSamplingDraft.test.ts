import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultSamplingFixtureIds,
  emptyLeadSamplingDraft,
  loadLeadSamplingDraft,
  saveLeadSamplingDraft,
} from '@/lib/leadSamplingDraft';

describe('Lead Sampling draft', () => {
  beforeEach(() => sessionStorage.clear());

  it('restores sampling progress after switching Lead Testing tabs', () => {
    const draft = {
      ...emptyLeadSamplingDraft(),
      schoolId: 'school-1',
      fixtureQuery: 'hallway',
      selectedFixtureIds: ['fixture-1', 'fixture-2'],
      sampleDrawDate: '2026-08-05',
      collector: 'District Staff',
      notes: 'Return in the morning',
    };

    saveLeadSamplingDraft(draft);

    expect(loadLeadSamplingDraft()).toEqual(draft);
  });

  it('selects every fixture requiring sampling by default', () => {
    const fixtures = [
      { id: 'fixture-1', campusId: 'school-1', currentLeadTestingStatus: 'not_started' },
      { id: 'fixture-2', campusId: 'school-1', currentLeadTestingStatus: 'scheduled' },
      { id: 'fixture-3', campusId: 'school-1', currentLeadTestingStatus: 'awaiting_results' },
      { id: 'fixture-4', campusId: 'school-2', currentLeadTestingStatus: 'not_started' },
    ];

    expect(defaultSamplingFixtureIds(fixtures, 'school-1')).toEqual([
      'fixture-1',
      'fixture-2',
    ]);
  });

  it('falls back safely when stored progress is invalid', () => {
    sessionStorage.setItem('aquatrack:lead-testing:sampling-draft:v1', '{invalid');
    expect(loadLeadSamplingDraft()).toEqual(emptyLeadSamplingDraft());
  });
});
