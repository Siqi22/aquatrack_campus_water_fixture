import { parseCSVText } from '@/lib/importCSV';
import type { LeadReportRowDraft } from '@/lib/leadReportImport';

export const WATER_ANALYTES = ['Lead', 'Copper', 'Iron', 'Manganese', 'Zinc'] as const;
export type WaterAnalyte = typeof WATER_ANALYTES[number];

export interface WaterMeasurement {
  analyte: WaterAnalyte;
  display: string;
  value: number | null;
  unit: 'ppb' | 'mg/L';
  belowDetection: boolean;
  severity: 'ok' | 'warning' | 'urgent';
}

export interface WaterQualitySample {
  sampleId: string;
  school: string;
  building: string;
  location: string;
  sampleDate: string;
  measurements: Partial<Record<WaterAnalyte, WaterMeasurement>>;
}

const analyteAliases: Record<WaterAnalyte, string[]> = {
  Lead: ['lead', 'pb'],
  Copper: ['copper', 'cu'],
  Iron: ['iron', 'fe'],
  Manganese: ['manganese', 'mn'],
  Zinc: ['zinc', 'zn'],
};

const clean = (value: string) => value.trim().toLowerCase().replace(/[µμ]/g, 'u').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
const findColumn = (headers: string[], aliases: string[]) => headers.findIndex(header => aliases.some(alias => clean(header) === alias || clean(header).includes(alias)));
const cell = (row: string[], index: number) => index < 0 ? '' : (row[index] ?? '').trim();

function analyteFrom(value: string): WaterAnalyte | undefined {
  const normalized = clean(value).replace(/[^a-z]/g, '');
  return WATER_ANALYTES.find(analyte => analyteAliases[analyte].some(alias => normalized === alias));
}

function unitFrom(header: string, explicit: string, analyte: WaterAnalyte): string {
  const source = clean(`${explicit} ${header}`);
  if (source.includes('mg/l') || source.includes('ppm')) return 'mg/L';
  if (source.includes('ug/l') || source.includes('mcg/l') || source.includes('ppb')) return 'ppb';
  return analyte === 'Lead' ? 'ppb' : 'mg/L';
}

function measurement(analyte: WaterAnalyte, rawValue: string, rawUnit: string, header = ''): WaterMeasurement | undefined {
  const raw = rawValue.trim();
  if (!raw || /^(?:n\/?a|nr|--|not reported)$/i.test(raw)) return;
  const belowDetection = /^(?:<|≤)|^(?:nd|n\.d\.|not detected|non[- ]?detect)$/i.test(raw);
  const numericMatch = raw.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  let value = numericMatch ? Number(numericMatch[0]) : null;
  let unit = unitFrom(header, rawUnit, analyte);
  const canonicalUnit = analyte === 'Lead' ? 'ppb' : 'mg/L';
  if (value != null) {
    if (analyte === 'Lead' && unit === 'mg/L') value *= 1000;
    if (analyte !== 'Lead' && unit === 'ppb') value /= 1000;
  }
  unit = canonicalUnit;
  const severity = evaluate(analyte, value, belowDetection);
  const display = belowDetection
    ? numericMatch ? `<${formatNumber(value)}` : 'Not detected'
    : value == null ? raw : formatNumber(value);
  return { analyte, display, value, unit: canonicalUnit, belowDetection, severity };
}

function evaluate(analyte: WaterAnalyte, value: number | null, belowDetection: boolean): WaterMeasurement['severity'] {
  if (value == null || belowDetection) return 'ok';
  if (analyte === 'Lead') return value > 15 ? 'urgent' : value > 5 ? 'warning' : 'ok';
  const warning = { Copper: 1, Iron: .3, Manganese: .05, Zinc: 5 }[analyte as Exclude<WaterAnalyte, 'Lead'>];
  if (analyte === 'Copper' && value > 1.3) return 'urgent';
  return value > warning ? 'warning' : 'ok';
}

