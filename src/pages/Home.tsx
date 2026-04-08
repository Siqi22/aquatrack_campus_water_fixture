import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Droplets, PlusCircle, ListChecks, AlertTriangle, Wrench, ArrowRight } from 'lucide-react';

export default function Home() {
  const { fixtures, getMaintenanceTasks } = useFixtureStore();
  const tasks = getMaintenanceTasks();
  const goodCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Good').length;
  const warningCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Warning').length;
  const urgentCount = fixtures.filter((f) => getFixtureStatus(f.lastMaintenanceDate) === 'Urgent').length;

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-3">
          <Droplets className="h-8 w-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">AquaTrack</h1>
        <p className="text-sm text-muted-foreground mt-1">Campus Water Fixture Manager</p>
      </div>

      {/* Primary CTAs */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          to="/add"
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/5 p-5 text-center transition-all hover:border-accent hover:bg-accent/10"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15">
            <PlusCircle className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Onboard New</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Add a fixture</p>
          </div>
        </Link>

        <Link
          to="/manage"
          className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <ListChecks className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Manage Assets</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">View & edit</p>
          </div>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
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

      {/* Maintenance Dashboard */}
      <div className="rounded-2xl border bg-card p-4">
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
