import { describe, expect, it } from 'vitest';
import {
  analyzeCSV,
  buildExistingFixtureIndex,
  enrichAnalysisWithDuplicates,
  locationKeyFromParsed,
  parseCSVText,
} from '@/lib/importCSV';

const SAMPLE = `Campus,Building,Floor,Nearest Room,Category,Brand,Model
UW-Seattle,Denny Hall,4,424,Bottle Refill Station,Elkay,EZH2O
UW-Seattle,Lewis Hall,4,NA,NA,,,
`;

describe('importCSV', () => {
  it('parses quoted CSV rows', () => {
    const { headers, rows } = parseCSVText('A,B\n"hello, world",2\n');
    expect(headers).toEqual(['A', 'B']);
    expect(rows[0]).toEqual(['hello, world', '2']);
  });

  it('detects fixture and locked-floor rows', () => {
    const analysis = analyzeCSV(SAMPLE, 'sample.csv');
    expect(analysis.fixtures).toHaveLength(1);
    expect(analysis.fixtures[0].buildingName).toBe('Denny Hall');
    expect(analysis.floorLocks.length).toBeGreaterThanOrEqual(0);
    expect(analysis.mappings.some((m) => m.key === 'campus')).toBe(true);
  });

  it('matches duplicates by location', () => {
    const analysis = analyzeCSV(SAMPLE, 'sample.csv');
    const row = analysis.fixtures[0];
    const key = locationKeyFromParsed(row);
    const index = buildExistingFixtureIndex(
      [
        {
          id: 'fixture-1',
          campusId: 'campus-1',
          buildingName: row.buildingName,
          floor: row.floor,
          roomNumber: row.nearestRoom,
          nearestRoom: row.nearestRoom,
        },
      ],
      [{ id: 'campus-1', school: 'University of Washington', name: 'Seattle' }],
    );
    expect(index.byLocation.has(key)).toBe(true);
    const enriched = enrichAnalysisWithDuplicates(analysis, index);
    expect(enriched.duplicateCount).toBe(1);
    expect(enriched.newFixtureCount).toBe(0);
  });
});
