import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import type { Fixture } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuickStat } from '@/components/layout/QuickStat';
import { Calendar } from 'lucide-react';

const MAINTENANCE_CYCLE_DAYS = 180;

type FilterKey = 'all' | 'overdue' | 'dueSoon';

const filterOptions: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'All due' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'dueSoon', label: '≤30 days' },
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
  };
  for (const f of fixtures) {
    const days = getDaysSinceMaintenance(f.lastMaintenanceDate);
    const remaining = MAINTENANCE_CYCLE_DAYS - days;
    if (remaining < 0) buckets.overdue.push(f);
    else if (remaining <= 7) buckets.week.push(f);
    else if (remaining <= 30) buckets.month.push(f);
    else buckets.today.push(f);
  }
  const order: { key: keyof typeof buckets; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'week', label: 'Due within 7 days' },
    { key: 'month', label: 'Due within 30 days' },
  ];
  return order
    .map((o) => ({ key: o.key, label: o.label, fixtures: buckets[o.key] }))
    .filter((g) => g.fixtures.length > 0);
}

export default function Maintenance() {
  const { fixtures } = useFixtureStore();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    return fixtures
      .filter((f) => {
        const remaining = MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate);
        if (filter === 'overdue') return remaining < 0;
        if (filter === 'dueSoon') return remaining >= 0 && remaining <= 30;
        return remaining <= 30;
      })
      .sort(
        (a, b) =>
          getDaysSinceMaintenance(b.lastMaintenanceDate) - getDaysSinceMaintenance(a.lastMaintenanceDate),
      );
  }, [fixtures, filter]);

  const groups = useMemo(() => groupFixtures(filtered), [filtered]);

  const overdueCount = fixtures.filter(
    (f) => MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate) < 0,
  ).length;
  const dueSoonCount = fixtures.filter((f) => {
    const r = MAINTENANCE_CYCLE_DAYS - getDaysSinceMaintenance(f.lastMaintenanceDate);
    return r >= 0 && r <= 30;
  }).length;

  return (
    <div className="page-shell">
      <PageHeader
        title="Maintenance"
        subtitle="180-day filter service cycle"
        backTo="/"
      />

      <div className="flex gap-2">
        <QuickStat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'urgent' : 'default'} />
        <QuickStat label="Due soon" value={dueSoonCount} tone={dueSoonCount > 0 ? 'warning' : 'default'} />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filterOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setFilter(o.id)}
            className={filter === o.id ? 'chip-active' : 'chip-inactive'}
          >
            {o.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          <Calendar className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm">Nothing due in this range</p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="section-label mb-2">
                {g.label} · {g.fixtures.length}
              </h2>
              <div className="space-y-2">
                {g.fixtures.map((f) => {
                  const days = getDaysSinceMaintenance(f.lastMaintenanceDate);
                  const remaining = MAINTENANCE_CYCLE_DAYS - days;
                  return (
                    <Link key={f.id} to={`/fixture/${f.id}`} className="list-row">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {f.buildingName} · Rm {f.roomNumber}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {remaining < 0
                            ? `${Math.abs(remaining)} days overdue`
                            : `${remaining} days remaining`}
                        </p>
                      </div>
                      <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
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
