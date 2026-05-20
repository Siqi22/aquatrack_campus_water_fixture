import { useState } from 'react';
import { useFixtureStore } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { FLOOR_STATUS_LABELS } from '@/lib/fieldLabels';
import { Building2, ChevronRight, ChevronDown, Layers, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CampusNavigator() {
  const { campuses, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus, getFloorsByBuilding } = useFixtureStore();
  const navigate = useNavigate();
  const [selectedCampus, setSelectedCampus] = useState<string>(campuses[0]?.id || '');
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: string } | null>(null);

  const campusBuildings = selectedCampus ? getBuildingsByCampus(selectedCampus) : [];
  const campusFixtureCount = selectedCampus ? getFixturesByCampus(selectedCampus).length : 0;
  const currentCampus = campuses.find(c => c.id === selectedCampus);

  const floorBadge: Record<string, string> = {
    NotStarted: 'bg-secondary text-secondary-foreground',
    InProgress: 'bg-status-warning/15 text-status-warning',
    Done: 'bg-status-good/15 text-status-good',
    Restricted: 'bg-status-urgent/15 text-status-urgent',
  };

  return (
    <div className="px-4 pt-6 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Campus Navigator</h1>
        <p className="text-sm text-muted-foreground">
          Browse buildings and floors — track survey progress as you go
        </p>
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

      {currentCampus && (
        <div className="mt-3 rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">{currentCampus.school}</p>
          <p className="text-xs text-muted-foreground">{currentCampus.address || 'No address on file'}</p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-muted-foreground">{campusBuildings.length} buildings</span>
            <span className="text-xs text-muted-foreground">{campusFixtureCount} fixtures</span>
          </div>
        </div>
      )}

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
            campusId={selectedCampus}
          />
        </div>
      )}

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
              const floors = getFloorsByBuilding(b.id);
              const doneCount = floors.filter((f) => f.status === 'Done' || f.status === 'Restricted').length;
              const progressPct = floors.length ? Math.round((doneCount / floors.length) * 100) : 0;
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
                        {b.floors} floors • {fixtureCount} fixtures • {progressPct}% surveyed
                      </p>
                      <div className="mt-1.5 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-status-good/70" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {!isOpen && hasNotStarted && firstNotStarted && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => navigate(`/add?mode=onboard&campusId=${encodeURIComponent(selectedCampus)}&buildingId=${encodeURIComponent(b.id)}&floor=${encodeURIComponent(firstNotStarted)}`)}
                        className="w-full rounded-2xl bg-foreground py-2.5 text-xs font-semibold text-background"
                      >
                        Continue survey — Floor {firstNotStarted}
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
                            fp.status === 'NotStarted' ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-secondary/30'
                          }`}
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm text-foreground">Floor {fp.floor}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${floorBadge[fp.status]}`}>
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
      )}
    </div>
  );
}
