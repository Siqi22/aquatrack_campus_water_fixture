/** Canonical floor label for matching and display (e.g. "Floor 01" → "1"). */
export function normalizeFloorKey(floor: string): string {
  const trimmed = String(floor).trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (/^(floor\s*)+$/.test(lower) || /^(fl\s*)+$/.test(lower)) return '1';

  const numeric = lower.match(/^(?:floor|fl)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*(?:floor|fl))?$/);
  if (numeric) return String(parseInt(numeric[1], 10));

  const named: Record<string, string> = {
    'ground floor': 'G',
    ground: 'G',
    'first floor': '1',
    first: '1',
    'second floor': '2',
    second: '2',
    'third floor': '3',
    third: '3',
  };
  return named[lower] ?? trimmed;
}

export function formatFloorLabel(floor: string): string {
  return `Floor ${normalizeFloorKey(floor) || '1'}`;
}

export function floorProgressKey(buildingId: string, floor: string): string {
  return `${buildingId}:${normalizeFloorKey(floor)}`;
}

export function compareFloorKeys(a: string, b: string): number {
  const left = normalizeFloorKey(a);
  const right = normalizeFloorKey(b);
  const leftNum = parseInt(left, 10);
  const rightNum = parseInt(right, 10);
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) return leftNum - rightNum;
  return left.localeCompare(right, undefined, { numeric: true });
}
