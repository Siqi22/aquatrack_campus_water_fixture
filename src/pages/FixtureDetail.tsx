import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance, fixtureCategoryMeta } from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { StarRating } from '@/components/StarRating';
import { ChevronLeft, MapPin, Wrench, Clock, CheckCircle2, Edit3, Save, X, ExternalLink, Image as ImageIcon, Hash, Tag } from 'lucide-react';
import { toast } from 'sonner';

type MapboxFeature = {
  id: string;
  place_name: string;
  text: string;
  center?: [number, number];
};

async function mapboxForwardGeocode(args: { token: string; query: string; limit?: number; types?: string }) {
  const limit = args.limit ?? 1;
  const types = args.types ?? 'poi,address,place,locality';
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(args.query)}.json`);
  url.searchParams.set('access_token', args.token);
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('types', types);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mapbox geocoding failed: ${res.status}`);
  const data: unknown = await res.json();
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const f = features[0] as MapboxFeature;
  if (!f || typeof f !== 'object') return null;
  return f;
}

export default function FixtureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campuses, buildings, getFixtureById, updateFixture, completeService } = useFixtureStore();
  const fixture = getFixtureById(id || '');
  const [editing, setEditing] = useState(false);

  const [roomNumber, setRoomNumber] = useState(fixture?.roomNumber || '');
  const [nearestRoom, setNearestRoom] = useState(fixture?.nearestRoom || fixture?.roomNumber || '');
  const [brand, setBrand] = useState(fixture?.brand || '');
  const [model, setModel] = useState(fixture?.model || '');
  const [filterType, setFilterType] = useState(fixture?.filterType || '');
  const [category, setCategory] = useState<FixtureCategory>(fixture?.category || 'Other');
  const [pressure, setPressure] = useState(fixture?.qualityRating.pressure || 3);
  const [cleanliness, setCleanliness] = useState(fixture?.qualityRating.cleanliness || 3);
  const [observations, setObservations] = useState(fixture?.observations || '');

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const [geoFeature, setGeoFeature] = useState<MapboxFeature | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  if (!fixture) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-muted-foreground">Fixture not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-accent">Go back</button>
      </div>
    );
  }

  const status = getFixtureStatus(fixture.lastMaintenanceDate);
  const days = getDaysSinceMaintenance(fixture.lastMaintenanceDate);
  const remaining = Math.max(0, 180 - days);
  const campus = campuses.find((c) => c.id === fixture.campusId);
  const building = buildings.find((b) => b.id === fixture.buildingId);

  const geoQuery = useMemo(() => {
    const parts: string[] = [];
    if (fixture.buildingName) parts.push(fixture.buildingName);
    if (campus?.school) parts.push(campus.school);
    if (campus?.name) parts.push(campus.name);
    if (campus?.address) parts.push(campus.address);
    return parts.filter(Boolean).join(', ');
  }, [campus?.address, campus?.name, campus?.school, fixture.buildingName]);

  useEffect(() => {
    if (!mapboxToken) {
      setGeoFeature(null);
      return;
    }
    if (!geoQuery.trim()) {
      setGeoFeature(null);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    mapboxForwardGeocode({ token: mapboxToken, query: geoQuery, limit: 1, types: 'poi,address,place,locality' })
      .then((f) => {
        if (!cancelled) setGeoFeature(f);
      })
      .catch(() => {
        if (!cancelled) setGeoFeature(null);
      })
      .finally(() => {
        if (!cancelled) setGeoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geoQuery, mapboxToken]);

  function handleSave() {
    updateFixture({
      ...fixture,
      roomNumber,
      nearestRoom,
      brand,
      model,
      filterType,
      category,
      qualityRating: { pressure, cleanliness },
      observations: observations || undefined,
    });
    setEditing(false);
    toast.success('Fixture updated');
  }

  function handleComplete() {
    completeService(fixture.id);
    toast.success('Service completed — timer reset!');
  }

  const mapCenter = geoFeature?.center;
  const mapImgUrl =
    mapboxToken && mapCenter
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+0ea5e9(${mapCenter[0]},${mapCenter[1]})/${mapCenter[0]},${mapCenter[1]},16/800x450@2x?access_token=${encodeURIComponent(
          mapboxToken,
        )}`
      : null;

  const externalMapUrl =
    mapCenter && mapCenter.length === 2
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${mapCenter[1]},${mapCenter[0]}`)}`
      : null;

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 hover:bg-secondary">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{fixture.buildingName}</h1>
          <p className="text-xs text-muted-foreground">Floor {fixture.floor} • Room {fixture.roomNumber}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Quick summary */}
      <div className="card-soft p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {fixtureCategoryMeta[fixture.category]?.label ?? fixture.category}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {campus ? `${campus.school} • ${campus.name}` : 'Campus'}
              {building ? ` • ${building.floors} floors` : ''}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
              <MapPin className="h-3 w-3" />
              F{fixture.floor} · Rm {fixture.roomNumber}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
              <Hash className="h-3 w-3" />
              {fixture.id}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-card/70 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">Last service</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{fixture.lastMaintenanceDate}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{days} days ago</p>
          </div>
          <div className="rounded-xl border bg-card/70 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">Filter life</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {remaining > 0 ? `${remaining} left` : `${Math.abs(remaining)} overdue`}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  status === 'Good' ? 'bg-status-good' : status === 'Warning' ? 'bg-status-warning' : 'bg-status-urgent'
                }`}
                style={{ width: `${Math.min(100, (days / 180) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl border bg-card/70 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">Ratings</p>
            <div className="mt-1">
              <p className="text-[11px] text-muted-foreground">Pressure</p>
              <StarRating value={fixture.qualityRating.pressure} readonly />
            </div>
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground">Cleanliness</p>
              <StarRating value={fixture.qualityRating.cleanliness} readonly />
            </div>
          </div>
        </div>
      </div>

      {/* Photos + location */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
            </div>
          </div>

          <div className="p-4">
            {fixture.photoURL || fixture.modelPlatePhotoURL ? (
              <div className="grid grid-cols-2 gap-2">
                {fixture.photoURL ? (
                  <img
                    src={fixture.photoURL}
                    alt="Fixture"
                    className="h-36 w-full rounded-xl object-cover border"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-36 rounded-xl border bg-secondary/30 flex items-center justify-center text-muted-foreground text-xs">
                    No general photo
                  </div>
                )}
                {fixture.modelPlatePhotoURL ? (
                  <img
                    src={fixture.modelPlatePhotoURL}
                    alt="Model plate"
                    className="h-36 w-full rounded-xl object-cover border"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-36 rounded-xl border bg-secondary/30 flex items-center justify-center text-muted-foreground text-xs">
                    No model plate
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">No photos attached</p>
                <p className="mt-1 text-[11px]">Add photos from the Assets flow for faster identification.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Location</h2>
            </div>
            {externalMapUrl ? (
              <a
                href={externalMapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-accent font-medium"
              >
                Open map <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          <div className="p-4">
            {!mapboxToken ? (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">Map disabled</p>
                <p className="mt-1 text-[11px]">
                  Set <code className="rounded bg-secondary px-1.5 py-0.5">VITE_MAPBOX_ACCESS_TOKEN</code> to enable location.
                </p>
              </div>
            ) : geoLoading ? (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">Locating…</p>
                <p className="mt-1 text-[11px]">Searching by building + campus.</p>
              </div>
            ) : mapImgUrl ? (
              <>
                <img src={mapImgUrl} alt="Map" className="h-44 w-full rounded-xl border object-cover" loading="lazy" />
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span className="truncate">{geoFeature?.place_name ?? geoQuery}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Hint: if this is off, update the campus address for better accuracy.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">No map match</p>
                <p className="mt-1 text-[11px]">We couldn’t resolve an address for this campus/building yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Fixture Details</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-accent font-medium">
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-muted-foreground">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-1 text-xs text-accent font-medium">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {editing ? (
            <>
              <Field label="Room Number" value={roomNumber} onChange={setRoomNumber} />
              <Field label="Nearest Room / Landmark" value={nearestRoom} onChange={setNearestRoom} />
              <Field label="Brand" value={brand} onChange={setBrand} />
              <Field label="Model" value={model} onChange={setModel} />
              <Field label="Filter Type" value={filterType} onChange={setFilterType} />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FixtureCategory)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {(Object.keys(fixtureCategoryMeta) as FixtureCategory[]).map((id) => (
                    <option key={id} value={id}>
                      {fixtureCategoryMeta[id].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pressure Rating</label>
                <StarRating value={pressure} onChange={setPressure} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cleanliness Rating</label>
                <StarRating value={cleanliness} onChange={setCleanliness} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Observations</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="mt-1 w-full min-h-[90px] rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="e.g. rusted fixture, low pressure, noisy..."
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Brand" value={fixture.brand || '—'} />
                <InfoTile label="Model" value={fixture.model || '—'} />
                <InfoTile label="Serial" value={fixture.serialNumber || '—'} />
                <InfoTile label="Filter" value={fixture.filterType || '—'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Category" value={fixtureCategoryMeta[fixture.category]?.label ?? fixture.category} />
                <InfoTile label="Nearest landmark" value={fixture.nearestRoom || fixture.roomNumber || '—'} />
              </div>
              {fixture.issues?.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Issues</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fixture.issues.map((i) => (
                      <span key={i} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {fixture.observations ? (
                <div className="rounded-xl border bg-secondary/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Observations</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{fixture.observations}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Complete Service */}
      <button
        onClick={handleComplete}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground"
      >
        <CheckCircle2 className="h-5 w-5" />
        Complete Maintenance
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}
