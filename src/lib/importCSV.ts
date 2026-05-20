import { normalizeFixtureCategory, type FixtureCategory } from '@/store/fixtureStore';

export type ImportFieldKey =
  | 'campus'
  | 'building'
  | 'floor'
  | 'accessStatus'
  | 'nearestRoom'
  | 'category'
  | 'originalCategory'
  | 'brand'
  | 'model'
  | 'serialNumber'
  | 'filterType'
  | 'lastMaintenance'
  | 'installationDate'
  | 'maintenanceStatus'
  | 'pressure'
  | 'cleanliness'
  | 'observations'
  | 'issues'
  | 'id'
  | 'photoURL'
  | 'modelPlatePhotoURL';

export interface ColumnMapping {
  key: ImportFieldKey;
  header: string;
  index: number;
}

export interface ParsedFixtureRow {
  campusLabel: string;
  buildingName: string;
  floor: string;
  nearestRoom: string;
  category: FixtureCategory;
  categoryLabel: string;
  brand: string;
  model: string;
  serialNumber: string;
  filterType: string;
  lastMaintenanceDate: string;
  installationDate?: string;
  pressure: number;
  cleanliness: number;
  observations?: string;
  issues?: string[];
  sourceRow: number;
  externalId?: string;
  photoURL?: string;
  modelPlatePhotoURL?: string;
}

export interface ParsedFloorLockRow {
  campusLabel: string;
  buildingName: string;
  floor: string;
  reason: string;
  sourceRow: number;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ImportAnalysis {
  fileName: string;
  headers: string[];
  mappings: ColumnMapping[];
  unmappedHeaders: string[];
  fixtures: ParsedFixtureRow[];
  floorLocks: ParsedFloorLockRow[];
  skipped: SkippedRow[];
  campusLabels: string[];
  buildingCount: number;
  duplicateCount: number;
  newFixtureCount: number;
  rowsWithPhotos: number;
}

export type ImportMode = 'insert_only' | 'skip_duplicates' | 'update_existing';

export interface ImportOptions {
  mode: ImportMode;
}

export interface ExistingFixtureIndex {
  byLocation: Map<string, string>;
  byExternalId: Map<string, string>;
}

export interface ImportResult {
  campusesCreated: number;
  buildingsCreated: number;
  fixturesImported: number;
  fixturesUpdated: number;
  fixturesSkippedDuplicates: number;
  floorsLocked: number;
  skipped: number;
}

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  id: ['id', 'fixture id', 'asset id'],
  campus: ['campus', 'campus name', 'site'],
  building: ['building', 'building name'],
  floor: ['floor', 'level'],
  accessStatus: ['status', 'access', 'access status', 'floor status'],
  nearestRoom: ['nearest room', 'room', 'room number', 'nearest room / landmark', 'location'],
  category: ['category', 'type', 'fixture type', 'fixture category', 'fountain type'],
  originalCategory: ['original category', 'original type', 'legacy category', 'csv category'],
  brand: ['brand', 'company', 'company name', 'manufacturer'],
  model: ['model', 'model number'],
  serialNumber: ['serial number', 'serial', 'serial no', 'serial #'],
  filterType: ['filter type', 'product number', 'product number (filter type)', 'filter'],
  lastMaintenance: ['last maintenance', 'last service', 'last maintenance date'],
  installationDate: ['installation date', 'install date', 'installed'],
  maintenanceStatus: ['maintenance status', 'service status'],
  pressure: ['pressure', 'water pressure'],
  cleanliness: ['cleanliness', 'clean'],
  observations: ['observations', 'notes', 'comments'],
  issues: ['issues', 'problems'],
  photoURL: ['photo url', 'photo', 'fixture photo', 'image url', 'photo link'],
  modelPlatePhotoURL: [
    'model label photo',
    'model plate photo',
    'label photo',
    'plate photo',
    'model photo',
  ],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectMappings(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedKeys = new Set<ImportFieldKey>();
  const statusIndices: number[] = [];

  headers.forEach((header, index) => {
    const norm = normalizeHeader(header);
    if (norm === 'status') {
      statusIndices.push(index);
      return;
    }
    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ImportFieldKey, string[]][]) {
      if (usedKeys.has(key)) continue;
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        mappings.push({ key, header, index });
        usedKeys.add(key);
        break;
      }
    }
  });

  if (statusIndices.length > 0 && !usedKeys.has('accessStatus')) {
    mappings.push({ key: 'accessStatus', header: headers[statusIndices[0]], index: statusIndices[0] });
    usedKeys.add('accessStatus');
  }
  if (statusIndices.length > 1 && !usedKeys.has('maintenanceStatus')) {
    mappings.push({ key: 'maintenanceStatus', header: headers[statusIndices[1]], index: statusIndices[1] });
    usedKeys.add('maintenanceStatus');
  }

  return mappings.sort((a, b) => a.index - b.index);
}

