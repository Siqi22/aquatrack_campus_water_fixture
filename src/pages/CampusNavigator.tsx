import { useState } from 'react';
import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { FloorPlanView } from '@/components/FloorPlanView';
import { Building2, ChevronRight, ChevronDown, Layers, Map } from 'lucide-react';

export default function CampusNavigator() {
  const { buildings, getFixturesByBuilding } = useFixtureStore();
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Campus Navigator</h1>
          <p className="text-sm text-muted-foreground">Browse fixtures by building & floor</p>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
        >
          {viewMode === 'list' ? <Map className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
          {viewMode === 'list' ? 'Floor Plan' : 'List View'}
        </button>
      </div>

      {/* Floor plan view */}
      {selectedFloor && viewMode === 'map' && (
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
            buildingName={buildings.find(b => b.id === selectedFloor.buildingId)?.name || ''}
          />
        </div>
      )}

      {/* Building list */}
      {(!selectedFloor || viewMode === 'list') && (
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
                    {Array.from({ length: b.floors }, (_, i) => i + 1).map((floor) => (
                      <button
                        key={floor}
                        onClick={() => {
                          if (viewMode === 'map') {
                            setSelectedFloor({ buildingId: b.id, floor });
                          }
                        }}
                        className="flex w-full items-center gap-2 py-2.5 hover:bg-secondary/30 rounded-lg px-2 transition-colors"
                      >
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left text-sm text-foreground">Floor {floor}</span>
                        {viewMode === 'map' && <Map className="h-3 w-3 text-accent" />}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
