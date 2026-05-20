import { normalizeFixtureCategory, type FixtureCategory } from '@/store/fixtureStore';

function normalizeFloorLabel(raw: string): string {
  return raw.trim();
}

/** Build import provenance (stored in fixtures.import_metadata, not observations). */
export function buildImportMetadata(opts: {
  originalFloorLabel?: string | null;
  originalCategory?: string | null;
  extra?: string | null;
}): string {
  const parts: string[] = ['Imported.'];
  const floor = opts.originalFloorLabel?.trim();
  const category = opts.originalCategory?.trim();
  if (floor) parts.push(`Original floor label: ${floor}.`);
  if (category) parts.push(`Original category: ${category}.`);
  const extra = opts.extra?.trim();
  if (extra) parts.push(extra.endsWith('.') ? extra : `${extra}.`);
  return parts.join(' ');
}

/** Parse "Original category: …" from any text (import_metadata or observations). */
export function parseOriginalCategoryFromImportMetadata(
  text: string | null | undefined,
): string | undefined {
  if (!text?.trim()) return undefined;
  const m = text.match(/Original category:\s*([^.;|\n]+)/i);
  return m ? m[1].trim() : undefined;
}

/** Extract the import provenance block (may follow an "Observations" heading). */
export function extractImportBlock(text: string | null | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  const idx = text.search(/Imported\./i);
  if (idx < 0) return undefined;
  return text.slice(idx).trim();
}

export function parseOriginalFloorFromImportMetadata(
  importMetadata: string | null | undefined,
): string | undefined {
  const m = importMetadata?.match(/Original floor label:\s*([^.;|]+)/i);
  return m ? normalizeFloorLabel(m[1]) : undefined;
}

const IMPORT_PREFIX = /^Imported\./i;

export function splitImportFromObservations(observations: string | null | undefined): {
  importMetadata?: string;
  observations?: string;
} {
  if (!observations?.trim()) return {};
  const raw = observations.trim();

  // "Observations\n\nImported. Original floor label: 3. Original category: Metal Fountain."
  const importBlock = extractImportBlock(raw);
  if (importBlock) {
    const before = raw.slice(0, raw.search(/Imported\./i)).trim();
    const survey = before.replace(/^observations\s*$/i, '').trim();
    return {
      importMetadata: importBlock,
      observations: survey || undefined,
    };
  }

  const segments = raw.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  const importParts = segments.filter((s) => IMPORT_PREFIX.test(s));
  const surveyParts = segments.filter((s) => !IMPORT_PREFIX.test(s));
  if (importParts.length === 0) return { observations: raw };
  return {
    importMetadata: importParts.join(' | '),
    observations: surveyParts.length ? surveyParts.join(' | ') : undefined,
  };
}

/** Map a human-readable original category label to the current fountain type enum. */
export function categoryFromOriginalLabel(label: string | null | undefined): FixtureCategory | undefined {
  if (!label?.trim()) return undefined;
  return normalizeFixtureCategory(label);
}

/** Resolve fountain type from import_metadata and/or legacy observations import lines. */
export function resolveCategoryFromImportProvenance(
  importMetadata: string | null | undefined,
  observations: string | null | undefined,
): FixtureCategory | undefined {
  const split = splitImportFromObservations(observations);
  const meta =
    importMetadata?.trim() ||
    split.importMetadata ||
    extractImportBlock(observations);
  const original =
    parseOriginalCategoryFromImportMetadata(meta) ||
    parseOriginalCategoryFromImportMetadata(observations);
  if (!original) return undefined;
  return categoryFromOriginalLabel(original);
}