/** Parse CSV text including quoted fields and embedded newlines. */
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim())) records.push(row);
      row = [];
      if (ch === '\r') i++;
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((c) => c.trim())) records.push(row);

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1);
  return { headers, rows };
}

function cell(row: string[], mapping: ColumnMapping | undefined): string {
  if (!mapping) return '';
  return (row[mapping.index] ?? '').trim();
}

function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v === 'na' || v === 'n/a' || v === '—' || v === '-';
}

function cleanValue(value: string): string {
  const v = value.trim();
  if (v.toLowerCase() === 'label_not_visible') return '';
  return v;
}

/** Map spreadsheet / original-category text to fountain type (exported for import backfill). */
export function categoryFromSpreadsheetLabel(raw: string): FixtureCategory | null {
  const info = mapCategory(raw);
  return info?.category ?? null;
}

function mapCategory(raw: string): { category: FixtureCategory; label: string } | null {
  const label = raw.trim();
  if (isPlaceholder(label)) return null;
  const s = label.toLowerCase();

  if (s.includes('porcelain')) return { category: 'PorcelainFountain', label };
  if (s.includes('metal') && s.includes('fountain')) return { category: 'MetalFountain', label };
  if (s.includes('vending')) return { category: 'VendingMachine', label };
  if (
    s.includes('bottle') ||
    s.includes('refill') ||
    s.includes('combo') ||
    s.includes('attachment') ||
    s.includes('combination') ||
    s.includes('ezh2o')
  ) {
    return { category: 'BottleRefillStation', label };
  }
  if (s.includes('filtered') || s.includes('tap') || s.includes('sink')) return { category: 'Other', label };
  if (s.includes('fountain') || s.includes('water fountain')) return { category: 'Other', label };

  return { category: normalizeFixtureCategory(label), label };
}

function mapAccessStatus(raw: string): { locked: boolean; reason: string } {
  const reason = raw.trim();
  if (isPlaceholder(reason)) return { locked: false, reason: '' };
  const s = reason.toLowerCase();
  if (
    s.includes('locked') ||
    s.includes('authorized') ||
    s.includes('no access') ||
    s.includes('restricted')
  ) {
    return { locked: true, reason };
  }
  return { locked: false, reason: '' };
}

function clampRating(n: number): number {
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

function parseRating(raw: string, fallback = 2): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  if (n <= 3) return clampRating(n);
  if (n <= 2) return 1;
  if (n === 3) return 2;
  return 3;
}

function mappingByKey(mappings: ColumnMapping[], key: ImportFieldKey) {
  return mappings.find((m) => m.key === key);
}

