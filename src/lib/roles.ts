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

export interface RoleQuickStart {
  id: 'survey' | 'campus' | 'import' | 'maintenance';
  label: string;
  description: string;
  to: string;
}

/** Role-tailored entry actions shown on welcome screen and home. */
export function getRoleQuickStart(role: AppRole, hasFixtures: boolean): RoleQuickStart[] {
  if (role === 'Admin' || role === 'Facilities') {
    return hasFixtures
      ? [
          { id: 'campus', label: 'Review campus progress', description: 'Buildings, floors, survey status', to: '/campus' },
          { id: 'maintenance', label: 'Check maintenance', description: 'Fixtures due for service', to: '/maintenance' },
          { id: 'import', label: 'Import spreadsheet', description: 'Bulk load or update', to: '/?import=1' },
        ]
      : [
          { id: 'import', label: 'Import spreadsheet', description: 'Upload CSV or Excel', to: '/?import=1' },
          { id: 'survey', label: 'Survey on site', description: 'Record fixtures by floor', to: '/add' },
          { id: 'campus', label: 'Set up campus', description: 'Browse buildings after import', to: '/campus' },
        ];
  }

  return hasFixtures
    ? [
        { id: 'survey', label: 'Continue surveying', description: 'Resume your last floor', to: '/add' },
        { id: 'campus', label: 'Browse campus', description: 'Pick a building and floor', to: '/campus' },
      ]
    : [
        { id: 'survey', label: 'Start a survey', description: 'Record your first fixture', to: '/add' },
        { id: 'import', label: 'Import existing data', description: 'Upload CSV or Excel', to: '/?import=1' },
      ];
}
