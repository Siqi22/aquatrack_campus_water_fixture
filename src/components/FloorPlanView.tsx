import { useFixtureStore, getFixtureStatus } from '@/store/fixtureStore';
import type { Fixture, FixtureStatus } from '@/store/fixtureStore';
import { Link } from 'react-router-dom';
import { Droplets } from 'lucide-react';

const statusColors: Record<FixtureStatus, string> = {
  Good: 'bg-status-good',
  Warning: 'bg-status-warning',
  Urgent: 'bg-status-urgent',
};

const statusRing: Record<FixtureStatus, string> = {
  Good: 'ring-status-good/30',
  Warning: 'ring-status-warning/30',
  Urgent: 'ring-status-urgent/30',
};

interface FloorPlanViewProps {
  buildingId: string;
  floor: number;
  buildingName: string;
}

export function FloorPlanView({ buildingId, floor, buildingName }: FloorPlanViewProps) {
  const { getFixturesByBuildingAndFloor } = useFixtureStore();
  const fixtures = getFixturesByBuildingAndFloor(buildingId, floor);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-secondary/30">
        <p className="text-xs font-semibold text-foreground">{buildingName} — Floor {floor}</p>
        <p className="text-[10px] text-muted-foreground">{fixtures.length} fixtures</p>
      </div>

      {/* Floor plan grid */}
      <div className="relative w-full aspect-[16/10] bg-secondary/20">
        {/* Grid lines for floor plan feel */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`grid-${buildingId}-${floor}`} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${buildingId}-${floor})`} />
          {/* Room outlines */}
          <rect x="5%" y="5%" width="40%" height="42%" rx="4" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 2" />
          <rect x="50%" y="5%" width="45%" height="42%" rx="4" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 2" />
          <rect x="5%" y="53%" width="55%" height="42%" rx="4" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 2" />
          <rect x="65%" y="53%" width="30%" height="42%" rx="4" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Corridor */}
          <line x1="48%" y1="0" x2="48%" y2="100%" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.3" />
        </svg>

        {/* Fixture markers */}
        {fixtures.map((f) => {
          const status = getFixtureStatus(f.lastMaintenanceDate);
          const x = f.posX ?? 50;
          const y = f.posY ?? 50;

          return (
            <Link
              key={f.id}
              to={`/fixture/${f.id}`}
              className={`absolute flex items-center justify-center w-8 h-8 -ml-4 -mt-4 rounded-full ring-4 ${statusColors[status]} ${statusRing[status]} shadow-lg transition-transform hover:scale-125 z-10`}
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`Rm ${f.roomNumber} — ${f.brand} ${f.model}`}
            >
              <Droplets className="h-3.5 w-3.5 text-white" />
            </Link>
          );
        })}

        {fixtures.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No fixtures on this floor</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-secondary/20">
        {(['Good', 'Warning', 'Urgent'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[s]}`} />
            <span className="text-[10px] text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
