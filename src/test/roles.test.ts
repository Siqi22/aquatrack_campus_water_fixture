import { describe, expect, it } from 'vitest';
import {
  canExportData,
  canImportSpreadsheets,
  canManageFloorProgress,
  canMarkFloorComplete,
  getQuickStart,
} from '@/lib/roles';

describe('roles', () => {
  it('allows all permissions for every user', () => {
    expect(canImportSpreadsheets()).toBe(true);
    expect(canExportData()).toBe(true);
    expect(canManageFloorProgress()).toBe(true);
    expect(canMarkFloorComplete()).toBe(true);
  });

  it('returns survey-first quick start when empty', () => {
    expect(getQuickStart(false)[0].id).toBe('survey');
  });

  it('returns campus-first quick start when fixtures exist', () => {
    expect(getQuickStart(true)[0].id).toBe('campus');
  });
});
