import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useFixtureStore,
  getFixtureStatus,
  fixtureCategoryMeta,
  FIXTURE_CATEGORIES,
  normalizeFixtureCategory,
} from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { Camera, ScanLine, CheckCircle2, Building2, ChevronLeft, ChevronRight, ImagePlus, PlusCircle, ListChecks, Search, Map, MessageSquareWarning, University, Info, X, FileSpreadsheet, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SimpleRating } from '@/components/SimpleRating';
import { StatusBadge } from '@/components/StatusBadge';
import { FloorPlanView } from '@/components/FloorPlanView';
import { FIELD_LABELS, NO_LABEL_REASONS, ISSUE_OPTIONS } from '@/lib/fieldLabels';
import { scanFixtureLabelFromPhoto } from '@/lib/scanFixtureLabel';

type Mode = 'choose' | 'onboard' | 'manage';
type ManageFilter = 'all' | 'urgent';

function needsReview(fixture: { qualityRating: { pressure: number; cleanliness: number }; issues?: string[]; observations?: string }) {
  return (
    fixture.qualityRating.pressure <= 1 ||
    fixture.qualityRating.cleanliness <= 1 ||
    !!fixture.issues?.length ||
    !!fixture.observations?.trim()
  );
}

function fuzzyIncludes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

import { supabase } from '@/integrations/supabase/client';
import { uploadFixturePhoto } from '@/lib/uploadPhoto';
import { toast } from 'sonner';

