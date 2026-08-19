import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/LeadReportUpload.tsx', 'utf8');

describe('Lead report matching review hierarchy', () => {
  it('limits exclusion to unresolved rows and simplifies the unmatched path', () => {
    expect(source).toContain('Search existing fixtures');
    expect(source).toContain('Create new fixture');
    expect(source).toContain("'Create new'");
    expect(source).toContain('>Exclude<');
    expect(source).toContain('!row.imported&&(row.excluded||unresolved)');
    expect(source.indexOf('>Exclude<')).toBeLessThan(source.indexOf('Create new fixture'));

    expect(source).not.toContain('Include this result');
    expect(source).not.toContain('Search existing fixtures first');
    expect(source).not.toContain('1. Search existing fixtures');
    expect(source).not.toContain('Create new entry');
    expect(source).not.toContain('Edit report details');
    expect(source).not.toContain('Check Match Again');
    expect(source).not.toContain('Include instead');
    expect(source).toContain('Undo exclusion');
    expect(source).toContain("'Confirm creation'");
  });

  it('offers bulk confirmation only for high-confidence fixture matches', () => {
    expect(source).toContain('Confirm All (');
    expect(source).toContain("row.match.status==='high_confidence_match'");
    expect(source).toContain('confirmAllMatches');
  });

  it('offers bulk exclusion without changing imported results', () => {
    expect(source).toContain('Exclude All (');
    expect(source).toContain('excludeAllRows');
    expect(source).toContain("rows.filter(row=>!row.excluded&&!row.imported)");
    expect(source).toContain("match_status:'excluded'");
  });
});
