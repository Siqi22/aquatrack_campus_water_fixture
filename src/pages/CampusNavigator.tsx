import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFixtureStore } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { PageHeader } from '@/components/layout/PageHeader';
import { FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { loadCampusNavState, saveCampusNavState } from '@/lib/campusNavState';
import { floorStatusPillClass } from '@/lib/statusStyles';
import { Building2, ChevronRight, ChevronDown, Layers } from 'lucide-react';

function getPageScrollContainer(): HTMLElement | null {
  return document.querySelector('main.scroll-gutter-stable');
}

function restorePageScroll(top: number) {
  const scrollToTop = () => {
    const el = getPageScrollContainer();
    if (el) el.scrollTop = top;
  };

  requestAnimationFrame(scrollToTop);
  requestAnimationFrame(() => requestAnimationFrame(scrollToTop));
  window.setTimeout(scrollToTop, 80);
}

export default function CampusNavigator() {
  const { campuses, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus, getFloorsByBuilding } =
    useFixtureStore();
  const navigate = useNavigate();

  const defaultCampusId = campuses[0]?.id || '';
  const [selectedCampus, setSelectedCampus] = useState(defaultCampusId);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: string } | null>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const restoreScrollTopRef = useRef<number | null>(null);

  const campusBuildings = selectedCampus ? getBuildingsByCampus(selectedCampus) : [];
  const campusFixtureCount = selectedCampus ? getFixturesByCampus(selectedCampus).length : 0;
  const currentCampus = campuses.find((c) => c.id === selectedCampus);

  useEffect(() => {
    if (!defaultCampusId || hydrated) return;
    const saved = loadCampusNavState(defaultCampusId);
    const campusValid = campuses.some((c) => c.id === saved.selectedCampus);
    setSelectedCampus(campusValid ? saved.selectedCampus : defaultCampusId);
    setExpandedBuilding(saved.expandedBuilding);
    setSelectedFloor(saved.selectedFloor);
    setListScrollTop(saved.listScrollTop);
    if (!saved.selectedFloor) restoreScrollTopRef.current = saved.listScrollTop;
    setHydrated(true);
  }, [defaultCampusId, campuses, hydrated]);

  useEffect(() => {
    if (!hydrated || !selectedCampus) return;
    saveCampusNavState({ selectedCampus, expandedBuilding, selectedFloor, listScrollTop });
  }, [hydrated, selectedCampus, expandedBuilding, selectedFloor, listScrollTop]);

  useEffect(() => {
    if (!hydrated || selectedFloor || restoreScrollTopRef.current == null) return;
    const top = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
    restorePageScroll(top);
  }, [hydrated, selectedFloor, campusBuildings.length, expandedBuilding]);

  function backFromFloor() {
    const saved = loadCampusNavState(selectedCampus || defaultCampusId);
    const nextScrollTop = saved.listScrollTop || listScrollTop;
    if (selectedFloor) {
      setExpandedBuilding(selectedFloor.buildingId);
    }
    restoreScrollTopRef.current = nextScrollTop;
    setSelectedFloor(null);
  }

  function openFloor(buildingId: string, floor: string) {
    const nextScrollTop = getPageScrollContainer()?.scrollTop ?? 0;
    const nextSelectedFloor = { buildingId, floor };
    setListScrollTop(nextScrollTop);
    setExpandedBuilding(buildingId);
    setSelectedFloor(nextSelectedFloor);
    saveCampusNavState({
      selectedCampus,
      expandedBuilding: buildingId,
      selectedFloor: nextSelectedFloor,
      listScrollTop: nextScrollTop,
    });
  }

  if (selectedFloor) {
    return (
      <div className="page-shell">
        <PageHeader
          title={`Floor ${selectedFloor.floor}`}
          subtitle={campusBuildings.find((b) => b.id === selectedFloor.buildingId)?.name ?? 'Building'}
          onBack={backFromFloor}
        />
        <FloorPlanView
          buildingId={selectedFloor.buildingId}
          floor={selectedFloor.floor}
          buildingName={campusBuildings.find((b) => b.id === selectedFloor.buildingId)?.name || ''}
          campusId={selectedCampus}
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
        <div className="chip-row mb-4">
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCampus(c.id);
                setExpandedBuilding(null);
                setSelectedFloor(null);
                setListScrollTop(0);
                restoreScrollTopRef.current = 0;
              }}
              className={selectedCampus === c.id ? 'chip-active' : 'chip-inactive'}
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
            const isOpen = expandedBuilding === b.id;
            const fixtureCount = getFixturesByBuilding(b.id).length;
            const floors = getFloorsByBuilding(b.id);
            const doneCount = floors.filter((f) => f.status === 'Done' || f.status === 'Restricted').length;
            const progressPct = floors.length ? Math.round((doneCount / floors.length) * 100) : 0;
            const nextFloor = floors.find((f) => f.status === 'NotStarted' || f.status === 'InProgress')?.floor;

            return (
              <div key={b.id} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedBuilding(isOpen ? null : b.id)}
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
                          `/add?mode=onboard&campusId=${encodeURIComponent(selectedCampus)}&buildingId=${encodeURIComponent(b.id)}&floor=${encodeURIComponent(nextFloor)}`,
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
                    {floors.map((fp) => (
                      <button
                        key={fp.floor}
                        type="button"
                        onClick={() => openFloor(b.id, fp.floor)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                      >
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm text-foreground">Floor {fp.floor}</span>
                        <span className={`status-pill ${floorStatusPillClass[fp.status]}`}>
                          {FLOOR_STATUS_LABELS[fp.status] ?? fp.status}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
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
