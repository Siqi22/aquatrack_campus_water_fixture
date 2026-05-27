import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFixtureStore } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { PageHeader } from '@/components/layout/PageHeader';
import { FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { Building2, ChevronRight, ChevronDown, Layers } from 'lucide-react';

export default function CampusNavigator() {
  const { campuses, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus, getFloorsByBuilding } =
    useFixtureStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultCampusId = campuses[0]?.id ?? '';
  const campusId = searchParams.get('campus') || defaultCampusId;
  const buildingId = searchParams.get('building');
  const floor = searchParams.get('floor');
  const focusFloor = searchParams.get('focus');

  const patchParams = useCallback(
    (patch: Record<string, string | null | undefined>, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          const resolvedCampus = next.get('campus') || campusId || defaultCampusId;
          if (resolvedCampus) next.set('campus', resolvedCampus);
          return next;
        },
        { replace },
      );
    },
    [campusId, defaultCampusId, setSearchParams],
  );

  const campusBuildings = campusId ? getBuildingsByCampus(campusId) : [];
  const campusFixtureCount = campusId ? getFixturesByCampus(campusId).length : 0;
  const currentCampus = campuses.find((c) => c.id === campusId);

  const floorBadge: Record<string, string> = {
    NotStarted: 'bg-secondary text-secondary-foreground',
    InProgress: 'bg-status-warning/15 text-status-warning',
    Done: 'bg-status-good/15 text-status-good',
    Restricted: 'bg-status-urgent/15 text-status-urgent',
  };

  const activeBuilding = useMemo(
    () => (buildingId ? campusBuildings.find((b) => b.id === buildingId) : undefined),
    [buildingId, campusBuildings],
  );

  if (buildingId && floor && activeBuilding) {
    return (
      <div className="page-shell">
        <PageHeader
          title={`Floor ${floor}`}
          subtitle={activeBuilding.name}
          onBack={() => patchParams({ floor: null, focus: floor })}
        />
        <FloorPlanView
          buildingId={buildingId}
          floor={floor}
          buildingName={activeBuilding.name}
          campusId={campusId}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Campus"
        subtitle={
          currentCampus
            ? `${campusBuildings.length} buildings · ${campusFixtureCount} fixtures`
            : 'Select a campus to browse'
        }
      />

      {campuses.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patchParams({ campus: c.id, building: null, floor: null, focus: null })}
              className={campusId === c.id ? 'chip-active' : 'chip-inactive'}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {currentCampus && campuses.length === 1 && (
        <p className="mb-4 text-sm text-muted-foreground">{currentCampus.school}</p>
      )}

      <div className="space-y-2">
        {campusBuildings.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground">No buildings yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Import data or start a survey to add buildings.</p>
          </div>
        ) : (
          campusBuildings.map((b) => {
            const isOpen = buildingId === b.id;
            const fixtureCount = getFixturesByBuilding(b.id).length;
            const floors = getFloorsByBuilding(b.id);
            const doneCount = floors.filter((f) => f.status === 'Done' || f.status === 'Restricted').length;
            const progressPct = floors.length ? Math.round((doneCount / floors.length) * 100) : 0;
            const nextFloor = floors.find((f) => f.status === 'NotStarted' || f.status === 'InProgress')?.floor;

            return (
              <div key={b.id} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (isOpen) patchParams({ building: null, floor: null, focus: null });
                    else patchParams({ building: b.id, floor: null, focus: null });
                  }}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="action-tile-icon">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fixtureCount} fixtures · {progressPct}% complete
                    </p>
                    <div className="mt-2 h-1 max-w-[120px] overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary/70" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {!isOpen && nextFloor && (
                  <div className="border-t px-4 pb-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/add?mode=onboard&campusId=${encodeURIComponent(campusId)}&buildingId=${encodeURIComponent(b.id)}&floor=${encodeURIComponent(nextFloor)}`,
                        )
                      }
                      className="btn-primary w-full text-xs"
                    >
                      Continue · Floor {nextFloor}
                    </button>
                  </div>
                )}

                {isOpen && (
                  <div className="border-t px-2 pb-2">
                    {floors.map((fp) => {
                      const isFocused = focusFloor === fp.floor;
                      return (
                        <button
                          key={fp.floor}
                          type="button"
                          onClick={() => patchParams({ building: b.id, floor: fp.floor, focus: null })}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 ${
                            isFocused ? 'bg-accent/10 ring-1 ring-accent/30' : ''
                          }`}
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-sm text-foreground">Floor {fp.floor}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${floorBadge[fp.status]}`}
                          >
                            {FLOOR_STATUS_LABELS[fp.status] ?? fp.status}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
