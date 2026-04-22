import { supabase } from '@/integrations/supabase/client';

/**
 * Convert a data URL to a Blob for upload.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/**
 * Upload a fixture photo (data URL) to the fixture-photos bucket.
 * Returns a signed URL valid for ~1 year (re-signed on demand).
 */
export async function uploadFixturePhoto(dataUrl: string, kind: 'general' | 'plate'): Promise<string> {
  if (!dataUrl?.startsWith('data:')) return dataUrl ?? '';
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id ?? 'anon';
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.split('/')[1] ?? 'jpg';
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from('fixture-photos').upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from('fixture-photos')
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  return signed.signedUrl;
}
