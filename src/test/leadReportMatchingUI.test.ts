import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/LeadReportUpload.tsx', 'utf8');

describe('Lead report matching review hierarchy', () => {
  it('uses explicit opt-in selection while simplifying the unmatched path', () => {
    expect(source).toContain('Search existing fixtures');
    expect(source).toContain('Create new fixture');
    expect(source).toContain("'Create new'");
    expect(source).not.toContain('<span>Exclude</span>');
    expect(source).not.toContain("<Checkbox checked={row.excluded}");

    expect(source).not.toContain('Include this result');
    expect(source).not.toContain('Search existing fixtures first');
    expect(source).not.toContain('1. Search existing fixtures');
    expect(source).not.toContain('Create new entry');
    expect(source).not.toContain('Edit report details');
    expect(source).not.toContain('Check Match Again');
    expect(source).not.toContain('Include instead');
    expect(source).not.toContain('Undo exclusion');
    expect(source).toContain('<span>Include</span>');
    expect(source).toContain("<Checkbox checked={isIncluded}");
    expect(source).toContain('canInclude');
    expect(source).toContain("return'Included'");
    expect(source).not.toContain("return'Excluded'");
    expect(source).not.toContain('Confirm match');
    expect(source).not.toContain('disabled>Included');
    expect(source).toContain("'Confirm creation'");
  });

  it('starts with matches unselected and always shows the bulk action', () => {
    expect(source).not.toContain('Confirm All (');
    expect(source).not.toContain('confirmAllMatches');
    expect(source).toContain("row.selectedFixtureId&&!row.confirmed&&!row.imported");
    expect(source).toContain("useState<'include'|null>(null)");
    expect(source).toContain('REVIEW_SELECTION_INITIALIZED_PREFIX');
    expect(source).toContain('reviewRows.map(row=>row.imported?row:{...row,confirmed:false,excluded:false})');
    expect(source).toContain('openExistingReport(exactDuplicate.data,true)');
    expect(source).toContain("<Checkbox checked={bulkChoice==='include'}");
    expect(source).toContain("checked===true?includeAllRows():clearAllRows()");
    expect(source).toContain('Include All ({bulkEligible.length})');
    expect(source).toContain('selected for import');
    expect(source).toContain('const canSubmit=rows.length>0');
    expect(source).not.toContain('needsReview');
  });

  it('treats unchecked rows as skipped only when the review is submitted', () => {
    expect(source).not.toContain('excludeAllRows');
    expect(source).not.toContain('Exclude All (');
    expect(source).toContain("else onChange({excluded:false,confirmed:false})");
    expect(source).toContain("match_status:next.confirmed?'manually_matched':next.match.status");
    expect(source).toContain("const skippedIds=rows.filter(item=>!item.imported&&!item.confirmed)");
    expect(source).toContain("match_status:'excluded'}).in('id',skippedIds)");
    expect(source).toContain('No results are selected. Submit to skip all rows');
  });

  it('offers bulk inclusion without changing imported results', () => {
    expect(source).toContain('Include All (');
    expect(source).toContain('includeAllRows');
    expect(source).toContain("user_confirmed:true,match_status:'manually_matched'");
    expect(source).toContain("setBulkChoice('include')");
    expect(source).not.toContain("setBulkChoice('exclude')");
  });
});
