import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Search,
  Droplets,
  AlertTriangle,
  Download,
  Upload,
  Wrench,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { ExportDialog } from '@/components/ExportDialog';
import { ImportDialog } from '@/components/ImportDialog';
import { FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    fixtures,
    campuses,
    buildings,
    loading,
    loaded,
    searchFixtures,
    getMaintenanceTasks,
    getFixturesByCampus,
    getBuildingsByCampus,
    getFloorsByBuilding,
  } = useFixtureStore();
  const [query, setQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setImportOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const myFixtureCount = useMemo(
    () => (user?.id ? fixtures.filter((f) => f.createdBy === user.id).length : 0),
    [fixtures, user?.id],
  );

  const filteredFixtures = selectedCampus === 'all' ? fixtures : getFixturesByCampus(selectedCampus);
  const results = query
    ? searchFixtures(query).filter((f) => selectedCampus === 'all' || f.campusId === selectedCampus)
    : [];
  const tasks = getMaintenanceTasks().filter((f) => selectedCampus === 'all' || f.campusId === selectedCampus);
  const goodCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Good').length;
  const warningCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Warning').length;
  const urgentCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Urgent').length;

  const scopedBuildings = selectedCampus === 'all' ? buildings : getBuildingsByCampus(selectedCampus);

  const progressRows = scopedBuildings.map((b) => {
    const floors = getFloorsByBuilding(b.id);
    const counts = floors.reduce(
      (acc, f) => {
        acc[f.status] += 1;
        return acc;
      },
      { NotStarted: 0, InProgress: 0, Done: 0, Restricted: 0 } as Record<
        'NotStarted' | 'InProgress' | 'Done' | 'Restricted',
        number
      >,
    );
    return { building: b, floors, counts };
  });

  const showSharedWorkspaceNotice =
    loaded && fixtures.length > 0 && user?.id != null && myFixtureCount === 0;

  return (
    <div className="px-4 pt-6 pb-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Droplets className="h-6 w-6 text-accent" />
          <h1 className="text-xl font-bold text-foreground">AquaTrack</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Campus drinking-water inventory — data lives in your workspace, not in the app bundle
        </p>
      </div>

      {/* Data management — always visible; import is user-upload only */}
      <section className="mt-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Import & export</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Upload a CSV or Excel file from your computer. We detect columns, preview rows, and import only after
              you confirm. No spreadsheet is bundled with the app.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Import spreadsheet
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!loaded || fixtures.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </section>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Link
        to="/add"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-accent/10"
      >
        <PlusCircle className="h-5 w-5 text-accent" />
        Survey a fixture on site
      </Link>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} fixtures={filteredFixtures} campuses={campuses} />

      {!loaded && loading && (
        <div className="mt-6 rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading workspace…
        </div>
      )}

      {loaded && fixtures.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed bg-secondary/20 p-6 text-center">
          <Droplets className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold text-foreground">Your workspace is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted-foreground">
            Nothing has been imported yet. Use <strong className="font-semibold text-foreground">Import spreadsheet</strong>{' '}
            to bulk-load existing records, or survey fixtures one at a time on site.
          </p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload your file
          </button>
        </div>
      )}

      {showSharedWorkspaceNotice && (
        <div className="mt-4 flex gap-2 rounded-xl border border-status-warning/30 bg-status-warning/5 px-3 py-2.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
          <span>
            This workspace already has <strong className="font-semibold text-foreground">{fixtures.length}</strong>{' '}
            fixtures from earlier imports or other users. You have not imported anything yet — use{' '}
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              Import spreadsheet
            </button>{' '}
            to add your file, or survey new fixtures manually.
          </span>
        </div>
      )}

      {loaded && fixtures.length > 0 && (
        <>
          {/* Campus filter */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCampus('all')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCampus === 'all'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              All Campuses
            </button>
            {campuses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCampus(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCampus === c.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by room, model, serial, or building..."
              className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {query && (
            <div className="mt-2 rounded-xl border bg-card p-3">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results found.</p>
              ) : (
                results.map((f) => (
                  <Link
                    key={f.id}
                    to={`/fixture/${f.id}`}
                    className="flex items-center justify-between border-b py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {f.buildingName} — Fl {f.floor}, {f.roomNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {f.brand} {f.model}
                      </p>
                    </div>
                    <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
                  </Link>
                ))
              )}
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-status-good/10 p-3 text-center">
              <p className="text-lg font-bold text-status-good">{goodCount}</p>
              <p className="text-[10px] font-medium text-status-good/80">Good</p>
            </div>
            <div className="rounded-xl bg-status-warning/10 p-3 text-center">
              <p className="text-lg font-bold text-status-warning">{warningCount}</p>
              <p className="text-[10px] font-medium text-status-warning/80">Warning</p>
            </div>
            <div className="rounded-xl bg-status-urgent/10 p-3 text-center">
              <p className="text-lg font-bold text-status-urgent">{urgentCount}</p>
              <p className="text-[10px] font-medium text-status-urgent/80">Urgent</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card-soft p-4">
              <Droplets className="h-5 w-5 text-accent" />
              <p className="mt-2 text-2xl font-bold text-foreground">{filteredFixtures.length}</p>
              <p className="text-xs text-muted-foreground">Fixtures in workspace</p>
            </div>
            <div className="card-soft p-4">
              <AlertTriangle className="h-5 w-5 text-status-warning" />
              <p className="mt-2 text-2xl font-bold text-foreground">{tasks.length}</p>
              <p className="text-xs text-muted-foreground">Due for service</p>
            </div>
          </div>

          {/* Collection progress */}
          <div className="mt-4 card-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Survey progress</h2>
                <p className="text-xs text-muted-foreground">Floor collection status across buildings</p>
              </div>
              <div className="text-[10px] text-muted-foreground">{progressRows.length} buildings</div>
            </div>

            {progressRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No buildings yet — import a spreadsheet or add a campus while surveying.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {progressRows.map(({ building, floors, counts }) => {
                  const total = floors.length || 1;
                  const doneRatio = (counts.Done + counts.Restricted) / total;
                  const inProgRatio = counts.InProgress / total;

                  return (
                    <div key={building.id} className="rounded-2xl bg-secondary/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{building.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {counts.Done} complete • {counts.InProgress} in progress • {counts.NotStarted} not started
                            {counts.Restricted ? ` • ${counts.Restricted} locked` : ''}
                          </p>
                        </div>
                        <Link to="/campus" className="text-[11px] font-semibold text-accent">
                          Open
                        </Link>
                      </div>

                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary flex">
                        <div className="h-full bg-status-good/70" style={{ width: `${Math.round(doneRatio * 100)}%` }} />
                        <div
                          className="h-full bg-status-warning/70"
                          style={{ width: `${Math.round(inProgRatio * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {Math.round(doneRatio * 100)}% floors complete or locked
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                        <span className="rounded-full bg-status-good/15 px-2 py-0.5 text-status-good">
                          {FLOOR_STATUS_LABELS.Done}
                        </span>
                        <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-status-warning">
                          {FLOOR_STATUS_LABELS.InProgress}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                          {FLOOR_STATUS_LABELS.NotStarted}
                        </span>
                        {counts.Restricted > 0 && (
                          <span className="rounded-full bg-status-urgent/15 px-2 py-0.5 text-status-urgent">
                            {FLOOR_STATUS_LABELS.Restricted}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Maintenance Tasks */}
          <div className="mt-5 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
              </div>
              <Link to="/maintenance" className="flex items-center gap-1 text-xs text-accent font-medium">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All fixtures up to date</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 3).map((f) => (
                  <Link
                    key={f.id}
                    to={`/fixture/${f.id}`}
                    className="flex items-center justify-between rounded-xl bg-secondary/50 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {f.buildingName} — Fl {f.floor}, {f.roomNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getDaysSinceMaintenance(f.lastMaintenanceDate)} days since service
                      </p>
                    </div>
                    <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
