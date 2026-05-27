import fs from 'node:fs';
import path from 'node:path';

/** Fill missing VITE_* vars from env/supabase.public.env (Lovable sync has no .env.local). */
export function loadPublicSupabaseEnv(cwd = process.cwd()): void {
  const file = path.resolve(cwd, 'env/supabase.public.env');
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}
