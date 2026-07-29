import { describe, expect, it } from 'vitest';
import { parseWaterQualityCSV, reportSummary } from '@/lib/waterQualityReport';

describe('water quality report integration', () => {
  it('parses wide lab files and normalizes lead mg/L to ppb', () => {
    const samples = parseWaterQualityCSV([
      'School,Building,Location,Sample ID,Sample Date,Lead (mg/L),Copper (mg/L),Iron (mg/L)',
      'Demo School,North Wing,Room 101 sink,S-001,2026-05-01,0.007,0.4,0.35',
    ].join('\n'));

    expect(samples).toHaveLength(1);
    expect(samples[0].measurements.Lead?.value).toBe(7);
    expect(samples[0].measurements.Lead?.severity).toBe('warning');
    expect(samples[0].measurements.Iron?.severity).toBe('warning');
  });

  it('groups long-format analyte rows into one sample', () => {
    const samples = parseWaterQualityCSV([
      'Sample ID,Location,Analyte,Result,Unit',
      'S-002,Hall fountain,Lead,18,ppb',
      'S-002,Hall fountain,Copper,0.2,mg/L',
    ].join('\n'));

    expect(samples).toHaveLength(1);
    expect(samples[0].measurements.Lead?.severity).toBe('urgent');
    expect(samples[0].measurements.Copper?.severity).toBe('ok');
    expect(reportSummary(samples)).toMatchObject({ warnings: 0, urgent: 1 });
  });

  it('does not flag a below-detection result', () => {
    const samples = parseWaterQualityCSV('Sample ID,Location,Lead (ppb)\nS-003,Kitchen faucet,<20');
    expect(samples[0].measurements.Lead).toMatchObject({
      belowDetection: true,
      severity: 'ok',
      display: '<20',
    });
  });
});
