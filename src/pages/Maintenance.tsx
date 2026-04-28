import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import type { Fixture } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Wrench, ChevronLeft, Filter, Calendar } from 'lucide-react';

const MAINTENANCE_CYCLE_DAYS = 180;

type FilterKey = 'all' | 'overdue' | 'dueSoon' | 'upcoming';

const filterOptions: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'dueSoon', label: 'Due ≤30d' },
  { id: 'upcoming', label: 'Upcoming' },
];

interface Group {
  key: string;
  label: string;
  fixtures: Fixture[];
}

function groupFixtures(fixtures: Fixture[]): Group[] {
  const buckets: Record<string, Fixture[]> = {
    overdue: [],
    today: [],
    week: [],
    month: [],
    later: [],
  };
  for (const f of fixtures) {
    const days = getDaysSinceMaintenance(f.lastMaintenanceDate);
    const remaining = MAINTENANCE_CYCLE_DAYS - days;
    if (remaining < 0) buckets.overdue.push(f);
    else if (remaining <= 1) buckets.today.push(f);
    else if (remaining <= 7) buckets.week.push(f);
    else if (remaining <= 30) buckets.month.push(f);
    else buckets.later.push(f);
  }
  const order: { key: keyof typeof buckets; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Due today / tomorrow' },
    { key: 'week', label: 'Due in 7 days' },
    { key: 'month', label: 'Due in 30 days' },
    { key: 'later', label: 'Later' },
  ];
  return order
    .map((o) => ({ key: o.key, label: o.label, fixtures: buckets[o.key] }))
    .filter((g) => g.fixtures.length > 0);
}

export default function Maintenance() {
  const { fixtures, campuses } = useFixtureStore();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [campusId, setCampusId] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = campusId === 'all' ? fixtures : fixtures.filter((f) => f.campusId === campusId);
    list = list.filter((f) => {
      const remaining = MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate);
      if (filter === 'overdue') return remaining < 0;
      if (filter === 'dueSoon') return remaining >= 0 && remaining <= 30;
      if (filter === 'upcoming') return remaining > 30;
      return true;
    });
    return list.sort(
      (a, b) =>
        getDaysSinceMaintenance(b.lastMaintenanceDate) -
        getDaysSinceMaintenance(a.lastMaintenanceDate),
    );
  }, [fixtures, filter, campusId]);

  const groups = useMemo(() => groupFixtures(filtered), [filtered]);

  const overdueCount = fixtures.filter(
    (f) => MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate) < 0,
  ).length;
  const dueSoonCount = fixtures.filter((f) => {
    const r = MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate);
    return r >= 0 && r <= 30;
  }).length;

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-3">
        <Link to="/" className="rounded-lg p-1.5 hover:bg-secondary">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-accent" /> Maintenance
          </h1>
          <p className="text-xs text-muted-foreground">Filter replacement schedule (180-day cycle)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-status-urgent/10 p-3">
          <p className="text-lg font-bold text-status-urgent">{overdueCount}</p>
          <p className="text-[11px] text-status-urgent/80">Overdue</p>
        </div>
        <div className="rounded-xl bg-status-warning/10 p-3">
          <p className="text-lg font-bold text-status-warning">{dueSoonCount}</p>
          <p className="text-[11px] text-status-warning/80">Due in 30 days</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCampusId('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            campusId === 'all' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          All Campuses
        </button>
        {campuses.map((c) => (
          <button
            key={c.id}
            onClick={() => setCampusId(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              campusId === c.id ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-3.5 w-3.5 text-muted-foreground flex-none" />
        {filterOptions.map((o) => (
          <button
            key={o.id}
            onClick={() => setFilter(o.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap ${
              filter === o.id ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No fixtures match this filter</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {g.label} · {g.fixtures.length}
              </h2>
              <div className="space-y-2">
                {g.fixtures.map((f) => {
                  const days = getDaysSinceMaintenance(f.lastMaintenanceDate);
                  const remaining = MAINTENANCE_CYCLE_DAYS - days;
                  const status = getFixtureStatus(f.lastMaintenanceDate);
                  return (
                    <Link
                      key={f.id}
                      to={`/fixture/${f.id}`}
                      className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-secondary/20"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {f.buildingName} — Rm {f.roomNumber}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {f.brand} {f.model} · {f.filterType || 'no filter info'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {remaining < 0
                            ? `${Math.abs(remaining)} days overdue`
                            : `${remaining} days remaining`}{' '}
                          · last service {f.lastMaintenanceDate}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
