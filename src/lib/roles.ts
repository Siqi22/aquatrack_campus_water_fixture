import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

const ROLE_RANK: Record<AppRole, number> = {
  Surveyor: 1,
  Facilities: 2,
  Admin: 3,
};

/** UI labels aligned with the three-layer feedback model. */
export const ROLE_META: Record<
  AppRole,
  { label: string; tier: 1 | 2 | 3; description: string }
> = {
  Surveyor: {
    label: 'Collector',
    tier: 1,
    description: 'Survey fixtures and record on-site data.',
  },
  Facilities: {
    label: 'Building coordinator',
    tier: 2,
    description: 'Manage floor progress and maintenance for assigned buildings.',
  },
  Admin: {
    label: 'UW Facilities',
    tier: 3,
    description: 'Campus-wide oversight and administration.',
  },
};

/** Pick the highest-privilege role when a user has multiple rows in user_roles. */
export function resolvePrimaryRole(roles: AppRole[]): AppRole {
  if (roles.length === 0) return 'Surveyor';
  return roles.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}

export function roleRank(role: AppRole): number {
  return ROLE_RANK[role];
}

export function hasMinRole(role: AppRole, minimum: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Mark floor complete / unlock — building coordinator and above. */
export function canManageFloorProgress(role: AppRole): boolean {
  return hasMinRole(role, 'Facilities');
}

/** Mark floor locked when collector has no access — all authenticated roles. */
export function canMarkFloorLocked(_role: AppRole): boolean {
  return true;
}

export function canImportSpreadsheets(_role: AppRole): boolean {
  return true;
}

export function canExportData(_role: AppRole): boolean {
  return true;
}
