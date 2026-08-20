import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/LeadReportUpload.tsx', 'utf8');

describe('Lead report matching review hierarchy', () => {
  it('uses explicit include and exclude selection while simplifying the unmatched path', () => {
    expect(source).toContain('Search existing fixtures');
    expect(source).toContain('Create new fixture');
    expect(source).toContain("'Create new'");
    expect(source).toContain('>Exclude<');
    expect(source).toContain('!row.imported&&<Button');
    expect(source.indexOf('>Exclude<')).toBeLessThan(source.indexOf('Create new fixture'));

    expect(source).not.toContain('Include this result');
    expect(source).not.toContain('Search existing fixtures first');
    expect(source).not.toContain('1. Search existing fixtures');
    expect(source).not.toContain('Create new entry');
    expect(source).not.toContain('Edit report details');
    expect(source).not.toContain('Check Match Again');
    expect(source).not.toContain('Include instead');
    expect(source).not.toContain('Undo exclusion');
    expect(source).toContain('>Include<');
    expect(source).toContain('canConfirm');
    expect(source).toContain("return'Included'");
    expect(source).not.toContain('Confirm match');
    expect(source).not.toContain('disabled>Included');
    expect(source).toContain("'Confirm creation'");
  });

  it('starts with matches unselected and always shows the bulk action', () => {
    expect(source).not.toContain('Confirm All (');
    expect(source).not.toContain('confirmAllMatches');
    expect(source).toContain("row.selectedFixtureId&&!row.confirmed&&!row.imported");
    expect(source).toContain("useState<'include'|null>(null)");
    expect(source).toContain("<Checkbox checked={bulkChoice==='include'}");
    expect(source).toContain("checked===true?includeAllRows():clearAllRows()");
    expect(source).toContain('Include All ({bulkEligible.length})');
    expect(source).toContain('included and ready');
  });

  it('keeps exclusion as a row-level action', () => {
    expect(source).not.toContain('excludeAllRows');
    expect(source).not.toContain('Exclude All (');
    expect(source).toContain('>Exclude<');
    expect(source).toContain("match_status:next.excluded?'excluded':next.confirmed?'manually_matched':next.match.status");
  });

  it('offers bulk inclusion without changing imported results', () => {
    expect(source).toContain('Include All (');
    expect(source).toContain('includeAllRows');
    expect(source).toContain("user_confirmed:true,match_status:'manually_matched'");
    expect(source).toContain("setBulkChoice('include')");
    expect(source).not.toContain("setBulkChoice('exclude')");
  });
});
