import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_DISTRICT, normalizeSchoolDistrict } from '@/lib/schoolDistrict';

describe('normalizeSchoolDistrict', () => {
  it.each([undefined, null, '', 'Unknown', 'Unknown School District', 'District not recorded', 'School District'])(
    'uses North Valley for %s',
    (value) => expect(normalizeSchoolDistrict(value)).toBe(DEFAULT_SCHOOL_DISTRICT),
  );

  it('preserves a concrete district name', () => {
    expect(normalizeSchoolDistrict(' Stanwood-Camano School District ')).toBe('Stanwood-Camano School District');
  });
});
