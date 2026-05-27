import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useFixtureStore,
  getFixtureStatus,
  getDaysSinceMaintenance,
  fixtureCategoryMeta,
  FIXTURE_CATEGORIES,
  normalizeFixtureCategory,
  getFixtureCategoryLabel,
} from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimpleRating, ratingLabel } from '@/components/SimpleRating';
import { FIELD_LABELS, issueLabel } from '@/lib/fieldLabels';
import { MapPin, CheckCircle2, Edit3, Save, X, ExternalLink, Image as ImageIcon, Hash, Download, Building2, GraduationCap } from 'lucide-react';
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
  const [category, setCategory] = useState<FixtureCategory>(() =>
    normalizeFixtureCategory(fixture?.category),
  );
  const [pressure, setPressure] = useState(fixture?.qualityRating.pressure || 2);
  const [cleanliness, setCleanliness] = useState(fixture?.qualityRating.cleanliness || 2);
  const [observations, setObservations] = useState(fixture?.observations || '');

  const campus = fixture ? campuses.find((c) => c.id === fixture.campusId) : undefined;
  const building = fixture ? buildings.find((b) => b.id === fixture.buildingId) : undefined;

  if (!fixture) {
    return (
      <div className="page-shell pt-6 text-center">
        <p className="text-muted-foreground">Fixture not found.</p>
        <button onClick={() => navigate(-1)} className="link-action mt-4 text-sm">Go back</button>
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
              {getFixtureCategoryLabel(fixture.category)}
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
            <p className="text-[10px] font-medium text-muted-foreground">Condition</p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Pressure</span>
                <span className="font-semibold text-foreground">{ratingLabel(fixture.qualityRating.pressure)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cleanliness</span>
                <span className="font-semibold text-foreground">{ratingLabel(fixture.qualityRating.cleanliness)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photos + location */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="card-section mb-4">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
            </div>
          </div>

          <div className="panel-body">
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

        <div className="card-section mb-4">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Location</h2>
            </div>
          </div>

          <div className="panel-body">
            {fixture.buildingName || campus ? (
              <div className="space-y-3">
                {fixture.buildingName ? (
                  <div className="flex items-start gap-3 rounded-xl border bg-secondary/20 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Building</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{fixture.buildingName}</p>
                      {building ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{building.floors} floors</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {campus ? (
                  <div className="flex items-start gap-3 rounded-xl border bg-secondary/20 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Campus</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{campus.name}</p>
                      {campus.school ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{campus.school}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Floor</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{fixture.floor}</p>
                  </div>
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Room</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{fixture.roomNumber}</p>
                  </div>
                </div>

                {campus?.address ? (
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Address</p>
                    <p className="mt-1 text-sm leading-snug text-foreground">{campus.address}</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Add a campus address in Assets for more accurate directions.
                  </p>
                )}
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
            <button onClick={() => setEditing(true)} className="link-action">
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-muted-foreground">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button onClick={handleSave} className="link-action">
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
                  className="mt-1 w-full field-input"
                >
                  {FIXTURE_CATEGORIES.map((id) => (
                    <option key={id} value={id}>
                      {fixtureCategoryMeta[id].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Water pressure</label>
                  <SimpleRating compact value={pressure} onChange={setPressure} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cleanliness</label>
                  <SimpleRating compact value={cleanliness} onChange={setCleanliness} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Observations</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="mt-1 w-full field-textarea"
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
                <InfoTile label="Fountain type" value={getFixtureCategoryLabel(fixture.category)} />
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
        className="btn-cta"
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
        className="mt-1 w-full field-input"
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
    <div className="info-tile">
      <p className="info-tile-label">{label}</p>
      <p className="info-tile-value">{value}</p>
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

