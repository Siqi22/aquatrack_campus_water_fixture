import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Search, Droplets, AlertTriangle, CheckCircle2, Download, Wrench, ArrowRight } from 'lucide-react';
import { exportToCSV } from '@/lib/exportCSV';

export default function Dashboard() {
  const { fixtures, campuses, searchFixtures, getMaintenanceTasks, getFixturesByCampus } = useFixtureStore();
  const [query, setQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');

  const filteredFixtures = selectedCampus === 'all' ? fixtures : getFixturesByCampus(selectedCampus);
  const results = query ? searchFixtures(query).filter(f => selectedCampus === 'all' || f.campusId === selectedCampus) : [];
  const tasks = getMaintenanceTasks().filter(f => selectedCampus === 'all' || f.campusId === selectedCampus);
  const goodCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Good').length;
  const warningCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Warning').length;
  const urgentCount = filteredFixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Urgent').length;

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-foreground">AquaTrack</h1>
          </div>
          <p className="text-sm text-muted-foreground">Campus Fixture Dashboard</p>
        </div>
        <button
          onClick={() => exportToCSV(filteredFixtures)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

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
        <div className="rounded-xl border bg-card p-4">
          <Droplets className="h-5 w-5 text-accent" />
          <p className="mt-2 text-2xl font-bold text-foreground">{filteredFixtures.length}</p>
          <p className="text-xs text-muted-foreground">Total Fixtures</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <AlertTriangle className="h-5 w-5 text-status-warning" />
          <p className="mt-2 text-2xl font-bold text-foreground">{tasks.length}</p>
          <p className="text-xs text-muted-foreground">Due for Service</p>
        </div>
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
