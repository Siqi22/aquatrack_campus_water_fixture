import { useState } from 'react';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { Building2, ChevronRight, ChevronDown, Layers, Map, GraduationCap } from 'lucide-react';

export default function CampusNavigator() {
  const { campuses, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus } = useFixtureStore();
  const [selectedCampus, setSelectedCampus] = useState<string>(campuses[0]?.id || '');
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: number } | null>(null);

  const campusBuildings = selectedCampus ? getBuildingsByCampus(selectedCampus) : [];
  const campusFixtureCount = selectedCampus ? getFixturesByCampus(selectedCampus).length : 0;
  const currentCampus = campuses.find(c => c.id === selectedCampus);

  return (
    <div className="px-4 pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Campus Navigator</h1>
        <p className="text-sm text-muted-foreground">Browse fixtures by campus, building & floor</p>
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

      {/* Floor plan view */}
      {selectedFloor && (
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
      {!selectedFloor && (
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

              return (
                <div key={b.id} className="rounded-xl border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedBuilding(isOpen ? null : b.id)}
                    className="flex w-full items-center gap-3 p-4"
                  >
                    <Building2 className="h-5 w-5 text-accent" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.floors} floors • {fixtureCount} fixtures</p>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 pb-3">
                      {Array.from({ length: b.floors }, (_, i) => i + 1).map((floor) => (
                        <button
                          key={floor}
                          onClick={() => setSelectedFloor({ buildingId: b.id, floor })}
                          className="flex w-full items-center gap-2 py-2.5 hover:bg-secondary/30 rounded-lg px-2 transition-colors"
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm text-foreground">Floor {floor}</span>
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
