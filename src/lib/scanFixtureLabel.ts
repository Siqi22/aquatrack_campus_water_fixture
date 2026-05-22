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

function resolveScanApiUrl(): string {
  const explicit = import.meta.env.VITE_SCAN_API_URL?.trim();
  if (explicit) return explicit;

  const vercelApp = import.meta.env.VITE_VERCEL_APP_URL?.trim();
  if (vercelApp) {
    return `${vercelApp.replace(/\/$/, '')}/api/scan-fixture-label`;
  }

  return '/api/scan-fixture-label';
}

function parseScanResponse(row: Record<string, unknown>): ScanFixtureLabelResult {
  return {
    brand: String(row.brand ?? '').trim(),
    model: String(row.model ?? '').trim(),
    serialNumber: String(row.serialNumber ?? '').trim(),
    filterType: String(row.filterType ?? '').trim(),
    category: normalizeFixtureCategory(String(row.category ?? '')),
    confidence: typeof row.confidence === 'number' ? row.confidence : 0,
  };
}

/** Call Vercel API route (Claude Haiku on server). Bypasses Lovable-managed Supabase Edge Functions. */
export async function scanFixtureLabelFromPhoto(dataUrl: string): Promise<ScanFixtureLabelResult> {
  const { base64, mimeType } = parseDataUrl(dataUrl);
  if (!base64) throw new Error('Invalid image data');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to use AI label scan');
  }

  const response = await fetch(resolveScanApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error page */
  }

  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : `Label scan failed (${response.status})`;
    throw new Error(message);
  }

  return parseScanResponse(body);
}
