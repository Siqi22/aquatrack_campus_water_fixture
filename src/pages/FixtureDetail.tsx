import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFixtureStore } from '@/store/fixtureStore';
import type { Fixture } from '@/store/fixtureStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { FIELD_LABELS } from '@/lib/fieldLabels';
import {
  MapPin,
  Edit3,
  Save,
  X,
  Building2,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { LeadTestingPanel } from '@/components/LeadTestingPanel';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatFloorLabel } from '@/lib/floorUtils';

export default function FixtureDetail() {
  const { isSchoolDistrict, locationLabel } = useOrganization();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campuses, buildings, getFixtureById, getBuildingsByCampus, updateFixture } =
    useFixtureStore();
  const fixture = getFixtureById(id || '');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [campusId, setCampusId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [nearestRoom, setNearestRoom] = useState('');

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
  }

  useEffect(() => {
    if (!fixture) return;
    resetFormFromFixture(fixture);
  }, [fixture]);

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
      await updateFixture({
        ...fixture,
        campusId,
        buildingId,
        floor: floor.trim(),
        roomNumber: trimmedRoom,
        nearestRoom: trimmedRoom,
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

  const displayCampus = editing ? campuses.find((c) => c.id === campusId) : campus;
  const displayBuilding = editing ? buildings.find((b) => b.id === buildingId) : building;
  const displayFloor = editing ? floor : fixture.floor;
  const displayRoom = editing ? nearestRoom || roomNumber : fixture.nearestRoom || fixture.roomNumber;
  return (
    <div className="page-shell pb-8">
      <PageHeader
        title={editing ? displayBuilding?.name || fixture.buildingName : fixture.buildingName}
        subtitle={`${formatFloorLabel(displayFloor)} · Room ${displayRoom}`}
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
              <button type="button" onClick={() => setEditing(true)} className="link-action">
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 mb-4">
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
                <Field label={locationLabel} as="select" value={campusId} onChange={setCampusId}>
                  <option value="">Select {locationLabel.toLowerCase()}</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isSchoolDistrict ? c.school : c.name}
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
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{locationLabel}</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{isSchoolDistrict ? displayCampus.school : displayCampus.name}</p>
                      {isSchoolDistrict && displayCampus.schoolDistrict ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{displayCampus.schoolDistrict}</p>
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

      {!editing ? <LeadTestingPanel fixture={fixture} /> : null}
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
