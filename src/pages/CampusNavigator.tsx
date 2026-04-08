import { useState } from 'react';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Building2, ChevronRight, ChevronDown, Layers } from 'lucide-react';

export default function CampusNavigator() {
  const { buildings, getFixturesByBuilding, getFixturesByBuildingAndFloor } = useFixtureStore();
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-foreground">Campus Navigator</h1>
      <p className="text-sm text-muted-foreground">Browse fixtures by building & floor</p>

      <div className="mt-5 space-y-3">
        {buildings.map((b) => {
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
                  {Array.from({ length: b.floors }, (_, i) => i + 1).map((floor) => {
                    const floorKey = `${b.id}-${floor}`;
                    const floorOpen = expandedFloor === floorKey;
                    const floorFixtures = getFixturesByBuildingAndFloor(b.id, floor);

                    return (
                      <div key={floor}>
                        <button
                          onClick={() => setExpandedFloor(floorOpen ? null : floorKey)}
                          className="flex w-full items-center gap-2 py-2.5"
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm text-foreground">Floor {floor}</span>
                          <span className="text-xs text-muted-foreground">{floorFixtures.length}</span>
                          {floorOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        </button>
                        {floorOpen && (
                          <div className="ml-6 space-y-2 pb-2">
                            {floorFixtures.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No fixtures on this floor.</p>
                            ) : (
                              floorFixtures.map((f) => (
                                <div key={f.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                                  <div>
                                    <p className="text-sm font-medium text-secondary-foreground">Rm {f.roomNumber}</p>
                                    <p className="text-xs text-muted-foreground">{f.brand} {f.model} • {f.filterType}</p>
                                  </div>
                                  <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
