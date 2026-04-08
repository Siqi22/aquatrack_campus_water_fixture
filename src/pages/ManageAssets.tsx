import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Search, Droplets, Filter } from 'lucide-react';

export default function ManageAssets() {
  const { fixtures, searchFixtures } = useFixtureStore();
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const results = query ? searchFixtures(query) : fixtures;
  const filtered = filterStatus === 'all'
    ? results
    : results.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === filterStatus);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-foreground">Manage Assets</h1>
      <p className="text-sm text-muted-foreground">Search, filter, and manage fixtures</p>

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

      {/* Filter chips */}
      <div className="flex gap-2 mt-3 overflow-x-auto">
        {['all', 'Good', 'Warning', 'Urgent'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === status
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Droplets className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No fixtures found</p>
          </div>
        ) : (
          filtered.map((f) => (
            <Link
              key={f.id}
              to={`/fixture/${f.id}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {f.buildingName} — Rm {f.roomNumber}
                  </p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {f.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.brand} {f.model}</p>
                <p className="text-xs text-muted-foreground">Floor {f.floor} • {f.filterType}</p>
              </div>
              <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
