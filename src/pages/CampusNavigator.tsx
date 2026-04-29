import { useState } from 'react';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { CampusMap } from '@/components/CampusMap';
import { Building2, ChevronRight, ChevronDown, Layers, Map, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CampusNavigator() {
  const { campuses, userRole, setUserRole, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus, getFloorsByBuilding } = useFixtureStore();
  const navigate = useNavigate();
  const [selectedCampus, setSelectedCampus] = useState<string>(campuses[0]?.id || '');
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: number } | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  const campusBuildings = selectedCampus ? getBuildingsByCampus(selectedCampus) : [];
  const campusFixtureCount = selectedCampus ? getFixturesByCampus(selectedCampus).length : 0;
  const currentCampus = campuses.find(c => c.id === selectedCampus);
  const isFacilities = userRole === 'Facilities';

  const floorBadge: Record<string, string> = {
    NotStarted: 'bg-secondary text-secondary-foreground',
    InProgress: 'bg-status-warning/15 text-status-warning',
    Done: 'bg-status-good/15 text-status-good',
    Restricted: 'bg-status-urgent/15 text-status-urgent',
  };

  return (
    <div className="px-4 pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Campus Navigator</h1>
        <p className="text-sm text-muted-foreground">
          Browse fixtures by campus, building & floor
        </p>
      </div>

      <div className="mt-3 card-soft p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">View mode</p>
            <p className="text-[11px] text-muted-foreground">
              Collector focuses on finding unrecorded floors. Facilities can mark Restricted/Done.
            </p>
          </div>
          <div className="inline-flex rounded-full bg-secondary p-0.5">
            {(
              [
                { id: 'Surveyor', label: 'Collector' },
                { id: 'Facilities', label: 'Facilities' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setUserRole(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  userRole === opt.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full bg-secondary p-0.5">
        <button
          onClick={() => setView('list')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            view === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView('map')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            view === 'map' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
        >
          Map
        </button>
      </div>

      {/* Campus selector */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {campuses.map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelectedCampus(c.id); setExpandedBuilding(null); setSelectedFloor(null); }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCampus === c.id ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <GraduationCap className="h-3 w-3" />
            {c.name}
          </button>
        ))}
      </div>

      {/* Campus info */}
      {currentCampus && (
        <div className="mt-3 rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">{currentCampus.school}</p>
          <p className="text-xs text-muted-foreground">{currentCampus.address}</p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-muted-foreground">{campusBuildings.length} buildings</span>
            <span className="text-xs text-muted-foreground">{campusFixtureCount} fixtures</span>
          </div>
        </div>
      )}

      {view === 'map' && (
        <div className="mt-4">
          <CampusMap campusId={selectedCampus || 'all'} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Colors reflect floor collection status (Done/InProgress/NotStarted/Restricted).
          </p>
        </div>
      )}

      {/* Floor plan view */}
      {view === 'list' && selectedFloor && (
        <div className="mt-4">
          <button
            onClick={() => setSelectedFloor(null)}
            className="text-xs text-accent font-medium mb-2 flex items-center gap-1"
          >
            ← Back to buildings
          </button>
          <FloorPlanView
            buildingId={selectedFloor.buildingId}
            floor={selectedFloor.floor}
            buildingName={campusBuildings.find(b => b.id === selectedFloor.buildingId)?.name || ''}
          />
        </div>
      )}

      {/* Building list */}
      {view === 'list' && !selectedFloor && (
        <div className="mt-4 space-y-3">
          {campusBuildings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No buildings on this campus</p>
            </div>
          ) : (
            campusBuildings.map((b) => {
              const isOpen = expandedBuilding === b.id;
              const fixtureCount = getFixturesByBuilding(b.id).length;
              const floors = getFloorsByBuilding(b.id);
              const hasNotStarted = floors.some((f) => f.status === 'NotStarted');
              const firstNotStarted = floors.find((f) => f.status === 'NotStarted')?.floor;

              return (
                <div key={b.id} className="rounded-xl border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedBuilding(isOpen ? null : b.id)}
                    className="flex w-full items-center gap-3 p-4"
                  >
                    <Building2 className="h-5 w-5 text-accent" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.floors} floors • {fixtureCount} fixtures
                        {isFacilities && b.collectionStartedAt ? ` • started ${b.collectionStartedAt}` : ''}
                        {isFacilities && b.collectionEndedAt ? ` • ended ${b.collectionEndedAt}` : ''}
                      </p>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {!isOpen && !isFacilities && hasNotStarted && typeof firstNotStarted === 'number' && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => navigate(`/add?mode=onboard&campusId=${encodeURIComponent(selectedCampus)}&buildingId=${encodeURIComponent(b.id)}&floor=${encodeURIComponent(String(firstNotStarted))}`)}
                        className="w-full rounded-2xl bg-foreground py-2.5 text-xs font-semibold text-background"
                      >
                        Start recording unrecorded floor (F{firstNotStarted})
                      </button>
                    </div>
                  )}

                  {isOpen && (
                    <div className="border-t px-4 pb-3">
                      {floors.map((fp) => (
                        <button
                          key={fp.floor}
                          onClick={() => setSelectedFloor({ buildingId: b.id, floor: fp.floor })}
                          className={`flex w-full items-center gap-2 py-2.5 rounded-lg px-2 transition-colors ${
                            fp.status === 'NotStarted' && !isFacilities ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-secondary/30'
                          }`}
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm text-foreground">Floor {fp.floor}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${floorBadge[fp.status]}`}>
                            {fp.status}
                          </span>
                          <Map className="h-3 w-3 text-accent" />
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
      )}
    </div>
  );
}
