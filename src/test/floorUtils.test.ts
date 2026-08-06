import { describe, expect, it } from 'vitest';
import { formatFloorLabel, normalizeFloorKey } from '@/lib/floorUtils';

describe('normalizeFloorKey', () => {
  it.each([
    ['01', '1'],
    ['Floor 1', '1'],
    ['1st Floor', '1'],
    ['fl. 2', '2'],
    ['Second Floor', '2'],
    ['Ground Floor', 'G'],
    ['Floor', '1'],
    ['Floor Floor', '1'],
    ['Floor Floor1', '1'],
    ['Floor Floor 2', '2'],
    ['Floor3 Floor', '3'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeFloorKey(input)).toBe(expected);
  });

  it('preserves an alphanumeric floor identifier', () => {
    expect(normalizeFloorKey('L2')).toBe('L2');
  });

  it.each([
    ['Floor', 'Floor 1'],
    ['Floor Floor', 'Floor 1'],
    ['Floor Floor1', 'Floor 1'],
    ['Floor 2', 'Floor 2'],
  ])('formats %s without repeating Floor', (input, expected) => {
    expect(formatFloorLabel(input)).toBe(expected);
  });
});
