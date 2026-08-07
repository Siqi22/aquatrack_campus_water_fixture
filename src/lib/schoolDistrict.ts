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

export function resolveWorkspaceSchoolDistrict(
  campuses: Array<{ schoolDistrict?: string | null }>,
  fallback = DEFAULT_SCHOOL_DISTRICT,
) {
  const fallbackName = normalizeSchoolDistrict(fallback);
  const counts = new Map<string, { name: string; count: number }>();

  campuses.forEach((campus) => {
    const name = normalizeSchoolDistrict(campus.schoolDistrict);
    const key = name.toLowerCase();
    const current = counts.get(key);
    counts.set(key, { name, count: (current?.count ?? 0) + 1 });
  });

  return [...counts.values()].sort((left, right) =>
    right.count - left.count ||
    Number(right.name === fallbackName) - Number(left.name === fallbackName) ||
    left.name.localeCompare(right.name),
  )[0]?.name ?? fallbackName;
}
