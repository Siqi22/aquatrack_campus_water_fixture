import { describe, expect, it } from 'vitest';
import {
  resolveCategoryFromImportProvenance,
  splitImportFromObservations,
} from '@/lib/importMetadata';

describe('importMetadata', () => {
  it('parses Original category from observations with Observations heading', () => {
    const obs =
      'Observations\n\nImported. Original floor label: 3. Original category: Metal Fountain.';
    const split = splitImportFromObservations(obs);
    expect(split.importMetadata).toContain('Original category: Metal Fountain');
    expect(split.observations).toBeUndefined();

    const category = resolveCategoryFromImportProvenance(null, obs);
    expect(category).toBe('MetalFountain');
  });
});
