import { describe, expect, it } from 'vitest';
import {
  canExportData,
  canImportSpreadsheets,
  canManageFloorProgress,
  resolvePrimaryRole,
} from '@/lib/roles';

describe('roles', () => {
  it('resolves highest role when user has multiple', () => {
    expect(resolvePrimaryRole(['Surveyor', 'Facilities'])).toBe('Facilities');
    expect(resolvePrimaryRole(['Surveyor', 'Admin'])).toBe('Admin');
    expect(resolvePrimaryRole([])).toBe('Surveyor');
  });

  it('gates import/export and floor management by tier', () => {
    expect(canImportSpreadsheets('Admin')).toBe(true);
    expect(canImportSpreadsheets('Facilities')).toBe(false);
    expect(canExportData('Facilities')).toBe(true);
    expect(canExportData('Surveyor')).toBe(false);
    expect(canManageFloorProgress('Facilities')).toBe(true);
    expect(canManageFloorProgress('Surveyor')).toBe(false);
  });
});
