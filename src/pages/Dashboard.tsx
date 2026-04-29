import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Search, Droplets, AlertTriangle, CheckCircle2, Download, Wrench, ArrowRight } from 'lucide-react';
import { ExportDialog } from '@/components/ExportDialog';

export default function Dashboard() {
  const { fixtures, campuses, buildings, userRole, searchFixtures, getMaintenanceTasks, getFixturesByCampus, getBuildingsByCampus, getFloorsByBuilding } = useFixtureStore();
  const [query, setQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [exportOpen, setExportOpen] = useState(false);

  const filteredFixtures = selectedCampus === 'all' ? fixtures : getFixturesByCampus(selectedCampus);
  const results = query ? searchFixtures(query).filter(f => selectedCampus === 'all' || f.campusId === selectedCampus) : [];
  const tasks = getMaintenanceTasks().filter(f => selectedCampus === 'all' || f.campusId === selectedCampus);
  const goodCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Good').length;
  const warningCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Warning').length;
  const urgentCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Urgent').length;
  const isFacilities = userRole === 'Facilities';

  const scopedBuildings =
    selectedCampus === 'all' ? buildings : getBuildingsByCampus(selectedCampus);

  const progressRows = scopedBuildings.map((b) => {
    const floors = getFloorsByBuilding(b.id);
    const counts = floors.reduce(
      (acc, f) => {
        acc[f.status] += 1;
        return acc;
      },
      { NotStarted: 0, InProgress: 0, Done: 0, Restricted: 0 } as Record<'NotStarted' | 'InProgress' | 'Done' | 'Restricted', number>,
    );
    return { building: b, floors, counts };
  });

  return (
    <div className="px-4 pt-6">
      <div className="card-soft relative overflow-hidden p-4">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10" />
        <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Droplets className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">AquaTrack</h1>
              <p className="text-xs text-muted-foreground">Campus Fixture Dashboard</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        </div>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} fixtures={filteredFixtures} campuses={campuses} />

      {/* Campus filter */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCampus('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            selectedCampus === 'all' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          All Campuses
        </button>
        {campuses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCampus(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCampus === c.id ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
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
          placeholder="Search by room, model, or building..."
          className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {query && (
        <div className="mt-2 rounded-xl border bg-card p-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results found.</p>
          ) : (
            results.map((f) => (
              <Link key={f.id} to={`/fixture/${f.id}`} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{f.buildingName} — Rm {f.roomNumber}</p>
                  <p className="text-xs text-muted-foreground">{f.brand} {f.model}</p>
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
          <p className="text-xs text-muted-foreground">Total Fixtures</p>
        </div>
        <div className="card-soft p-4">
          <AlertTriangle className="h-5 w-5 text-status-warning" />
          <p className="mt-2 text-2xl font-bold text-foreground">{tasks.length}</p>
          <p className="text-xs text-muted-foreground">Due for Service</p>
        </div>
      </div>

      {/* Collection progress (by floor status) */}
      <div className="mt-4 card-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Collection progress</h2>
            <p className="text-xs text-muted-foreground">
              Status by floor {isFacilities ? '(Facilities view)' : ''}
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground">{progressRows.length} buildings</div>
        </div>

        {progressRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No buildings available.</p>
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
                        Floors: {floors.length} • Done {counts.Done} • InProgress {counts.InProgress} • NotStarted {counts.NotStarted}
                        {counts.Restricted ? ` • Restricted ${counts.Restricted}` : ''}
                      </p>
                    </div>
                    <Link to="/campus" className="text-[11px] font-semibold text-foreground">
                      View
                    </Link>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-status-good/70" style={{ width: `${Math.round(doneRatio * 100)}%` }} />
                    <div className="h-full bg-status-warning/70" style={{ width: `${Math.round(inProgRatio * 100)}%` }} />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                    <span className="rounded-full bg-status-good/15 px-2 py-0.5 text-status-good">Done/Restricted</span>
                    <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-status-warning">InProgress</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">NotStarted</span>
                    <span className="rounded-full bg-status-urgent/15 px-2 py-0.5 text-status-urgent">Restricted</span>
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
            <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
          </div>
          <Link to="/maintenance" className="flex items-center gap-1 text-xs text-accent font-medium">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">All fixtures up to date ✓</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 3).map((f) => (
              <Link
                key={f.id}
                to={`/fixture/${f.id}`}
                className="flex items-center justify-between rounded-xl bg-secondary/50 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{f.buildingName} — Rm {f.roomNumber}</p>
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

      {/* Total counter */}
      <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
        <Droplets className="h-4 w-4" />
        <span className="text-sm font-medium">{fixtures.length} total fixtures tracked</span>
      </div>
    </div>
  );
}
