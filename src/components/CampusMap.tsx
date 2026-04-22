import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useFixtureStore } from '@/store/fixtureStore';

type BuildingCoord = { lng: number; lat: number };

// Pseudo-random but deterministic offset around Berkeley campus for buildings without DB coords.
function fallbackCoordFor(id: string): BuildingCoord {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const dx = ((h & 0xff) / 255 - 0.5) * 0.01;
  const dy = (((h >> 8) & 0xff) / 255 - 0.5) * 0.01;
  return { lng: -122.2585 + dx, lat: 37.8719 + dy };
}

export function CampusMap({ campusId }: { campusId: string | 'all' }) {
  const { buildings, getBuildingsByCampus, getFloorsByBuilding, userRole } = useFixtureStore();
  const isFacilities = userRole === 'Facilities';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  const scopedBuildings = useMemo(() => {
    if (campusId === 'all') return buildings;
    return getBuildingsByCampus(campusId);
  }, [campusId, buildings, getBuildingsByCampus]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-122.2585, 37.8719],
      zoom: 15,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const palette = {
      Done: '#22c55e',
      InProgress: '#f59e0b',
      NotStarted: '#e5e7eb',
      Restricted: '#ef4444',
    } as const;

    for (const b of scopedBuildings) {
      const floors = getFloorsByBuilding(b.id);
      const done = floors.filter((f) => f.status === 'Done' || f.status === 'Restricted').length;
      const started = floors.some((f) => f.status === 'InProgress' || f.status === 'Done' || f.status === 'Restricted');
      const restricted = floors.some((f) => f.status === 'Restricted');
      const status = restricted ? 'Restricted' : done === floors.length && floors.length > 0 ? 'Done' : started ? 'InProgress' : 'NotStarted';

      const coord = fallbackCoordFor(b.id);
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '999px';
      el.style.border = '2px solid rgba(0,0,0,0.15)';
      el.style.background = palette[status as keyof typeof palette];
      el.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([coord.lng, coord.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.2;">
              <div style="font-weight: 700; margin-bottom: 4px;">${b.name}</div>
              <div style="color: rgba(0,0,0,0.65);">Floors: ${b.floors}</div>
              <div style="margin-top: 6px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${palette[status as keyof typeof palette]}22;color:#111;font-weight:700;">${status}</span>
              </div>
            </div>`,
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [scopedBuildings, getFloorsByBuilding, isFacilities]);

  if (!token) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Campus map (Mapbox)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Set <code className="rounded bg-secondary px-1.5 py-0.5">VITE_MAPBOX_ACCESS_TOKEN</code> to enable the map.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full overflow-hidden rounded-2xl border" style={{ height: 420 }} />;
}

