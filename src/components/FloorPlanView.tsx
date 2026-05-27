import { Link } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { FIELD_LABELS, FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { canManageFloorProgress, canMarkFloorLocked } from '@/lib/roles';
import { floorStatusPillClass, fixtureStatusDotClass } from '@/lib/statusStyles';
import { Droplets, Lock, PlusCircle } from 'lucide-react';

interface FloorPlanViewProps {
  buildingId: string;
  floor: string;
  buildingName: string;
  campusId?: string;
}

export function FloorPlanView({ buildingId, floor, buildingName, campusId }: FloorPlanViewProps) {
  const { getFixturesByBuildingAndFloor, getFloorProgress, setFloorStatus, primaryRole } = useFixtureStore();
  const canManageProgress = canManageFloorProgress(primaryRole);
  const canLock = canMarkFloorLocked(primaryRole);
  const fixtures = getFixturesByBuildingAndFloor(buildingId, floor);
  const floorProgress = getFloorProgress(buildingId, floor);
  const isLocked = floorProgress.status === 'Restricted';

  const statusPill = floorStatusPillClass;

  const addHref = `/add?mode=onboard&buildingId=${encodeURIComponent(buildingId)}&floor=${encodeURIComponent(floor)}${campusId ? `&campusId=${encodeURIComponent(campusId)}` : ''}`;

  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b bg-secondary/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              {buildingName} — {FIELD_LABELS.floor} {floor}
            </p>
            <p className="text-[10px] text-muted-foreground">{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} recorded</p>
          </div>
          <div className={`status-pill ${statusPill[floorProgress.status]}`}>
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
          {canManageProgress && !isLocked && fixtures.length > 0 && floorProgress.status !== 'Done' && (
            <button
              onClick={() => setFloorStatus(buildingId, floor, 'Done')}
              className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-secondary-foreground"
            >
              Mark floor complete
            </button>
          )}
          {canLock && !isLocked && (
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
          {canManageProgress && isLocked && (
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
        <div className="empty-state px-4 py-10">
          <Droplets className="empty-state-icon" />
          <p className="text-sm font-medium text-foreground">No fixtures on this floor yet</p>
          <p className="mt-1 text-caption text-muted-foreground">Record fixtures here, or mark the floor locked if there is no access.</p>
          <Link to={addHref} className="btn-primary mt-4 inline-flex text-xs">
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
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${fixtureStatusDotClass[status]}`} />
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
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 py-2.5 text-xs font-semibold text-primary"
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
