import { supabase } from '@/integrations/supabase/client';
import type { LeadReportRowDraft } from '@/lib/leadReportImport';

function resolveApiUrl() {
  const explicit = import.meta.env.VITE_LEAD_PDF_API_URL?.trim();
  if (explicit) return explicit;
  const vercelApp = import.meta.env.VITE_VERCEL_APP_URL?.trim();
  return vercelApp
    ? `${vercelApp.replace(/\/$/, '')}/api/parse-lead-report`
    : '/api/parse-lead-report';
}

export async function extractLeadReportWithClaude(
  storagePath: string,
  fileName: string,
): Promise<LeadReportRowDraft[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in to read PDF reports.');

  const response = await fetch(resolveApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ storagePath, fileName }),
  });

  let body: { rows?: LeadReportRowDraft[]; error?: string } = {};
  try {
    body = await response.json();
  } catch {
    /* Vercel may return a non-JSON timeout page. */
  }
  if (!response.ok) {
    throw new Error(body.error || `PDF reading failed (${response.status}).`);
  }
  if (!Array.isArray(body.rows) || !body.rows.length) {
    throw new Error('Claude found no fixture-level lead results in this PDF.');
  }
  return body.rows;
}