function formatNumber(value: number | null) {
  if (value == null) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function parseWaterQualityCSV(csv: string): WaterQualitySample[] {
  const { headers, rows } = parseCSVText(csv);
  if (!headers.length) throw new Error('The results file has no header row.');
  const sampleIndex = findColumn(headers, ['client sample id', 'customer sample', 'sample id', 'sample number', 'location id', 'fixture id']);
  const schoolIndex = findColumn(headers, ['school name', 'school', 'facility', 'site']);
  const buildingIndex = findColumn(headers, ['building name', 'building']);
  const locationIndex = findColumn(headers, ['fixture location', 'location', 'room', 'fixture description', 'client sample id']);
  const dateIndex = findColumn(headers, ['sample date', 'collection date', 'date sampled', 'collected date']);
  const analyteIndex = findColumn(headers, ['analyte', 'parameter', 'test']);
  const resultIndex = findColumn(headers, ['test result', 'result', 'concentration', 'value']);
  const unitIndex = findColumn(headers, ['result unit', 'units', 'unit']);
  const grouped = new Map<string, WaterQualitySample>();

  const sampleFor = (row: string[], rowNumber: number) => {
    const sampleId = cell(row, sampleIndex) || `Sample ${rowNumber + 2}`;
    const key = [sampleId, cell(row, locationIndex), cell(row, dateIndex)].join('|');
    const existing = grouped.get(key);
    if (existing) return existing;
    const created: WaterQualitySample = {
      sampleId,
      school: cell(row, schoolIndex),
      building: cell(row, buildingIndex),
      location: cell(row, locationIndex) || sampleId,
      sampleDate: normalizeDate(cell(row, dateIndex)),
      measurements: {},
    };
    grouped.set(key, created);
    return created;
  };

  if (analyteIndex >= 0 && resultIndex >= 0) {
    rows.forEach((row, rowNumber) => {
      const analyte = analyteFrom(cell(row, analyteIndex));
      if (!analyte) return;
      const parsed = measurement(analyte, cell(row, resultIndex), cell(row, unitIndex), headers[resultIndex]);
      if (parsed) sampleFor(row, rowNumber).measurements[analyte] = parsed;
    });
  } else {
    const analyteColumns = headers.flatMap((header, index) => {
      const analyte = WATER_ANALYTES.find(item => analyteAliases[item].some(alias => clean(header).includes(alias)));
      return analyte ? [{ analyte, index, header }] : [];
    });
    if (!analyteColumns.length) throw new Error('Could not find Lead, Copper, Iron, Manganese, or Zinc result columns.');
    rows.forEach((row, rowNumber) => {
      const sample = sampleFor(row, rowNumber);
      analyteColumns.forEach(({ analyte, index, header }) => {
        const parsed = measurement(analyte, cell(row, index), '', header);
        if (parsed) sample.measurements[analyte] = parsed;
      });
    });
  }
  return [...grouped.values()].filter(sample => Object.keys(sample.measurements).length);
}

export function leadRowsToWaterSamples(rows: LeadReportRowDraft[]): WaterQualitySample[] {
  return rows.map(row => {
    const lead = measurement('Lead', row.resultValue, row.resultUnit, 'Lead Result');
    return {
      sampleId: row.sampleId || `Row ${row.rowNumber}`,
      school: row.school,
      building: row.building,
      location: [row.room, row.fixtureDescription || row.fixtureType].filter(Boolean).join(' · '),
      sampleDate: row.sampleDate,
      measurements: lead ? { Lead: lead } : {},
    };
  }).filter(sample => sample.measurements.Lead);
}

function normalizeDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export function reportSummary(samples: WaterQualitySample[]) {
  const measurements = samples.flatMap(sample => Object.values(sample.measurements).filter(Boolean) as WaterMeasurement[]);
  return {
    analytes: WATER_ANALYTES.filter(analyte => samples.some(sample => sample.measurements[analyte])),
    warnings: measurements.filter(item => item.severity === 'warning').length,
    urgent: measurements.filter(item => item.severity === 'urgent').length,
  };
}

export function downloadEditableWaterReport(input: {
  district: string;
  school: string;
  samplingDates: string;
  introduction: string;
  actions: string;
  notes: string;
  contacts: Array<{ name: string; title: string; phone: string; email: string }>;
  samples: WaterQualitySample[];
  sourceFiles: string[];
}) {
  const summary = reportSummary(input.samples);
  const rows = input.samples.map((sample, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(sample.sampleId)}</td><td>${escapeHtml(sample.location || sample.building)}</td>
    ${summary.analytes.map(analyte => {
      const result = sample.measurements[analyte];
      const background = result?.severity === 'urgent' ? '#f8c7c7' : result?.severity === 'warning' ? '#fde7d3' : '#ffffff';
      return `<td style="background:${background}">${result ? `${escapeHtml(result.display)} ${result.unit}` : '—'}</td>`;
    }).join('')}
  </tr>`).join('');
  const contacts = input.contacts.filter(contact => contact.name.trim()).map(contact =>
    `<p><strong>${escapeHtml(contact.name)}</strong>${contact.title ? `, ${escapeHtml(contact.title)}` : ''}<br>${[contact.phone, contact.email].filter(Boolean).map(escapeHtml).join(' · ')}</p>`
  ).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#172333;line-height:1.45;margin:48px}h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin-top:26px}
    .muted{color:#667585}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #9ca8b3;padding:6px;text-align:left}th{background:#eaf1f7}
  </style></head><body>
    <p class="muted">${escapeHtml(input.district)}</p><h1>Water Quality Results — ${escapeHtml(input.school)}</h1>
    <p><strong>Sampling dates:</strong> ${escapeHtml(input.samplingDates || 'To be confirmed')}</p>
    <h2>Introduction</h2>${paragraphs(input.introduction)}
    <h2>Results</h2><table><thead><tr><th>#</th><th>Sample ID</th><th>Fixture / Location</th>${summary.analytes.map(analyte => `<th>${analyte}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <h2>Actions Taken</h2>${paragraphs(input.actions)}
    ${input.notes.trim() ? `<h2>Notes</h2>${paragraphs(input.notes)}` : ''}
    ${contacts ? `<h2>Contacts</h2>${contacts}` : ''}
    <p class="muted"><strong>Source files:</strong> ${input.sourceFiles.map(escapeHtml).join('; ')}</p>
  </body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug(input.school)}-water-quality-report.doc`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function paragraphs(value: string) {
  return value.split(/\n{2,}/).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'school';
}
