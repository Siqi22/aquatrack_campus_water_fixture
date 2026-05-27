import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { Fixture, FixtureCategory } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimpleRating, ratingLabel } from '@/components/SimpleRating';
import { FIELD_LABELS, ISSUE_OPTIONS, issueLabel } from '@/lib/fieldLabels';
import { uploadFixturePhoto } from '@/lib/uploadPhoto';
import {
  MapPin,
  CheckCircle2,
  Edit3,
  Save,
  X,
  ExternalLink,
  Image as ImageIcon,
  Hash,
  Download,
  Building2,
  GraduationCap,
  Camera,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function FixtureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campuses, buildings, getFixtureById, getBuildingsByCampus, updateFixture, completeService } =
    useFixtureStore();
  const fixture = getFixtureById(id || '');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [campusId, setCampusId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [nearestRoom, setNearestRoom] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [filterType, setFilterType] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [category, setCategory] = useState<FixtureCategory>('Other');
  const [pressure, setPressure] = useState(2);
  const [cleanliness, setCleanliness] = useState(2);
  const [observations, setObservations] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [photoURL, setPhotoURL] = useState('');
  const [modelPlatePhotoURL, setModelPlatePhotoURL] = useState('');

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const platePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const campusBuildings = useMemo(
    () => (campusId ? getBuildingsByCampus(campusId) : []),
    [campusId, getBuildingsByCampus],
  );
  const campus = fixture ? campuses.find((c) => c.id === (editing ? campusId : fixture.campusId)) : undefined;
  const building = buildings.find((b) => b.id === (editing ? buildingId : fixture?.buildingId));

  function resetFormFromFixture(source: Fixture) {
    setCampusId(source.campusId);
    setBuildingId(source.buildingId);
    setFloor(source.floor);
    setRoomNumber(source.roomNumber);
    setNearestRoom(source.nearestRoom || source.roomNumber);
    setBrand(source.brand);
    setModel(source.model);
    setSerialNumber(source.serialNumber);
    setFilterType(source.filterType);
    setInstallationDate(source.installationDate ?? '');
    setCategory(normalizeFixtureCategory(source.category));
    setPressure(source.qualityRating.pressure);
    setCleanliness(source.qualityRating.cleanliness);
    setObservations(source.observations || '');
    setIssues(source.issues ?? []);
    setPhotoURL(source.photoURL);
    setModelPlatePhotoURL(source.modelPlatePhotoURL);
  }

  useEffect(() => {
    if (!fixture) return;
    resetFormFromFixture(fixture);
  }, [fixture?.id]);

  useEffect(() => {
    if (!editing || !buildingId) return;
    if (!campusBuildings.some((b) => b.id === buildingId)) {
      setBuildingId(campusBuildings[0]?.id ?? '');
    }
  }, [editing, campusId, campusBuildings, buildingId]);

  if (!fixture) {
    return (
      <div className="page-shell pt-6 text-center">
        <p className="text-muted-foreground">Fixture not found.</p>
        <button onClick={() => navigate(-1)} className="link-action mt-4 text-sm">
          Go back
        </button>
      </div>
    );
  }

  const status = getFixtureStatus(fixture.lastMaintenanceDate);
  const days = getDaysSinceMaintenance(fixture.lastMaintenanceDate);
  const remaining = Math.max(0, 180 - days);

  function handleFileUpload(file: File, setter: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setter(result);
    };
    reader.readAsDataURL(file);
  }

  function handleCancelEdit() {
    resetFormFromFixture(fixture);
    setEditing(false);
  }

  async function handleSave() {
    const trimmedRoom = (nearestRoom || roomNumber).trim();
    if (!campusId || !buildingId || !floor.trim() || trimmedRoom.length < 2) {
      toast.error('Campus, building, floor, and room (min 2 chars) are required.');
      return;
    }

    setSaving(true);
    try {
      const [nextPhotoURL, nextPlateURL] = await Promise.all([
        photoURL.startsWith('data:') ? uploadFixturePhoto(photoURL, 'general') : Promise.resolve(photoURL),
        modelPlatePhotoURL.startsWith('data:')
          ? uploadFixturePhoto(modelPlatePhotoURL, 'plate')
          : Promise.resolve(modelPlatePhotoURL),
      ]);

      const photosProvided: string[] = [];
      if (nextPhotoURL) photosProvided.push('general');
      if (nextPlateURL) photosProvided.push('plate');

      await updateFixture({
        ...fixture,
        campusId,
        buildingId,
        floor: floor.trim(),
        roomNumber: trimmedRoom,
        nearestRoom: trimmedRoom,
        brand,
        model,
        serialNumber,
        filterType,
        installationDate: installationDate || undefined,
        category,
        qualityRating: { pressure, cleanliness },
        observations: observations.trim() || undefined,
        issues: issues.length ? issues : undefined,
        photoURL: nextPhotoURL,
        modelPlatePhotoURL: nextPlateURL,
        photosProvided,
        locationConfirmed: true,
      });
      setEditing(false);
      toast.success('Fixture updated');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not save fixture');
    } finally {
      setSaving(false);
    }
  }

  function handleComplete() {
    completeService(fixture.id);
    toast.success('Service completed — timer reset!');
  }

  const displayPhotoURL = editing ? photoURL : fixture.photoURL;
  const displayPlateURL = editing ? modelPlatePhotoURL : fixture.modelPlatePhotoURL;
  const displayCampus = editing ? campuses.find((c) => c.id === campusId) : campus;
  const displayBuilding = editing ? buildings.find((b) => b.id === buildingId) : building;
  const displayFloor = editing ? floor : fixture.floor;
  const displayRoom = editing ? nearestRoom || roomNumber : fixture.nearestRoom || fixture.roomNumber;
  const fixtureIdentity = editing
    ? [brand, model].filter(Boolean).join(' · ')
    : [fixture.brand, fixture.model].filter(Boolean).join(' · ');

  return (
    <div className="page-shell pb-8">
      <PageHeader
        title={editing ? displayBuilding?.name || fixture.buildingName : fixture.buildingName}
        subtitle={`Floor ${displayFloor} · Room ${displayRoom}`}
        onBack={() => navigate(-1)}
        action={
          editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="link-action"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              <button type="button" onClick={() => setEditing(true)} className="link-action">
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            </div>
          )
        }
      />

      <div className="card-soft p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {editing ? fixtureCategoryMeta[category].label : getFixtureCategoryLabel(fixture.category)}
            </p>
            {fixtureIdentity ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{fixtureIdentity}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
              <MapPin className="h-3 w-3" />
              F{displayFloor} · Rm {displayRoom}
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
                <span className="font-semibold text-foreground">
                  {ratingLabel(editing ? pressure : fixture.qualityRating.pressure)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cleanliness</span>
                <span className="font-semibold text-foreground">
                  {ratingLabel(editing ? cleanliness : fixture.qualityRating.cleanliness)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="card-section mb-4">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
            </div>
          </div>

          <div className="panel-body">
            {editing ? (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setPhotoURL);
                    e.currentTarget.value = '';
                  }}
                />
                <input
                  ref={platePhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, setModelPlatePhotoURL);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <PhotoEditor
                    label={FIELD_LABELS.generalPhoto}
                    url={photoURL}
                    emptyIcon={Camera}
                    onUpload={() => photoInputRef.current?.click()}
                    onRemove={() => setPhotoURL('')}
                  />
                  <PhotoEditor
                    label={FIELD_LABELS.modelLabel}
                    url={modelPlatePhotoURL}
                    emptyIcon={ImagePlus}
                    onUpload={() => platePhotoInputRef.current?.click()}
                    onRemove={() => setModelPlatePhotoURL('')}
                  />
                </div>
              </>
            ) : displayPhotoURL || displayPlateURL ? (
              <div className="grid grid-cols-2 gap-3">
                <PhotoCard label="General" url={displayPhotoURL} filename={`${fixture.id}-general.jpg`} />
                <PhotoCard
                  label={FIELD_LABELS.modelLabel}
                  url={displayPlateURL}
                  filename={`${fixture.id}-plate.jpg`}
                />
              </div>
            ) : (
              <div className="rounded-xl border bg-secondary/30 p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">No photos attached</p>
                <p className="mt-1 text-[11px]">Tap Edit to upload fixture photos.</p>
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
            {editing ? (
              <div className="space-y-3">
                <Field label="Campus" as="select" value={campusId} onChange={setCampusId}>
                  <option value="">Select campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.school} — {c.name}
                    </option>
                  ))}
                </Field>
                <Field label="Building" as="select" value={buildingId} onChange={setBuildingId} disabled={!campusId}>
                  <option value="">Select building</option>
                  {campusBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={FIELD_LABELS.floor} value={floor} onChange={setFloor} />
                  <Field label={FIELD_LABELS.room} value={nearestRoom} onChange={setNearestRoom} />
                </div>
              </div>
            ) : displayCampus || displayBuilding ? (
              <div className="space-y-3">
                {displayBuilding ? (
                  <div className="flex items-start gap-3 rounded-xl border bg-secondary/20 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Building</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{displayBuilding.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{displayBuilding.floors} floors</p>
                    </div>
                  </div>
                ) : null}

                {displayCampus ? (
                  <div className="flex items-start gap-3 rounded-xl border bg-secondary/20 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Campus</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{displayCampus.name}</p>
                      {displayCampus.school ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{displayCampus.school}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Floor</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{displayFloor}</p>
                  </div>
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Room</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{displayRoom}</p>
                  </div>
                </div>

                {displayCampus?.address ? (
                  <div className="rounded-xl border bg-card/70 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Address</p>
                    <p className="mt-1 text-sm leading-snug text-foreground">{displayCampus.address}</p>
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
                <p className="mt-1 text-[11px]">Tap Edit to set campus, building, floor, and room.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 mb-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Fixture Details</h2>
        </div>

        <div className="space-y-3">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={FIELD_LABELS.companyName} value={brand} onChange={setBrand} />
                <Field label={FIELD_LABELS.model} value={model} onChange={setModel} />
                <Field label={FIELD_LABELS.serialNumber} value={serialNumber} onChange={setSerialNumber} />
                <Field label={FIELD_LABELS.productNumber} value={filterType} onChange={setFilterType} />
              </div>
              <Field
                label="Installation date"
                type="date"
                value={installationDate}
                onChange={setInstallationDate}
              />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fountain type</label>
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
                <label className="text-xs font-medium text-muted-foreground">Quick issues</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ISSUE_OPTIONS.map(({ id: issueId, label }) => {
                    const active = issues.includes(issueId);
                    return (
                      <button
                        key={issueId}
                        type="button"
                        onClick={() =>
                          setIssues((prev) =>
                            active ? prev.filter((item) => item !== issueId) : [...prev, issueId],
                          )
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
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
                <InfoTile label="Installation date" value={fixture.installationDate || '—'} />
              </div>
              {fixture.issues?.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Issues</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fixture.issues.map((issue) => (
                      <span
                        key={issue}
                        className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground"
                      >
                        {issueLabel(issue)}
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

      {!editing ? (
        <button onClick={handleComplete} className="btn-cta">
          <CheckCircle2 className="h-5 w-5" />
          Complete Maintenance
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  as,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  as?: 'select';
  disabled?: boolean;
  children?: ReactNode;
}) {
  if (as === 'select') {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full field-input"
        >
          {children}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full field-input"
      />
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

function PhotoEditor({
  label,
  url,
  emptyIcon: EmptyIcon,
  onUpload,
  onRemove,
}: {
  label: string;
  url: string;
  emptyIcon: typeof Camera;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed p-3">
      {url ? (
        <>
          <img src={url} alt={label} className="h-24 w-full rounded-lg object-cover" />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onUpload}
              className="flex-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onUpload}
          className="flex w-full flex-col items-center gap-1.5 py-3 text-muted-foreground"
        >
          <EmptyIcon className="h-6 w-6" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      )}
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
