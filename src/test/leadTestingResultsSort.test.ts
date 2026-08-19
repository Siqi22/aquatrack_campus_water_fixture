import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/pages/LeadTestingResults.tsx', 'utf8');

describe('Lead testing result sorting controls', () => {
  it('defaults to lead-level order and offers school, building, and floor order', () => {
    expect(source).toContain("useState<ResultSort>('lead')");
    expect(source).toContain('compareText(left.school, right.school)');
    expect(source).toContain('compareText(left.building, right.building)');
    expect(source).toContain('compareFloorKeys(left.floor, right.floor)');
    expect(source).toContain('Lead Level (ppb)');
    expect(source).toContain('(right.round.result_ppb ?? -1) - (left.round.result_ppb ?? -1)');
    expect(source).toContain('startsSchoolGroup');
    expect(source).toContain("startsSchoolGroup = sortBy === 'location'");
    expect(source).toContain('border-t-2 border-t-primary/35');
    expect(source).toContain('font-bold text-foreground');
  });
});
