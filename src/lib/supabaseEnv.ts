/** Resolve Supabase client env vars with Lovable/Vercel naming fallbacks. */
export function getSupabaseEnv(): { url: string; key: string; projectId: string } {
  const projectId = (
    import.meta.env.VITE_SUPABASE_PROJECT_ID ||
    import.meta.env.VITE_SUPABASE_PROJECT_REF ||
    ''
  ).trim();

  const url = (
    import.meta.env.VITE_SUPABASE_URL ||
    (projectId ? `https://${projectId}.supabase.co` : '')
  ).trim();

  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_KEY ||
    ''
  ).trim();

  return { url, key, projectId };
}

export function hasSupabaseEnv(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}
