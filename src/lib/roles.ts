export interface QuickStartStep {
  id: 'survey' | 'campus' | 'import' | 'maintenance';
  label: string;
  description: string;
  to: string;
}

/** Unified home / welcome actions for all users. */
export function getQuickStart(hasFixtures: boolean): QuickStartStep[] {
  if (hasFixtures) {
    return [
      {
        id: 'campus',
        label: 'Review campus progress',
        description: 'Buildings, floors, survey status',
        to: '/campus',
      },
      {
        id: 'maintenance',
        label: 'Check maintenance',
        description: 'Fixtures due for service',
        to: '/maintenance',
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
      id: 'survey',
      label: 'Start a survey',
      description: 'Record your first fixture',
      to: '/add',
    },
    {
      id: 'import',
      label: 'Import existing data',
      description: 'Upload CSV or Excel',
      to: '/?import=1',
    },
    {
      id: 'campus',
      label: 'Set up campus',
      description: 'Browse buildings after import',
      to: '/campus',
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