export function analyzeCSV(text: string, fileName: string): ImportAnalysis {
  const { headers, rows } = parseCSVText(text);
  const mappings = detectMappings(headers);
  const mappedIndices = new Set(mappings.map((m) => m.index));
  const unmappedHeaders = headers.filter((_, i) => !mappedIndices.has(i));

  const fixtures: ParsedFixtureRow[] = [];
  const floorLocks: ParsedFloorLockRow[] = [];
  const skipped: SkippedRow[] = [];
  const campusSet = new Set<string>();
  const buildingSet = new Set<string>();

  rows.forEach((row, idx) => {
    const sourceRow = idx + 2;
    const campusLabel = cell(row, mappingByKey(mappings, 'campus'));
    const buildingName = cell(row, mappingByKey(mappings, 'building'));
    const floor = cell(row, mappingByKey(mappings, 'floor'));
    const accessStatus = cell(row, mappingByKey(mappings, 'accessStatus'));
    const nearestRoom = cell(row, mappingByKey(mappings, 'nearestRoom'));
    const categoryRaw =
      cell(row, mappingByKey(mappings, 'originalCategory')) ||
      cell(row, mappingByKey(mappings, 'category'));

    if (!campusLabel && !buildingName && !floor) {
      skipped.push({ row: sourceRow, reason: 'Empty row' });
      return;
    }
    if (!campusLabel || !buildingName || !floor) {
      skipped.push({ row: sourceRow, reason: 'Missing campus, building, or floor' });
      return;
    }

    campusSet.add(campusLabel);
    buildingSet.add(`${campusLabel}::${buildingName}`);

    const access = mapAccessStatus(accessStatus);
    const categoryInfo = mapCategory(categoryRaw);
    const roomMissing = isPlaceholder(nearestRoom);
    const categoryMissing = !categoryInfo;

    if (categoryMissing && roomMissing) {
      if (access.locked) {
        floorLocks.push({
          campusLabel,
          buildingName,
          floor,
          reason: access.reason || 'Locked / no access',
          sourceRow,
        });
      } else {
        skipped.push({ row: sourceRow, reason: 'Floor placeholder row (no fixture)' });
      }
      return;
    }

    if (roomMissing) {
      skipped.push({ row: sourceRow, reason: 'Missing room / landmark' });
      return;
    }

    if (!categoryInfo) {
      skipped.push({ row: sourceRow, reason: 'Missing fixture category' });
      return;
    }

    const issuesRaw = cell(row, mappingByKey(mappings, 'issues'));
    const externalId = cleanValue(cell(row, mappingByKey(mappings, 'id'))) || undefined;
    const photoURL = cleanValue(cell(row, mappingByKey(mappings, 'photoURL'))) || undefined;
    const modelPlatePhotoURL =
      cleanValue(cell(row, mappingByKey(mappings, 'modelPlatePhotoURL'))) || undefined;
    const today = new Date().toISOString().slice(0, 10);
    const lastMaint = cell(row, mappingByKey(mappings, 'lastMaintenance')) || today;

    fixtures.push({
      campusLabel,
      buildingName,
      floor,
      nearestRoom: nearestRoom.replace(/^room\s+/i, '').trim(),
      category: categoryInfo.category,
      categoryLabel: categoryRaw.trim() || categoryInfo.label,
      brand: cleanValue(cell(row, mappingByKey(mappings, 'brand'))),
      model: cleanValue(cell(row, mappingByKey(mappings, 'model'))),
      serialNumber: cleanValue(cell(row, mappingByKey(mappings, 'serialNumber'))),
      filterType: cleanValue(cell(row, mappingByKey(mappings, 'filterType'))),
      lastMaintenanceDate: lastMaint,
      installationDate: cleanValue(cell(row, mappingByKey(mappings, 'installationDate'))) || undefined,
      pressure: parseRating(cell(row, mappingByKey(mappings, 'pressure'))),
      cleanliness: parseRating(cell(row, mappingByKey(mappings, 'cleanliness'))),
      observations: cleanValue(cell(row, mappingByKey(mappings, 'observations'))) || undefined,
      issues: issuesRaw
        ? issuesRaw.split(/[;|]/).map((s) => s.trim()).filter(Boolean)
        : undefined,
      sourceRow,
      externalId,
      photoURL,
      modelPlatePhotoURL,
    });

    if (access.locked) {
      floorLocks.push({
        campusLabel,
        buildingName,
        floor,
        reason: access.reason,
        sourceRow,
      });
    }
  });

  return {
    fileName,
    headers,
    mappings,
    unmappedHeaders,
    fixtures,
    floorLocks,
    skipped,
    campusLabels: [...campusSet],
    buildingCount: buildingSet.size,
    duplicateCount: 0,
    newFixtureCount: fixtures.length,
    rowsWithPhotos: fixtures.filter((f) => f.photoURL || f.modelPlatePhotoURL).length,
  };
}

export function locationKeyFromParsed(row: ParsedFixtureRow): string {
  const { school, name } = parseCampusLabel(row.campusLabel);
  return locationKey(school, name, row.buildingName, row.floor, row.nearestRoom);
}

