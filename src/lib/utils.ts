import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn PostgREST / Supabase errors into short, actionable UI messages. */
export function formatSupabaseError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined): string {
  if (!error) return 'Unknown database error';
  const msg = error.message ?? '';
  const code = error.code ?? '';

  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Not signed in or you do not have permission to save. Sign in and try again.';
  }
  if (/invalid input value for enum/i.test(msg) && /fixture_category|category/i.test(msg)) {
    return 'Database is missing the fountain-type update. Run the category migration in Supabase (see supabase/scripts/lovable-sql-editor-run.sql).';
  }
  if (/invalid input syntax for type integer/i.test(msg) && /floor/i.test(msg)) {
    return 'Database still expects numeric floors only. Run supabase/migrations/20260520000000_floor_text.sql in Supabase.';
  }
  if (error.details) return `${msg} (${error.details})`;
  if (error.hint) return `${msg} — ${error.hint}`;
  return msg || 'Could not save to database';
}