export default function AddAsset() {
  const { campuses, buildings, fixtures, addCampus, addBuilding, addFixture, searchFixtures, getBuildingsByCampus, getFixturesByCampus, setFloorStatus, getFloorProgress } = useFixtureStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('choose');

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const platePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Manage state
  const [manageQuery, setManageQuery] = useState('');
  const [manageCampus, setManageCampus] = useState<string>(campuses[0]?.id || '');
  const [manageBuilding, setManageBuilding] = useState<string>('');
  const [manageFloor, setManageFloor] = useState<string | null>(null);
  const [manageFilter, setManageFilter] = useState<ManageFilter>('all');

  // Onboard state
  const [step, setStep] = useState(1);
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingFloors, setNewBuildingFloors] = useState('');
  const [floor, setFloor] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [platePhoto, setPlatePhoto] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [filterType, setFilterType] = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ brand: string; model: string; serialNumber: string; filterType: string; category: string; confidence: number } | null>(null);
  const [noLabel, setNoLabel] = useState(false);
  const [noLabelReason, setNoLabelReason] = useState('');
  const [noLabelReasonOther, setNoLabelReasonOther] = useState('');
  const [nearestRoom, setNearestRoom] = useState('');
  const [category, setCategory] = useState<FixtureCategory | null>(null);
  const [categoryReferenceOpen, setCategoryReferenceOpen] = useState(false);
  const [pressure, setPressure] = useState(2);
  const [cleanliness, setCleanliness] = useState(2);
  const [observations, setObservations] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [nearestFixtureId, setNearestFixtureId] = useState('');
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [postSaveOpen, setPostSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; label: string } | null>(null);

  // University/campus creation + fuzzy matching
  const [campusQuery, setCampusQuery] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');

  // Building fuzzy matching
  const [buildingQuery, setBuildingQuery] = useState('');

  const campusBuildings = useMemo(
    () => (selectedCampusId ? getBuildingsByCampus(selectedCampusId) : []),
    [selectedCampusId, getBuildingsByCampus],
  );
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  const filteredCampuses = useMemo(() => {
    if (!campusQuery.trim()) return campuses;
    return campuses.filter((c) => fuzzyIncludes(`${c.school} ${c.name}`, campusQuery));
  }, [campusQuery, campuses]);

  const filteredBuildings = useMemo(() => {
    if (!selectedCampusId) return [];
    if (!buildingQuery.trim()) return campusBuildings;
    return campusBuildings.filter((b) => fuzzyIncludes(b.name, buildingQuery));
  }, [buildingQuery, campusBuildings, selectedCampusId]);

  const floorProgress = selectedBuildingId && floor.trim()
    ? getFloorProgress(selectedBuildingId, floor.trim())
    : null;
  const floorLocked = floorProgress?.status === 'Restricted';

  const STEP_LABELS = ['Location', 'Photos & label', 'Condition', 'Confirm'];

  // Deep link support from Campus → Assets (pre-fill).
  useEffect(() => {
    const nextMode = searchParams.get('mode');
    const campusId = searchParams.get('campusId') ?? '';
    const buildingId = searchParams.get('buildingId') ?? '';
    const floorParam = searchParams.get('floor') ?? '';
    const filterParam = searchParams.get('filter');

    if (nextMode === 'onboard') {
      setMode('onboard');
      setStep(1);
    } else if (nextMode === 'manage') {
      setMode('manage');
    }
    if (campusId) setSelectedCampusId(campusId);
    if (buildingId) setSelectedBuildingId(buildingId);
    if (floorParam) setFloor(floorParam);
    setManageFilter(filterParam === 'urgent' ? 'urgent' : 'all');
  }, [searchParams]);

  // Manage helpers
  const manageCampusBuildings = manageCampus ? getBuildingsByCampus(manageCampus) : [];
  const manageBuildingObj = buildings.find(b => b.id === manageBuilding);
  const urgentFixtures = useMemo(() => fixtures.filter(needsReview), [fixtures]);
  const manageResults = useMemo(() => {
    const source = manageQuery
      ? searchFixtures(manageQuery)
      : manageFilter === 'urgent'
        ? urgentFixtures
        : [];
    return source.filter(f => f.campusId === manageCampus);
  }, [manageCampus, manageFilter, manageQuery, searchFixtures, urgentFixtures]);

  useEffect(() => {
    if (!manageCampus && campuses[0]) {
      setManageCampus(campuses[0].id);
    }
  }, [campuses, manageCampus]);

  const recentFixtures = useMemo(() => {
    const toNumeric = (id: string) => {
      const digits = id.replace(/\D/g, '');
      return digits ? Number(digits) : 0;
    };
    return [...fixtures].sort((a, b) => toNumeric(b.id) - toNumeric(a.id)).slice(0, 3);
  }, [fixtures]);

  async function handleCreateBuilding() {
    if (!newBuildingName || !newBuildingFloors || !selectedCampusId) return;
    const created = await addBuilding({
      campusId: selectedCampusId,
      name: newBuildingName,
      floors: parseInt(newBuildingFloors),
    });
    if (created) {
      setSelectedBuildingId(created.id);
      toast.success('Building created');
    }
    setNewBuildingName('');
    setNewBuildingFloors('');
  }

  async function handleCreateCampus() {
    const school = universityName.trim();
    const name = campusName.trim();
    if (!school || !name) return;
    const created = await addCampus({ school, name, address: campusAddress.trim() || '—' });
    if (created) {
      setSelectedCampusId(created.id);
      toast.success('Campus created');
    }
    setCampusQuery('');
    setUniversityName('');
    setCampusName('');
    setCampusAddress('');
  }

  function handleFileUpload(file: File, setter: (v: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setter(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    setScanError(null);
    setScanResult(null);
    if (!photo || !photo.startsWith('data:')) {
      setScanError('Missing the GENERAL photo of the fixture. Take or upload it so we know what kind of unit this is.');
      setScanned(true);
      return;
    }
    if (!platePhoto || !platePhoto.startsWith('data:')) {
      setScanError('Missing the MODEL-PLATE photo. Either take a photo of the brand/model sticker, or use “No model label” below.');
      setScanned(true);
      return;
    }

    setScanning(true);
    try {
      const result = await scanFixtureLabelFromPhoto(platePhoto);
      setScanResult({
        ...result,
        category: result.category,
      });
      setBrand(result.brand);
      setModel(result.model);
      setSerialNumber(result.serialNumber);
      setFilterType(result.filterType);
      setCategory((prev) => prev ?? result.category);
      setScanned(true);
      const missing: string[] = [];
      if (!result.brand) missing.push('brand');
      if (!result.model) missing.push('model');
      if (missing.length) {
        toast.warning(`Scan partial — couldn't read: ${missing.join(', ')}`);
      } else {
        toast.success('Label scanned');
      }
    } catch (e) {
      console.error('scan failed', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setScanError(msg);
      setScanned(true);
      toast.error(`Scan failed: ${msg}`);
    } finally {
      setScanning(false);
    }
  }

  const trimmedRoom = nearestRoom.trim();
  const roomLooksValid = trimmedRoom.length >= 2;

  async function handleSubmit() {
    const building = buildings.find((b) => b.id === selectedBuildingId);
    if (!building) {
      toast.error('Select a building before saving.');
      return;
    }
    if (!category) {
      toast.error('Select a fixture type before saving.');
      return;
    }
    if (!roomLooksValid) {
      toast.error('Room / location needs at least 2 characters (e.g. 205 or hallway near restroom).');
      return;
    }
    if (!locationConfirmed) {
      toast.error('Check the confirmation box on this step before saving.');
      return;
    }
    if (noLabel && !noLabelReason) {
      toast.error('Pick a reason for the missing model label.');
      return;
    }
    if (noLabel && noLabelReason === 'Other' && !noLabelReasonOther.trim()) {
      toast.error('Describe the "Other" reason for the missing label.');
      return;
    }
    setSaving(true);
    try {
      const [photoUrl, plateUrl] = await Promise.all([
        photo ? uploadFixturePhoto(photo, 'general').catch(() => '') : Promise.resolve(''),
        platePhoto ? uploadFixturePhoto(platePhoto, 'plate').catch(() => '') : Promise.resolve(''),
      ]);

      const noteParts: string[] = [];
      if (observations.trim()) noteParts.push(observations.trim());
      if (nearestFixtureId.trim()) noteParts.push(`Nearest fixture ID: ${nearestFixtureId.trim()}`);
      const finalObs = noteParts.join(' | ') || undefined;

      const photosProvided: string[] = [];
      if (photo) photosProvided.push('general');
      if (platePhoto) photosProvided.push('plate');

      const created = await addFixture({
        campusId: selectedCampusId,
        buildingId: selectedBuildingId,
        buildingName: building.name,
        floor: floor.trim(),
        roomNumber: trimmedRoom,
        nearestRoom: trimmedRoom,
        brand,
        model,
        serialNumber,
        photoURL: photoUrl,
        modelPlatePhotoURL: plateUrl,
        lastMaintenanceDate: new Date().toISOString().split('T')[0],
        filterType,
        category,
        qualityRating: { pressure, cleanliness },
        observations: finalObs,
        issues: issues.length ? issues : undefined,
        noLabelReason: noLabel ? noLabelReason : undefined,
        noLabelReasonOther: noLabel && noLabelReason === 'Other' ? noLabelReasonOther.trim() : undefined,
        photosProvided,
        locationConfirmed: true,
      });
      if (created) {
        toast.success('Fixture added');
        setPostSaveOpen(true);
      } else {
        toast.error('Could not save fixture. Check the browser console for details.');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Could not save fixture');
    } finally {
      setSaving(false);
    }
  }

  // Step 5 inline validation — for the confirm checkbox + Save
  const step5Missing: string[] = [];
  if (!selectedCampusId) step5Missing.push('Campus');
  if (!selectedBuildingId) step5Missing.push('Building');
  if (!floor) step5Missing.push('Floor');
  if (!roomLooksValid) step5Missing.push('Room (min 2 chars)');
  if (!category) step5Missing.push('Fixture type');
  if (noLabel && !noLabelReason) step5Missing.push('No-label reason');
  if (noLabel && noLabelReason === 'Other' && !noLabelReasonOther.trim()) step5Missing.push('"Other" reason text');
  const step5Ready = step5Missing.length === 0;

  useEffect(() => {
    if (!step5Ready && locationConfirmed) setLocationConfirmed(false);
  }, [step5Ready, locationConfirmed]);

  const canProceed: Record<number, boolean> = {
    1: !!selectedCampusId && !!selectedBuildingId && !!floor.trim() && roomLooksValid && !floorLocked,
    2: !!category,
    3: true,
    4: locationConfirmed && step5Ready,
  };

  // Mode chooser
  if (mode === 'choose') {
    return (
      <div className="page-shell min-h-[calc(100vh-8rem)]">
        <header className="page-header text-center">
          <p className="section-label">Survey</p>
          <h1 className="page-title mt-1">What would you like to do?</h1>
          <p className="page-subtitle">On-site collection or find an existing record</p>
        </header>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode('onboard')}
            className="action-tile action-tile-primary w-full"
          >
            <div className="action-tile-icon action-tile-icon-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Survey a floor</p>
              <p className="text-xs text-muted-foreground">Walk the building, record fixtures</p>
            </div>
          </button>

          <button type="button" onClick={() => setMode('manage')} className="action-tile w-full">
            <div className="action-tile-icon">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Find a fixture</p>
              <p className="text-xs text-muted-foreground">Search or browse by floor</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/add?import=1')}
            className="action-tile w-full"
          >
            <div className="action-tile-icon">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Import spreadsheet</p>
              <p className="text-xs text-muted-foreground">Import CSV or Excel</p>
            </div>
          </button>
        </div>

        {recentFixtures.length > 0 && (
          <section className="mt-8">
            <h2 className="section-label mb-2">Recent</h2>
            <div className="space-y-2">
              {recentFixtures.map((f) => (
                <Link key={f.id} to={`/fixture/${f.id}`} className="list-row">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {f.buildingName} · Rm {f.roomNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[f.brand, f.model].filter(Boolean).join(' ') || 'Details pending'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Manage mode — map-based
  if (mode === 'manage') {
    return (
      <div className="page-shell">
        <button onClick={() => setMode('choose')} className="link-back mb-3">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-foreground">Manage database</h1>
        <p className="text-sm text-muted-foreground">Search fixtures or browse by building and floor</p>

        <div className="chip-row mt-4">
          <button
            type="button"
            onClick={() => setManageFilter('all')}
            className={manageFilter === 'all' ? 'chip-active whitespace-nowrap' : 'chip-inactive whitespace-nowrap'}
          >
            All fixtures
          </button>
          <button
            type="button"
            onClick={() => setManageFilter('urgent')}
            className={manageFilter === 'urgent' ? 'chip-active whitespace-nowrap' : 'chip-inactive whitespace-nowrap'}
          >
            Urgent review
          </button>
        </div>

        {/* Campus selector */}
        <div className="chip-row mt-3">
          {campuses.map((c) => (
            <button
              key={c.id}
              onClick={() => { setManageCampus(c.id); setManageBuilding(''); setManageFloor(null); }}
              className={manageCampus === c.id ? 'chip-active whitespace-nowrap' : 'chip-inactive whitespace-nowrap'}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={manageQuery}
            onChange={(e) => setManageQuery(e.target.value)}
            placeholder="Search fixtures..."
            className="search-input mt-3"
          />
        </div>

        {manageQuery || manageFilter === 'urgent' ? (
          <div className="mt-3 space-y-2">
            {manageResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {manageFilter === 'urgent' ? 'No urgent fixtures in this campus' : 'No results'}
              </p>
            ) : (
              manageResults.map((f) => (
                <Link key={f.id} to={`/fixture/${f.id}`} className="flex items-center justify-between rounded-xl border bg-card p-3">
                  <div>
                    <p className="list-row-title">{f.buildingName} — Rm {f.roomNumber}</p>
                    <p className="list-row-subtitle">{f.brand} {f.model}</p>
                  </div>
                  {needsReview(f) ? (
                    <span className="rounded-full bg-status-urgent/10 px-2 py-1 text-[10px] font-semibold text-status-urgent">
                      Review
                    </span>
                  ) : (
                    <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
                  )}
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Building selector */}
            <div className="chip-row mt-3">
              {manageCampusBuildings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setManageBuilding(b.id); setManageFloor('1'); }}
                  className={manageBuilding === b.id ? 'chip-active whitespace-nowrap' : 'chip-inactive whitespace-nowrap'}
                >
                  {b.name}
                </button>
              ))}
            </div>

            {/* Floor tabs */}
            {manageBuildingObj && (
              <div className="flex gap-1.5 mt-3">
                {Array.from({ length: manageBuildingObj.floors }, (_, i) => String(i + 1)).map((fl) => (
                  <button
                    key={fl}
                    onClick={() => setManageFloor(fl)}
                    className={manageFloor === fl ? 'chip-active' : 'chip-inactive'}
                  >
                    {fl}
                  </button>
                ))}
              </div>
            )}

            {/* Floor plan */}
            {manageBuilding && manageFloor && manageBuildingObj && (
              <div className="mt-3">
                <FloorPlanView
                  buildingId={manageBuilding}
                  floor={manageFloor}
                  buildingName={manageBuildingObj.name}
                  campusId={manageCampus}
                />
              </div>
            )}

              {!manageBuilding && (
              <div className="empty-state py-12">
                <Map className="empty-state-icon" />
                <p className="text-sm font-medium text-foreground">Select a building to browse floors</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Onboard mode
  return (
    <div className="page-shell">
      <button onClick={() => { setMode('choose'); setStep(1); }} className="link-back mb-3">
        ← Back
      </button>
      <h1 className="text-xl font-bold text-foreground">Survey — Add Fixture</h1>

      {/* Step indicator */}
      <div className="mt-4 flex gap-2">
        {STEP_LABELS.map((_, i) => {
          const s = i + 1;
          return <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'progress-step-active' : 'progress-step-inactive'}`} />;
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {STEP_LABELS[step - 1]} <span className="ml-1 opacity-70">({step}/{STEP_LABELS.length})</span>
      </p>

      {/* Step 1: Campus, Building, Floor, nearest room */}
      {step === 1 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="field-label-lg">University / Campus</label>

            <div className="mt-2 space-y-2">
              {filteredCampuses.slice(0, 6).map((c) => {
                const active = selectedCampusId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCampusId(c.id); setSelectedBuildingId(''); }}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      active ? 'border-primary/30 bg-primary/10' : 'bg-card hover:bg-secondary/30'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{c.school}</p>
                    <p className="text-[11px] text-muted-foreground">{c.name} • {c.address}</p>
                  </button>
                );
              })}
            </div>

            {!selectedCampusId && (
            <div className="mt-3 rounded-2xl border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <University className="h-4 w-4" />
                <p className="text-sm font-semibold text-foreground">Create new university/campus</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <div>
                  <input
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    placeholder="University name (e.g. University of Washington)"
                    className="field-input"
                  />
                </div>

                <input
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="Campus name (e.g. Seattle Campus)"
                  className="field-input"
                />
                <input
                  value={campusAddress}
                  onChange={(e) => setCampusAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="field-input"
                />
                <button
                  onClick={handleCreateCampus}
                  className="rounded-2xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
                >
                  Create campus
                </button>
              </div>
            </div>
            )}
          </div>

          {selectedCampusId && (
            <div>
              <label className="field-label-lg">Building</label>
              <div className="mt-2 space-y-2">
                {filteredBuildings.slice(0, 6).map((b) => {
                  const active = selectedBuildingId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                        active ? 'border-primary/30 bg-primary/10' : 'bg-card hover:bg-secondary/30'
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">{b.floors} floors</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedCampusId && !selectedBuildingId && (
            <div className="rounded-lg border bg-secondary/50 p-3">
              <p className="text-xs font-medium text-foreground mb-2">Or create new building</p>
              <input
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                placeholder="Building name"
                className="field-input mb-2"
              />
              <input value={newBuildingFloors} onChange={(e) => setNewBuildingFloors(e.target.value)} placeholder="Number of floors" type="number" className="field-input mb-2" />
              <button onClick={handleCreateBuilding} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                <Building2 className="inline h-3 w-3 mr-1" /> Create Building
              </button>
            </div>
          )}

          {selectedBuilding && (
            <div>
              <label className="field-label-lg">{FIELD_LABELS.floor}</label>
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 2, G, L1, B2"
                className="mt-1 field-input py-2.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Letters and numbers are both OK (e.g. ground floor = G).</p>
              {floorLocked && (
                <div className="mt-2 rounded-xl border border-status-urgent/40 bg-status-urgent/10 p-3 text-xs text-status-urgent">
                  This floor is locked{floorProgress?.restrictedReason ? `: ${floorProgress.restrictedReason}` : ''}. Unlock it from Campus before adding fixtures.
                </div>
              )}
            </div>
          )}

          {selectedBuilding && floor.trim() && !floorLocked && (
            <div>
              <label className="field-label-lg">{FIELD_LABELS.room}</label>
              <input
                value={nearestRoom}
                onChange={(e) => setNearestRoom(e.target.value)}
                placeholder="e.g. 205, or 'hallway near restroom'"
                className="mt-1 field-input py-2.5"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tip: drinking water sources are often by the restroom. Use at least 2 characters (e.g. 205 or hallway near restroom).
              </p>
              {nearestRoom.trim().length > 0 && !roomLooksValid && (
                <p className="mt-1 text-[11px] text-status-urgent">Room / location must be at least 2 characters.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Photos + optional scan */}
      {step === 2 && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border bg-primary/5 p-3">
            <p className="text-sm font-semibold text-foreground">📸 What to photograph</p>
            <ul className="mt-1.5 text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li><strong>{FIELD_LABELS.generalPhoto}:</strong> the whole fixture so it can be identified.</li>
              <li><strong>{FIELD_LABELS.modelLabel}:</strong> the company/model sticker — usually on the side, back, or under the basin.</li>
            </ul>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Note: some fixtures have no model label, or only partial info. Leave any field blank and continue.
            </p>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, setPhoto);
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
              if (file) {
                handleFileUpload(file, setPlatePhoto);
                setScanned(false);
                setScanError(null);
              }
              e.currentTarget.value = '';
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-dashed p-3">
              {photo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({ src: photo, label: FIELD_LABELS.generalPhoto })}
                    className="group relative block w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Open ${FIELD_LABELS.generalPhoto}`}
                  >
                    <img src={photo} alt="Fixture" className="h-24 w-full object-cover" />
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-background/85 p-1 text-foreground shadow-sm">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => photoInputRef.current?.click()} className="flex-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">Retake</button>
                    <button onClick={() => setPhoto(null)} className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">✕</button>
                  </div>
                </>
              ) : (
                <button onClick={() => photoInputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 py-3 text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">General photo</span>
                  <span className="text-[10px] text-muted-foreground">Whole fixture</span>
                </button>
              )}
            </div>
            <div className="rounded-xl border-2 border-dashed p-3">
              {platePhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto({ src: platePhoto, label: FIELD_LABELS.modelLabel })}
                    className="group relative block w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Open ${FIELD_LABELS.modelLabel}`}
                  >
                    <img src={platePhoto} alt={FIELD_LABELS.modelLabel} className="h-24 w-full object-cover" />
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-background/85 p-1 text-foreground shadow-sm">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => platePhotoInputRef.current?.click()} className="flex-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">Retake</button>
                    <button onClick={() => { setPlatePhoto(null); setScanned(false); setScanError(null); }} className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">✕</button>
                  </div>
                </>
              ) : (
                <button onClick={() => platePhotoInputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 py-3 text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs font-medium">{FIELD_LABELS.modelLabel}</span>
                  <span className="text-[10px] text-muted-foreground">Company / model sticker</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick fixture-type pick after taking photos */}
          <div className="rounded-2xl border bg-card p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">What type of fixture is this?</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">Pick the fixture type before continuing.</p>
              <button
                type="button"
                onClick={() => setCategoryReferenceOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                <Info className="h-3.5 w-3.5" />
                View examples
              </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FIXTURE_CATEGORIES.map((id) => {
                const active = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`rounded-lg border px-2 py-2 text-left text-xs transition-colors ${active ? 'border-primary/30 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:bg-secondary/30'}`}
                  >
                    {fixtureCategoryMeta[id].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference-image modal */}
          {categoryReferenceOpen && (
            <div className="overlay-scrim" onClick={() => setCategoryReferenceOpen(false)}>
              <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Fixture type examples</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Use this reference to compare common water fixture categories.</p>
                  </div>
                  <button onClick={() => setCategoryReferenceOpen(false)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <img
                  src="/fixtures-reference.jpg"
                  alt="Fixture type reference examples"
                  className="mt-3 max-h-[72vh] w-full rounded-xl border object-contain"
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Scan label</p>
                  <p className="text-[11px] text-muted-foreground">Reads {FIELD_LABELS.companyName.toLowerCase()}, {FIELD_LABELS.model.toLowerCase()}, {FIELD_LABELS.serialNumber.toLowerCase()} from the label photo</p>
                </div>
              </div>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {scanning ? 'Scanning…' : scanned ? 'Re-scan' : 'Scan'}
              </button>
            </div>

            {/* Photo readiness indicators */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className={`rounded-lg border p-2 ${photo ? 'border-status-good/40 bg-status-good/10' : 'border-status-urgent/40 bg-status-urgent/10'}`}>
                <p className="font-semibold text-foreground">General photo</p>
                <p className={photo ? 'text-status-good' : 'text-status-urgent'}>
                  {photo ? '✓ Ready' : '✗ Missing — required'}
                </p>
              </div>
              <div className={`rounded-lg border p-2 ${platePhoto ? 'border-status-good/40 bg-status-good/10' : noLabel ? 'border-muted bg-muted/10' : 'border-status-warning/40 bg-status-warning/10'}`}>
                <p className="font-semibold text-foreground">{FIELD_LABELS.modelLabel}</p>
                <p className={platePhoto ? 'text-status-good' : noLabel ? 'text-muted-foreground' : 'text-status-warning'}>
                  {platePhoto ? '✓ Ready' : noLabel ? 'Skipped (no label)' : '⚠ Missing'}
                </p>
              </div>
            </div>

            {scanError && (
              <div className="mt-3 rounded-xl border border-status-urgent/40 bg-status-urgent/10 p-3">
                <div className="flex items-start gap-2">
                  <MessageSquareWarning className="h-4 w-4 text-status-urgent flex-none mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-status-urgent">Scan failed</p>
                    <p className="mt-0.5 text-[11px] text-status-urgent/80 break-words">{scanError}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => photoInputRef.current?.click()} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                        Retake general
                      </button>
                      <button onClick={() => platePhotoInputRef.current?.click()} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                        Retake plate
                      </button>
                      <button onClick={handleScan} disabled={scanning} className="btn-inverse">
                        {scanning ? 'Retrying…' : 'Try again'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {scanned && !scanError && scanResult && (
              <div className="mt-3 rounded-xl border border-status-good/40 bg-status-good/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-status-good">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-semibold">Scan complete</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Confidence: {Math.round(scanResult.confidence * 100)}%</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    [FIELD_LABELS.companyName, scanResult.brand],
                    [FIELD_LABELS.model, scanResult.model],
                    [FIELD_LABELS.serialNumber, scanResult.serialNumber],
                    [FIELD_LABELS.productNumber, scanResult.filterType],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md bg-card border px-2 py-1">
                      <p className="text-muted-foreground">{k}</p>
                      <p className={`font-medium ${v ? 'text-foreground' : 'text-status-warning'}`}>
                        {v || '— not detected'}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Review and edit any field below before continuing.</p>
              </div>
            )}

            {/* No model label path */}
            <div className="mt-3 rounded-xl border bg-secondary/30 p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noLabel}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setNoLabel(v);
                    if (v) {
                      setPlatePhoto(null);
                      setBrand(brand || '');
                      setModel(model || '');
                      setScanError(null);
                      setScanned(false);
                    }
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">No model label / label unreadable</p>
                  <p className="text-[11px] text-muted-foreground">Skip the label photo. {FIELD_LABELS.companyName} and {FIELD_LABELS.model} can stay blank — we'll record why below.</p>
                </div>
              </label>
              {noLabel && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Why can't the label be captured? <span className="text-status-urgent">*</span>
                  </p>
                  <div className="space-y-1.5">
                    {NO_LABEL_REASONS.map((r) => (
                      <label key={r} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noLabelReason === r}
                          onChange={() => setNoLabelReason(noLabelReason === r ? '' : r)}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-foreground">{r}</span>
                      </label>
                    ))}
                  </div>
                  {!noLabelReason && (
                    <p className="text-[10px] text-status-urgent">Select one reason above.</p>
                  )}
                  {noLabelReason === 'Other' && (
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Describe</label>
                      <textarea
                        value={noLabelReasonOther}
                        onChange={(e) => setNoLabelReasonOther(e.target.value)}
                        placeholder="Explain why the model label can't be captured"
                        className="mt-1 w-full min-h-[50px] rounded-lg border bg-card px-3 py-2 text-xs text-foreground"
                      />
                      {!noLabelReasonOther.trim() && (
                        <p className="mt-1 text-[10px] text-status-urgent">Please describe the reason.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Always-editable fields so older / unlabeled fixtures still work */}
            <div className="mt-3 space-y-3">
              {[
                { label: FIELD_LABELS.companyName, value: brand, setter: setBrand, optional: true },
                { label: FIELD_LABELS.model, value: model, setter: setModel, optional: true },
                { label: FIELD_LABELS.serialNumber, value: serialNumber, setter: setSerialNumber, optional: true },
                { label: FIELD_LABELS.productNumber, value: filterType, setter: setFilterType, optional: true },
              ].map(({ label, value, setter, optional }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted-foreground">
                    {label}{optional ? ' (optional)' : ''}
                  </label>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={optional ? 'Leave blank if not on label' : ''}
                    className="mt-1 field-input"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Rate + observations (quick) */}
      {step === 3 && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquareWarning className="h-4 w-4" />
              <p className="text-sm">Optional: note condition (Low / OK / Good)</p>
            </div>
          </div>
          <div>
            <label className="field-label-lg">Water pressure</label>
            <SimpleRating compact value={pressure} onChange={setPressure} />
          </div>
          <div>
            <label className="field-label-lg">Cleanliness</label>
            <SimpleRating compact value={cleanliness} onChange={setCleanliness} />
          </div>

          <div>
            <label className="field-label-lg">Quick issues</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ISSUE_OPTIONS.map(({ id, label }) => {
                const active = issues.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => setIssues((prev) => (active ? prev.filter((x) => x !== id) : [...prev, id]))}
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
            <label className="field-label-lg">Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="e.g. rusted fixture, low pressure, needs wipe..."
              className="mt-1 field-textarea py-2.5"
            />
          </div>
        </div>
      )}

      {/* Step 4: Final location confirmation (required) */}
      {step === 4 && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">⚠ Confirm exact location</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Verify everything below — once saved, this fixture is locked to this location.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Campus</span><span className="font-semibold text-foreground text-right">{selectedCampus ? `${selectedCampus.school} — ${selectedCampus.name}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span className="font-semibold text-foreground text-right">{selectedBuilding?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS.floor}</span><span className="font-semibold text-foreground">{floor || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS.room}</span><span className="font-semibold text-foreground text-right">{nearestRoom || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fixture type</span><span className="font-semibold text-foreground">{category ? fixtureCategoryMeta[category].label : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS.companyName} / {FIELD_LABELS.model}</span><span className="font-semibold text-foreground text-right">{(brand || '—')} {model && `· ${model}`}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS.serialNumber}</span><span className="font-semibold text-foreground">{serialNumber || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS.productNumber}</span><span className="font-semibold text-foreground">{filterType || '—'}</span></div>
          </div>

          <div>
            <label className="field-label-lg">Nearest fixture ID <span className="text-muted-foreground font-normal">(for reference)</span></label>
            <input
              value={nearestFixtureId}
              onChange={(e) => setNearestFixtureId(e.target.value)}
              placeholder="e.g. F-0123 — the closest already-tagged fixture"
              className="mt-1 field-input py-2.5"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Helps audit the position relative to known assets. Leave blank if none nearby.</p>
          </div>

          {!step5Ready && (
            <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-3">
              <p className="text-xs font-semibold text-status-warning">Complete these before confirming:</p>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-status-warning/90">
                {step5Missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {!locationConfirmed && step5Ready && (
            <p className="text-[11px] text-muted-foreground">Check the box below to enable Save.</p>
          )}

          <label className={`flex items-start gap-2 rounded-xl border p-3 ${step5Ready ? 'bg-card cursor-pointer' : 'bg-muted/30 cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              checked={locationConfirmed}
              disabled={!step5Ready}
              onChange={(e) => setLocationConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-foreground">
              I confirm the location, fixture type, and label details above are correct (blank fields are OK when not on the label).
            </span>
          </label>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed[step]} className="btn-primary flex items-center gap-1 disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canProceed[4] || saving} className="btn-primary flex items-center gap-1 px-6 disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Fixture'}
          </button>
        )}
      </div>

      {previewPhoto && (
        <div className="overlay-scrim p-3" onClick={() => setPreviewPhoto(null)}>
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-background/95 px-3 py-2 shadow-lg">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{previewPhoto.label}</p>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="btn-icon"
                aria-label="Close photo preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewPhoto.src}
              alt={previewPhoto.label}
              className="max-h-[78vh] w-full rounded-xl bg-background object-contain shadow-xl"
            />
          </div>
        </div>
      )}

      {/* Post-save: Are you done with this floor? */}
      {postSaveOpen && (
        <div className="overlay-scrim items-end sm:items-center" onClick={() => { setPostSaveOpen(false); navigate('/'); }}>
          <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-foreground">Fixture saved ✓</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Are you done collecting fixtures on Floor {floor}?
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  // Stay in onboard mode for another fixture on the same floor
                  setPhoto(null); setPlatePhoto(null); setBrand(''); setModel(''); setSerialNumber('');
                  setFilterType(''); setScanned(false); setScanError(null); setScanResult(null); setCategory(null);
                  setObservations(''); setIssues([]); setNearestRoom('');
                  setNoLabel(false); setNoLabelReason(''); setNoLabelReasonOther(''); setNearestFixtureId(''); setLocationConfirmed(false);
                  setStep(1);
                  setStep(1);
                  setPostSaveOpen(false);
                }}
                className="btn-primary w-full"
              >
                Add another on Floor {floor}
              </button>
              <button
                onClick={async () => {
                  if (selectedBuildingId && floor) {
                    await setFloorStatus(selectedBuildingId, floor.trim(), 'Done');
                    toast.success(`Floor ${floor} marked as Done`);
                  }
                  setPostSaveOpen(false);
                  navigate('/campus');
                }}
                className="btn-inverse-block"
              >
                Yes — mark Floor {floor} done
              </button>
              <button
                onClick={() => { setPostSaveOpen(false); navigate('/'); }}
                className="btn-secondary w-full"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
