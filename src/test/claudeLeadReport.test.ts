import { describe, expect, it } from 'vitest';
import { normalizeClaudeLeadPayload } from '../../api/lib/parseLeadReportHandler';

describe('Claude lead report normalization', () => {
  it('keeps the labeled sample ID and less-than result from both supported DOH layouts', () => {
    const result = normalizeClaudeLeadPayload({
      school_district: null,
      school_name: 'Annex At North Central',
      rows: [
        {
          source_page: 3,
          school_name: null,
          building_name: '1956 Annex',
          floor: null,
          room: 'Next To Room 110 Hallway',
          fixture_description: 'Fountain · 1 of 1 · center',
          fixture_type: 'Water Fountain',
          sample_id: '403784',
          sample_date: '2025-03-21',
          lead_result: '29',
          unit: 'ppb',
        },
        {
          source_page: 1,
          school_name: 'Bellingham Family Partnership Program At Larrabee',
          building_name: 'Main Building',
          floor: '1',
          room: 'Rm1',
          fixture_description: 'Sink · Only sink',
          fixture_type: 'Tap',
          sample_id: '386236',
          sample_date: '2023-11-03',
          lead_result: '<1',
          unit: 'ppb',
        },
      ],
    }) as { rows: Array<Record<string, string | number | Record<string, string | number>>> };

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      school: 'Annex At North Central',
      sampleId: '403784',
      resultValue: '29',
      resultUnit: 'ppb',
    });
    expect(result.rows[1]).toMatchObject({
      school: 'Bellingham Family Partnership Program At Larrabee',
      sampleId: '386236',
      resultValue: '<1',
      resultUnit: 'ppb',
    });
  });
});
