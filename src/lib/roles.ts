export interface QuickStartStep {
  id: 'survey' | 'campus' | 'import' | 'leadTesting';
  label: string;
  description: string;
  to: string;
}

/** Unified home / welcome actions for all users. */
export function getQuickStart(hasFixtures: boolean): QuickStartStep[] {
  if (hasFixtures) {
    return [
      {
        id: 'leadTesting',
        label: 'Lead testing',
        description: 'Sampling, results, and remediation',
        to: '/lead-testing',
      },
      {
        id: 'import',
        label: 'Import spreadsheet',
        description: 'Bulk load or update',
        to: '/?import=1',
      },
    ];
  }

  return [
    {
      id: 'leadTesting',
      label: 'Lead testing',
      description: 'Sampling, results, and remediation',
      to: '/lead-testing',
    },
    {
      id: 'import',
      label: 'Import existing data',
      description: 'Upload CSV or Excel',
      to: '/?import=1',
    },
  ];
}

export function canMarkFloorComplete(): boolean {
  return true;
}

export function canManageFloorProgress(): boolean {
  return true;
}

export function canMarkFloorLocked(): boolean {
  return true;
}

export function canImportSpreadsheets(): boolean {
  return true;
}

export function canExportData(): boolean {
  return true;
}
