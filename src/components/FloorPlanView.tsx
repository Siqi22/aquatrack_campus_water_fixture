import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import type { FixtureStatus } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { FIELD_LABELS, FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { Droplets, Lock, PlusCircle } from 'lucide-react';

const statusColors: Record<FixtureStatus, string> = {
  Good: 'bg-status-good',
  Warning: 'bg-status-warning',
  Urgent: 'bg-status-urgent',
};

interface FloorPlanViewProps {
  buildingId: string;
  floor: string;
  buildingName: string;
  campusId?: string;
}

export function FloorPlanView({ buildingId, floor, buildingName, campusId }: FloorPlanViewProps) {
  const { getFixturesByBuildingAndFloor, getFloorProgress, setFloorStatus } = useFixtureStore();
  const fixtures = getFixturesByBuildingAndFloor(buildingId, floor);
  const floorProgress = getFloorProgress(buildingId, floor);
  const isLocked = floorProgress.status === 'Restricted';

  const statusPill: Record<typeof floorProgress.status, string> = {
    NotStarted: 'bg-secondary text-secondary-foreground',
    InProgress: 'bg-status-warning/15 text-status-warning',
    Done: 'bg-status-good/15 text-status-good',
    Restricted: 'bg-status-urgent/15 text-status-urgent',
  };

  const addHref = `/add?mode=onboard&buildingId=${encodeURIComponent(buildingId)}&floor=${encodeURIComponent(floor)}${campusId ? `&campusId=${encodeURIComponent(campusId)}` : ''}`;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-secondary/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              {buildingName} — {FIELD_LABELS.floor} {floor}
            </p>
            <p className="text-[10px] text-muted-foreground">{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} recorded</p>
          </div>
          <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusPill[floorProgress.status]}`}>
            {FLOOR_STATUS_LABELS[floorProgress.status] ?? floorProgress.status}
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all ${fixtures.length > 0 ? 'bg-status-good/80' : 'bg-muted'}`}
            style={{ width: fixtures.length > 0 ? '100%' : '8%' }}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {!isLocked && fixtures.length > 0 && floorProgress.status !== 'Done' && (
            <button
              onClick={() => setFloorStatus(buildingId, floor, 'Done')}
              className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-secondary-foreground"
            >
              Mark floor complete
            </button>
          )}
          {!isLocked && (
            <button
              onClick={() => {
                const reason = window.prompt('Why is this floor locked? (e.g. needs key/card)', floorProgress.restrictedReason ?? '');
                if (reason !== null) setFloorStatus(buildingId, floor, 'Restricted', { restrictedReason: reason });
              }}
              className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-secondary-foreground"
            >
              <Lock className="mr-1 inline h-3 w-3" />
              Mark locked
            </button>
          )}
          {isLocked && (
            <button
              onClick={() => setFloorStatus(buildingId, floor, 'InProgress')}
              className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-secondary-foreground"
            >
              Unlock floor
            </button>
          )}
        </div>
      </div>

      {isLocked ? (
        <div className="p-4">
          <div className="rounded-2xl border bg-status-urgent/5 p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-status-urgent" />
              <p className="text-sm font-semibold text-foreground">Floor locked</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {floorProgress.restrictedReason
                ? `Reason: ${floorProgress.restrictedReason}`
                : 'This floor cannot be surveyed right now.'}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Unlock the floor when access is available.</p>
          </div>
        </div>
      ) : fixtures.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <Droplets className="mb-2 h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">No fixtures on this floor yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Record fixtures here, or mark the floor locked if there is no access.</p>
          <Link
            to={addHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add first fixture
          </Link>
        </div>
      ) : (
        <div className="divide-y">
          {fixtures.map((f) => {
            const status = getFixtureStatus(f.lastMaintenanceDate);
            return (
              <Link
                key={f.id}
                to={`/fixture/${f.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/20"
              >
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColors[status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {FIELD_LABELS.room}: {f.nearestRoom || f.roomNumber}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[f.brand, f.model, f.serialNumber].filter(Boolean).join(' · ') || 'Details pending'}
                  </p>
                </div>
                <StatusBadge status={status} />
              </Link>
            );
          })}
          <div className="p-3">
            <Link
              to={addHref}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-semibold text-accent"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add another fixture
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
