/** Canonical floor label for matching and display (e.g. "01" → "1"). */
export function normalizeFloorKey(floor: string): string {
  const trimmed = String(floor).trim();
  if (/^\d+$/.test(trimmed)) return String(parseInt(trimmed, 10));
  return trimmed;
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
