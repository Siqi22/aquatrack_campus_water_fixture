export const DEFAULT_SCHOOL_DISTRICT = 'North Valley School District';

const UNKNOWN_DISTRICT_VALUES = new Set([
  '',
  'unknown',
  'unknown district',
  'unknown school district',
  'not recorded',
  'district not recorded',
  'school district',
]);

export function normalizeSchoolDistrict(value?: string | null) {
  const district = value?.trim() ?? '';
  return UNKNOWN_DISTRICT_VALUES.has(district.toLowerCase())
    ? DEFAULT_SCHOOL_DISTRICT
    : district;
}
