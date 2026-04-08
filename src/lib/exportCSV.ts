import { Fixture, getFixtureStatus } from '@/store/fixtureStore';

export function exportToCSV(fixtures: Fixture[]) {
  const headers = ['ID', 'Building', 'Floor', 'Room', 'Brand', 'Model', 'Serial Number', 'Filter Type', 'Last Maintenance', 'Installation Date', 'Status'];
  const rows = fixtures.map((f) => [
    f.id,
    f.buildingName,
    f.floor,
    f.roomNumber,
    f.brand,
    f.model,
    f.serialNumber,
    f.filterType,
    f.lastMaintenanceDate,
    f.installationDate,
    getFixtureStatus(f.lastMaintenanceDate),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fixtures_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
