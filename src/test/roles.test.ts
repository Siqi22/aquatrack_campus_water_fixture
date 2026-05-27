import { describe, expect, it } from 'vitest';
import {
  canExportData,
  canImportSpreadsheets,
  canManageFloorProgress,
  canMarkFloorComplete,
  getRoleQuickStart,
  resolvePrimaryRole,
} from '@/lib/roles';

describe('roles', () => {
  it('resolves highest role when user has multiple', () => {
    expect(resolvePrimaryRole(['Surveyor', 'Facilities'])).toBe('Facilities');
    expect(resolvePrimaryRole(['Surveyor', 'Admin'])).toBe('Admin');
    expect(resolvePrimaryRole([])).toBe('Surveyor');
  });

  it('allows import/export for all roles; floor management for coordinator+', () => {
    expect(canImportSpreadsheets('Admin')).toBe(true);
    expect(canImportSpreadsheets('Surveyor')).toBe(true);
    expect(canExportData('Facilities')).toBe(true);
    expect(canExportData('Surveyor')).toBe(true);
    expect(canManageFloorProgress('Facilities')).toBe(true);
    expect(canManageFloorProgress('Surveyor')).toBe(false);
    expect(canMarkFloorComplete('Surveyor')).toBe(true);
    expect(canMarkFloorComplete('Facilities')).toBe(true);
    expect(getRoleQuickStart('Surveyor', false)[0].id).toBe('survey');
    expect(getRoleQuickStart('Admin', false)[0].id).toBe('import');
  });
});
