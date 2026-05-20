import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance, fixtureCategoryMeta } from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimpleRating } from '@/components/SimpleRating';
import { FIELD_LABELS, issueLabel } from '@/lib/fieldLabels';
import { MapPin, Wrench, CheckCircle2, Edit3, Save, X, ExternalLink, Image as ImageIcon, Hash, Tag, Download } from 'lucide-react';
import { toast } from 'sonner';

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
  const [pressure, setPressure] = useState(fixture?.qualityRating.pressure || 2);
  const [cleanliness, setCleanliness] = useState(fixture?.qualityRating.cleanliness || 2);
  const [observations, setObservations] = useState(fixture?.observations || '');

  const campus = fixture ? campuses.find((c) => c.id === fixture.campusId) : undefined;
  const building = fixture ? buildings.find((b) => b.id === fixture.buildingId) : undefined;

  const locationLabel = useMemo(() => {
    if (!fixture) return '';
    const parts: string[] = [];
    if (fixture.buildingName) parts.push(fixture.buildingName);
    if (campus?.school) parts.push(campus.school);
    if (campus?.name) parts.push(campus.name);
    if (campus?.address) parts.push(campus.address);
    return parts.filter(Boolean).join(', ');
  }, [campus?.address, campus?.name, campus?.school, fixture]);

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

  return (
    <div className="page-shell pb-8">
      <PageHeader
        title={fixture.buildingName}
        subtitle={`Floor ${fixture.floor} · Room ${fixture.roomNumber}`}
        onBack={() => navigate(-1)}
        action={<StatusBadge status={status} />}
      />

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
              <SimpleRating value={fixture.qualityRating.pressure} readonly />
            </div>
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground">Cleanliness</p>
              <SimpleRating value={fixture.qualityRating.cleanliness} readonly />
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
              <div className="grid grid-cols-2 gap-3">
                <PhotoCard label="General" url={fixture.photoURL} filename={`${fixture.id}-general.jpg`} />
                <PhotoCard label={FIELD_LABELS.modelLabel} url={fixture.modelPlatePhotoURL} filename={`${fixture.id}-plate.jpg`} />
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
          </div>

          <div className="p-4">
            {locationLabel ? (
              <div className="rounded-xl border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3 shrink-0" />
                  <span>{locationLabel}</span>
                </div>
                {campus?.address ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">{campus.address}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Update the campus address in Assets for more accurate directions.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">No location details</p>
                <p className="mt-1 text-[11px]">Add a campus address when onboarding this fixture.</p>
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
              <Field label={FIELD_LABELS.room} value={roomNumber} onChange={setRoomNumber} />
              <Field label="Nearest landmark" value={nearestRoom} onChange={setNearestRoom} />
              <Field label={FIELD_LABELS.companyName} value={brand} onChange={setBrand} />
              <Field label={FIELD_LABELS.model} value={model} onChange={setModel} />
              <Field label={FIELD_LABELS.productNumber} value={filterType} onChange={setFilterType} />
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
                <label className="text-xs font-medium text-muted-foreground">Water pressure</label>
                <SimpleRating value={pressure} onChange={setPressure} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cleanliness</label>
                <SimpleRating value={cleanliness} onChange={setCleanliness} />
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
                <InfoTile label={FIELD_LABELS.companyName} value={fixture.brand || '—'} />
                <InfoTile label={FIELD_LABELS.model} value={fixture.model || '—'} />
                <InfoTile label={FIELD_LABELS.serialNumber} value={fixture.serialNumber || '—'} />
                <InfoTile label={FIELD_LABELS.productNumber} value={fixture.filterType || '—'} />
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
                        {issueLabel(i)}
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

function PhotoCard({ label, url, filename }: { label: string; url: string; filename: string }) {
  if (!url) {
    return (
      <div className="h-40 rounded-xl border bg-secondary/30 flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
        <ImageIcon className="h-5 w-5 opacity-50" />
        <span>No {label.toLowerCase()}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={label} className="h-32 w-full object-cover" loading="lazy" />
      </a>
      <div className="flex items-center justify-between gap-2 p-2 border-t">
        <span className="text-[11px] font-medium text-foreground truncate">{label}</span>
        <div className="flex gap-1">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground"
            title="Open"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={url}
            download={filename}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background"
            title="Download"
          >
            <Download className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

