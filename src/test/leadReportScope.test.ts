import { describe, expect, it } from 'vitest';
import { leadReportRowBelongsToWorkspace } from '@/lib/leadReportScope';

describe('lead report workspace scope', () => {
  const fixtureIds = new Set(['fixture-1']);
  const schools = new Set(['pine creek elementary school']);

  it('includes rows linked to a current fixture', () => {
    expect(leadReportRowBelongsToWorkspace(
      { proposed_fixture_id: 'fixture-1' },
      fixtureIds,
      'North Valley School District',
      schools,
    )).toBe(true);
  });

  it('includes unmatched rows by district or school and excludes unrelated rows', () => {
    expect(leadReportRowBelongsToWorkspace(
      { school_name: 'Pine Creek Elementary School' },
      fixtureIds,
      'North Valley School District',
      schools,
    )).toBe(true);
    expect(leadReportRowBelongsToWorkspace(
      { lead_testing_report_uploads: { district_or_organization: 'North Valley School District' } },
      fixtureIds,
      'North Valley School District',
      schools,
    )).toBe(true);
    expect(leadReportRowBelongsToWorkspace(
      { school_name: 'Unrelated School' },
      fixtureIds,
      'North Valley School District',
      schools,
    )).toBe(false);
  });
});