export function locationKey(
  school: string,
  campusName: string,
  buildingName: string,
  floor: string,
  room: string,
): string {
  return [school, campusName, buildingName, floor, room]
    .map((part) => part.trim().toLowerCase())
    .join('::');
}

/** Build lookup indexes for duplicate detection during import. */
export function buildExistingFixtureIndex(
  fixtures: Array<{
    id: string;
    campusId: string;
    buildingName: string;
    floor: string;
    roomNumber: string;
    nearestRoom?: string;
  }>,
  campuses: Array<{ id: string; school: string; name: string }>,
): ExistingFixtureIndex {
  const campusById = new Map(campuses.map((c) => [c.id, c]));
  const byLocation = new Map<string, string>();
  const byExternalId = new Map<string, string>();

  for (const f of fixtures) {
    const campus = campusById.get(f.campusId);
    if (!campus) continue;
    const room = (f.nearestRoom || f.roomNumber).trim();
    const key = locationKey(campus.school, campus.name, f.buildingName, f.floor, room);
    byLocation.set(key, f.id);
    byExternalId.set(f.id, f.id);
  }

  return { byLocation, byExternalId };
}

export function enrichAnalysisWithDuplicates(
  analysis: ImportAnalysis,
  index: ExistingFixtureIndex,
): ImportAnalysis {
  let duplicateCount = 0;
  for (const row of analysis.fixtures) {
    const locKey = locationKeyFromParsed(row);
    const byId = row.externalId ? index.byExternalId.get(row.externalId) : undefined;
    const byLoc = index.byLocation.get(locKey);
    if (byId || byLoc) duplicateCount++;
  }
  return {
    ...analysis,
    duplicateCount,
    newFixtureCount: analysis.fixtures.length - duplicateCount,
  };
}

export function resolveExistingFixtureId(
  row: ParsedFixtureRow,
  index: ExistingFixtureIndex,
): string | undefined {
  if (row.externalId && index.byExternalId.has(row.externalId)) {
    return index.byExternalId.get(row.externalId);
  }
  return index.byLocation.get(locationKeyFromParsed(row));
}

export function parseCampusLabel(label: string): { school: string; name: string } {
  const trimmed = label.trim();
  if (trimmed.includes('-')) {
    const [prefix, ...rest] = trimmed.split('-');
    const campusPart = rest.join('-').trim();
    const school =
      prefix.toUpperCase() === 'UW'
        ? 'University of Washington'
        : prefix.trim();
    return { school, name: campusPart || trimmed };
  }
  return { school: trimmed, name: 'Main Campus' };
}

export function floorSortKey(floor: string): number {
  const n = parseInt(floor, 10);
  return Number.isNaN(n) ? 999 : n;
}

export function estimateBuildingFloors(
  fixtures: ParsedFixtureRow[],
  locks: ParsedFloorLockRow[],
  campusLabel: string,
  buildingName: string,
): number {
  const floors = new Set<string>();
  for (const f of fixtures) {
    if (f.campusLabel === campusLabel && f.buildingName === buildingName) floors.add(f.floor);
  }
  for (const l of locks) {
    if (l.campusLabel === campusLabel && l.buildingName === buildingName) floors.add(l.floor);
  }
  return Math.max(floors.size, 1);
}

export function mappingLabel(key: ImportFieldKey): string {
  const labels: Record<ImportFieldKey, string> = {
    id: 'ID',
    campus: 'Campus',
    building: 'Building',
    floor: 'Floor',
    accessStatus: 'Access / floor status',
    nearestRoom: 'Room / landmark',
    category: 'Category',
    brand: 'Company name',
    model: 'Model',
    serialNumber: 'Serial number',
    filterType: 'Product number (filter)',
    lastMaintenance: 'Last maintenance',
    installationDate: 'Installation date',
    maintenanceStatus: 'Maintenance status',
    pressure: 'Pressure',
    cleanliness: 'Cleanliness',
    observations: 'Observations',
    issues: 'Issues',
    photoURL: 'Photo URL',
    modelPlatePhotoURL: 'Model label photo URL',
  };
  return labels[key];
}
