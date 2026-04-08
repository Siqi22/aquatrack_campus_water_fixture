import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, getDaysSinceMaintenance } from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { StatusBadge } from '@/components/StatusBadge';
import { StarRating } from '@/components/StarRating';
import { ChevronLeft, MapPin, Wrench, Clock, CheckCircle2, Edit3, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function FixtureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFixtureById, updateFixture, completeService } = useFixtureStore();
  const fixture = getFixtureById(id || '');
  const [editing, setEditing] = useState(false);

  const [roomNumber, setRoomNumber] = useState(fixture?.roomNumber || '');
  const [brand, setBrand] = useState(fixture?.brand || '');
  const [model, setModel] = useState(fixture?.model || '');
  const [filterType, setFilterType] = useState(fixture?.filterType || '');
  const [category, setCategory] = useState<FixtureCategory>(fixture?.category || 'Public');
  const [pressure, setPressure] = useState(fixture?.qualityRating.pressure || 3);
  const [cleanliness, setCleanliness] = useState(fixture?.qualityRating.cleanliness || 3);

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
      brand,
      model,
      filterType,
      category,
      qualityRating: { pressure, cleanliness },
    });
    setEditing(false);
    toast.success('Fixture updated');
  }

  function handleComplete() {
    completeService(fixture.id);
    toast.success('Service completed — timer reset!');
  }

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

      {/* Maintenance Progress */}
      <div className="rounded-2xl border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Filter Life</span>
          <span className="text-xs font-semibold text-foreground">
            {remaining > 0 ? `${remaining} days left` : `${Math.abs(remaining)} days overdue`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'Good' ? 'bg-status-good' : status === 'Warning' ? 'bg-status-warning' : 'bg-status-urgent'
            }`}
            style={{ width: `${Math.min(100, (days / 180) * 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last: {fixture.lastMaintenanceDate}</span>
          <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {fixture.filterType}</span>
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
              <Field label="Brand" value={brand} onChange={setBrand} />
              <Field label="Model" value={model} onChange={setModel} />
              <Field label="Filter Type" value={filterType} onChange={setFilterType} />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <div className="flex gap-2 mt-1">
                  {(['Public', 'Private'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                        category === c ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pressure Rating</label>
                <StarRating value={pressure} onChange={setPressure} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cleanliness Rating</label>
                <StarRating value={cleanliness} onChange={setCleanliness} />
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Brand" value={fixture.brand} />
              <InfoRow label="Model" value={fixture.model} />
              <InfoRow label="Serial Number" value={fixture.serialNumber} />
              <InfoRow label="Filter Type" value={fixture.filterType} />
              <InfoRow label="Category" value={fixture.category} />
              <InfoRow label="Installation Date" value={fixture.installationDate} />
              <div>
                <span className="text-xs text-muted-foreground">Pressure</span>
                <StarRating value={fixture.qualityRating.pressure} readonly />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Cleanliness</span>
                <StarRating value={fixture.qualityRating.cleanliness} readonly />
              </div>
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
