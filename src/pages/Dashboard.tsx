import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Search, Droplets, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/exportCSV';

export default function Dashboard() {
  const { fixtures, searchFixtures, getMaintenanceTasks } = useFixtureStore();
  const [query, setQuery] = useState('');

  const results = query ? searchFixtures(query) : [];
  const tasks = getMaintenanceTasks();
  const goodCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Good').length;
  const warningCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Warning').length;
  const urgentCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Urgent').length;

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">AquaTrack</h1>
          <p className="text-sm text-muted-foreground">Campus Fixture Manager</p>
        </div>
        <button
          onClick={() => exportToCSV(fixtures)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Search */}
      <div className="relative mt-4">
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
              <div key={f.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{f.buildingName} — Rm {f.roomNumber}</p>
                  <p className="text-xs text-muted-foreground">{f.brand} {f.model}</p>
                </div>
                <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <Droplets className="h-5 w-5 text-accent" />
          <p className="mt-2 text-2xl font-bold text-foreground">{fixtures.length}</p>
          <p className="text-xs text-muted-foreground">Total Fixtures</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <AlertTriangle className="h-5 w-5 text-status-warning" />
          <p className="mt-2 text-2xl font-bold text-foreground">{tasks.length}</p>
          <p className="text-xs text-muted-foreground">Due for Service</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <CheckCircle2 className="h-5 w-5 text-status-good" />
          <p className="mt-2 text-2xl font-bold text-foreground">{goodCount}</p>
          <p className="text-xs text-muted-foreground">Good Status</p>
        </div>
        <div className="rounded-xl border bg-card p-4 relative overflow-hidden">
          <div className="flex gap-4">
            <div>
              <span className="text-lg font-bold text-status-warning">{warningCount}</span>
              <p className="text-[10px] text-muted-foreground">Warning</p>
            </div>
            <div>
              <span className="text-lg font-bold text-status-urgent">{urgentCount}</span>
              <p className="text-[10px] text-muted-foreground">Urgent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Tasks */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">Maintenance Tasks</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">All fixtures are up to date! ✓</p>
        ) : (
          <div className="mt-2 space-y-2">
            {tasks.map((f) => (
              <Link
                key={f.id}
                to="/maintenance"
                className="flex items-center justify-between rounded-xl border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {f.buildingName} — Rm {f.roomNumber}
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
    </div>
  );
}
