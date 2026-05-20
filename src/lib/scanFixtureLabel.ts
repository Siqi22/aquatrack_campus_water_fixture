import { supabase } from '@/integrations/supabase/client';
import { normalizeFixtureCategory, type FixtureCategory } from '@/store/fixtureStore';

export interface ScanFixtureLabelResult {
  brand: string;
  model: string;
  serialNumber: string;
  filterType: string;
  category: FixtureCategory;
  confidence: number;
}

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return { mimeType: 'image/jpeg', base64 };
}

/** Call Supabase Edge Function `scan-fixture-label` (Claude Haiku vision on the server). */
export async function scanFixtureLabelFromPhoto(dataUrl: string): Promise<ScanFixtureLabelResult> {
  const { base64, mimeType } = parseDataUrl(dataUrl);
  if (!base64) throw new Error('Invalid image data');

  const { data, error } = await supabase.functions.invoke('scan-fixture-label', {
    body: { imageBase64: base64, imageMimeType: mimeType },
  });

  if (error) {
    const ctx = error as { context?: Response; message?: string };
    if (ctx.context) {
      try {
        const body = await ctx.context.json();
        if (body && typeof body === 'object' && 'error' in body) {
          throw new Error(String((body as { error: string }).error));
        }
      } catch {
        /* use default message */
      }
    }
    throw new Error(ctx.message || 'Edge function error');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('No response from label scan');
  }
  if ('error' in data && data.error) {
    throw new Error(String(data.error));
  }

  const row = data as Record<string, unknown>;
  return {
    brand: String(row.brand ?? '').trim(),
    model: String(row.model ?? '').trim(),
    serialNumber: String(row.serialNumber ?? '').trim(),
    filterType: String(row.filterType ?? '').trim(),
    category: normalizeFixtureCategory(String(row.category ?? '')),
    confidence: typeof row.confidence === 'number' ? row.confidence : 0,
  };
}
