import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Wrench, CheckCircle2, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Maintenance() {
  const { fixtures, completeService } = useFixtureStore();

  const sorted = [...fixtures].sort((a, b) => {
    const order = { Urgent: 0, Warning: 1, Good: 2 };
    return order[getFixtureStatus(a.lastMaintenanceDate)] - order[getFixtureStatus(b.lastMaintenanceDate)];
  });

  function handleComplete(id: string) {
    completeService(id);
    toast.success('Service completed — maintenance timer reset!');
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-foreground">Maintenance</h1>
      <p className="text-sm text-muted-foreground">Service schedule sorted by urgency</p>

      <div className="mt-5 space-y-3">
        {sorted.map((f) => {
          const status = getFixtureStatus(f.lastMaintenanceDate);
          const days = getDaysSinceMaintenance(f.lastMaintenanceDate);
          const remaining = Math.max(0, 180 - days);

          return (
            <div key={f.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    <p className="text-sm font-semibold text-foreground">{f.buildingName}</p>
                  </div>
                  <p className="ml-6 text-xs text-muted-foreground">Floor {f.floor} • Room {f.roomNumber}</p>
                  <p className="ml-6 mt-1 text-xs text-muted-foreground">{f.brand} {f.model}</p>
                </div>
                <StatusBadge status={status} />
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {remaining > 0 ? `${remaining} days remaining` : `${Math.abs(remaining)} days overdue`}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  {f.filterType}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    status === 'Good' ? 'bg-status-good' : status === 'Warning' ? 'bg-status-warning' : 'bg-status-urgent'
                  }`}
                  style={{ width: `${Math.min(100, (days / 180) * 100)}%` }}
                />
              </div>

              <button
                onClick={() => handleComplete(f.id)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Service
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
