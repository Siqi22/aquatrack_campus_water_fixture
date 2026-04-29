import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFixtureStore, getFixtureStatus, fixtureCategoryMeta } from '@/store/fixtureStore';
import type { FixtureCategory } from '@/store/fixtureStore';
import { Camera, ScanLine, CheckCircle2, Building2, ChevronLeft, ChevronRight, ImagePlus, PlusCircle, ListChecks, Search, Droplets, Map, Tags, MessageSquareWarning, HelpCircle, University, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StarRating } from '@/components/StarRating';
import { StatusBadge } from '@/components/StatusBadge';
import { FloorPlanView } from '@/components/FloorPlanView';

type Mode = 'choose' | 'onboard' | 'manage';

const NO_LABEL_REASONS = [
  'Sticker worn off / illegible',
  'Plate hidden behind wall or fixture body',
  'Older fixture — no plate present',
  'Plate damaged / painted over',
  'Other',
] as const;

const CATEGORY_REFERENCE_IMAGES: Record<FixtureCategory, string> = {
  BottleFiller: 'https://placehold.co/600x400/0f172a/ffffff?text=Bottle+Filler',
  WallFountain: 'https://placehold.co/600x400/0f172a/ffffff?text=Wall+Fountain',
  CombinationUnit: 'https://placehold.co/600x400/0f172a/ffffff?text=Combo+Unit',
  FilteredTap: 'https://placehold.co/600x400/0f172a/ffffff?text=Filtered+Tap',
  Other: 'https://placehold.co/600x400/0f172a/ffffff?text=Other',
};

function fuzzyIncludes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

import { supabase } from '@/integrations/supabase/client';
import { uploadFixturePhoto } from '@/lib/uploadPhoto';
import { toast } from 'sonner';

type MapboxFeature = {
  id: string;
  place_name: string;
  text: string;
  center?: [number, number];
  context?: Array<{ id: string; text: string }>;
};

async function mapboxAutocomplete(args: {
  token: string;
  query: string;
  limit?: number;
  types?: string;
}) {
  const limit = args.limit ?? 6;
  const types = args.types ?? 'poi,place,locality,address';
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(args.query)}.json`,
  );
  url.searchParams.set('access_token', args.token);
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('types', types);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mapbox geocoding failed: ${res.status}`);
  const data: unknown = await res.json();
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [] as MapboxFeature[];
  return features.filter((f): f is MapboxFeature => !!f && typeof f === 'object' && 'id' in f) as MapboxFeature[];
}

export default function AddAsset() {
  const { campuses, buildings, fixtures, addCampus, addBuilding, addFixture, searchFixtures, getBuildingsByCampus, getFixturesByCampus, setFloorStatus } = useFixtureStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('choose');

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const platePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Manage state
  const [manageQuery, setManageQuery] = useState('');
  const [manageCampus, setManageCampus] = useState<string>(campuses[0]?.id || '');
  const [manageBuilding, setManageBuilding] = useState<string>('');
  const [manageFloor, setManageFloor] = useState<number | null>(null);

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
  const [suggestedCategory, setSuggestedCategory] = useState<FixtureCategory | null>(null);
  const [categoryHelp, setCategoryHelp] = useState<FixtureCategory | null>(null);
  const [categoryRefHelp, setCategoryRefHelp] = useState<FixtureCategory | null>(null);
  const [pressure, setPressure] = useState(3);
  const [cleanliness, setCleanliness] = useState(3);
  const [observations, setObservations] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [nearestFixtureId, setNearestFixtureId] = useState('');
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [postSaveOpen, setPostSaveOpen] = useState(false);

  // University/campus creation + fuzzy matching
  const [campusQuery, setCampusQuery] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
  const [campusSuggestOpen, setCampusSuggestOpen] = useState(false);
  const [campusGeoSuggestions, setCampusGeoSuggestions] = useState<MapboxFeature[]>([]);
  const [campusGeoLoading, setCampusGeoLoading] = useState(false);

  // Building fuzzy matching
  const [buildingQuery, setBuildingQuery] = useState('');
  const [buildingSuggestOpen, setBuildingSuggestOpen] = useState(false);
  const [buildingGeoSuggestions, setBuildingGeoSuggestions] = useState<MapboxFeature[]>([]);
  const [buildingGeoLoading, setBuildingGeoLoading] = useState(false);

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

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  useEffect(() => {
    const q = `${universityName} ${campusName}`.trim();
    if (!campusSuggestOpen) return;
    if (!q) {
      setCampusGeoSuggestions([]);
      return;
    }
    if (!mapboxToken) {
      setCampusGeoSuggestions([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setCampusGeoLoading(true);
        const results = await mapboxAutocomplete({
          token: mapboxToken,
          query: q,
          types: 'poi,place,locality',
          limit: 6,
        });
        if (!cancelled) setCampusGeoSuggestions(results);
      } catch {
        if (!cancelled) setCampusGeoSuggestions([]);
      } finally {
        if (!cancelled) setCampusGeoLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [universityName, campusName, campusSuggestOpen, mapboxToken]);

  useEffect(() => {
    const q = newBuildingName.trim();
    if (!buildingSuggestOpen) return;
    if (!q) {
      setBuildingGeoSuggestions([]);
      return;
    }
    if (!mapboxToken) {
      setBuildingGeoSuggestions([]);
      return;
    }

    const context = selectedCampus ? `${selectedCampus.school} ${selectedCampus.name}` : '';
    const composed = context ? `${q}, ${context}` : q;

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setBuildingGeoLoading(true);
        const results = await mapboxAutocomplete({
          token: mapboxToken,
          query: composed,
          types: 'poi,address',
          limit: 6,
        });
        if (!cancelled) setBuildingGeoSuggestions(results);
      } catch {
        if (!cancelled) setBuildingGeoSuggestions([]);
      } finally {
        if (!cancelled) setBuildingGeoLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [newBuildingName, buildingSuggestOpen, mapboxToken, selectedCampus]);

  // Deep link support from Campus → Assets (pre-fill).
  useEffect(() => {
    const nextMode = searchParams.get('mode');
    const campusId = searchParams.get('campusId') ?? '';
    const buildingId = searchParams.get('buildingId') ?? '';
    const floorParam = searchParams.get('floor') ?? '';

    if (nextMode === 'onboard') {
      setMode('onboard');
      setStep(1);
    }
    if (campusId) setSelectedCampusId(campusId);
    if (buildingId) setSelectedBuildingId(buildingId);
    if (floorParam) setFloor(floorParam);
  }, [searchParams]);

  // Manage helpers
  const manageCampusBuildings = manageCampus ? getBuildingsByCampus(manageCampus) : [];
  const manageBuildingObj = buildings.find(b => b.id === manageBuilding);
  const manageResults = manageQuery
    ? searchFixtures(manageQuery).filter(f => f.campusId === manageCampus)
    : [];

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
    if (created) setSelectedBuildingId(created.id);
    setNewBuildingName('');
    setNewBuildingFloors('');
  }

  async function handleCreateCampus() {
    const school = universityName.trim();
    const name = campusName.trim();
    if (!school || !name) return;
    const created = await addCampus({ school, name, address: campusAddress.trim() || '—' });
    if (created) setSelectedCampusId(created.id);
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
      const base64 = platePhoto.split(',')[1] ?? '';
      const { data, error } = await supabase.functions.invoke('scan-fixture-label', {
        body: { imageBase64: base64 },
      });
      if (error) {
        const msg = (error as { message?: string }).message || 'Edge function error';
        throw new Error(msg);
      }
      if (data && typeof data === 'object' && !('error' in data)) {
        const result = {
          brand: String(data.brand ?? '').trim(),
          model: String(data.model ?? '').trim(),
          serialNumber: String(data.serialNumber ?? '').trim(),
          filterType: String(data.filterType ?? '').trim(),
          category: String(data.category ?? '').trim(),
          confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        };
        setScanResult(result);
        setBrand(result.brand);
        setModel(result.model);
        setSerialNumber(result.serialNumber);
        setFilterType(result.filterType);
        const cat = result.category as FixtureCategory;
        if ((Object.keys(fixtureCategoryMeta) as string[]).includes(cat)) {
          setSuggestedCategory(cat);
          setCategory((prev) => prev ?? cat);
        }
        setScanned(true);
        const missing: string[] = [];
        if (!result.brand) missing.push('brand');
        if (!result.model) missing.push('model');
        if (missing.length) {
          toast.warning(`Scan partial — couldn't read: ${missing.join(', ')}`);
        } else {
          toast.success('Label scanned');
        }
        return;
      }
      const errMsg = (data as { error?: string })?.error ?? 'No structured response from AI';
      throw new Error(errMsg);
    } catch (e) {
      console.error('scan failed', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setScanError(msg);
      setScanned(true);
      toast.error(`AI scan failed: ${msg}`);
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit() {
    const building = buildings.find((b) => b.id === selectedBuildingId);
    if (!building || !category) return;
    if (!locationConfirmed) {
      toast.error('Please confirm the fixture location before saving.');
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
        floor: parseInt(floor),
        roomNumber: nearestRoom,
        nearestRoom,
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
        posX: Math.floor(Math.random() * 60 + 20),
        posY: Math.floor(Math.random() * 60 + 20),
        noLabelReason: noLabel ? noLabelReason : undefined,
        noLabelReasonOther: noLabel && noLabelReason === 'Other' ? noLabelReasonOther.trim() : undefined,
        photosProvided,
        locationConfirmed: true,
      });
      if (created) {
        toast.success('Fixture added');
        setPostSaveOpen(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not save fixture');
    }
  }

  // Step 5 inline validation — for the confirm checkbox + Save
  const trimmedRoom = nearestRoom.trim();
  const roomLooksValid = trimmedRoom.length >= 2;
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
    1: !!selectedCampusId && !!selectedBuildingId && !!floor && !!nearestRoom,
    2: true,
    3: true,
    4: !!category,
    5: locationConfirmed && step5Ready,
  };

  // Mode chooser
  if (mode === 'choose') {
    return (
      <div className="px-4 pt-8 pb-6 min-h-[calc(100vh-80px)] flex flex-col">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-3">
            <Droplets className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Asset Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose your workflow</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('onboard')}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/5 p-5 text-center transition-all hover:border-accent hover:bg-accent/10"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15">
              <PlusCircle className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Survey new building</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Collect by floor</p>
            </div>
          </button>

          <button
            onClick={() => setMode('manage')}
            className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <ListChecks className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Update existing</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Find & edit fixtures</p>
            </div>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-card/70 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{campuses.length}</p>
            <p className="text-[10px] font-medium text-muted-foreground">Campuses</p>
          </div>
          <div className="rounded-xl border bg-card/70 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{buildings.length}</p>
            <p className="text-[10px] font-medium text-muted-foreground">Buildings</p>
          </div>
          <div className="rounded-xl border bg-card/70 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{fixtures.length}</p>
            <p className="text-[10px] font-medium text-muted-foreground">Fixtures</p>
          </div>
        </div>

        <div className="mt-5 flex-1">
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent fixtures</p>
                <p className="text-[11px] text-muted-foreground">Jump back in where you left off</p>
              </div>
              <button
                type="button"
                onClick={() => setMode('manage')}
                className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground"
              >
                Browse
              </button>
            </div>

            {recentFixtures.length === 0 ? (
              <div className="mt-3 rounded-xl border bg-card p-4 text-center text-muted-foreground">
                <p className="text-sm font-medium">No fixtures yet</p>
                <p className="mt-1 text-[11px]">Start a survey to add your first one.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {recentFixtures.map((f) => (
                  <Link
                    key={f.id}
                    to={`/fixture/${f.id}`}
                    className="flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:bg-secondary/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{f.buildingName} — Rm {f.roomNumber}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{f.brand} {f.model}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Manage mode — map-based
  if (mode === 'manage') {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => setMode('choose')} className="text-xs text-accent font-medium mb-3 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-foreground">Manage Assets</h1>
        <p className="text-sm text-muted-foreground">Browse fixtures on the floor plan</p>

        {/* Campus selector */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {campuses.map((c) => (
            <button
              key={c.id}
              onClick={() => { setManageCampus(c.id); setManageBuilding(''); setManageFloor(null); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                manageCampus === c.id ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
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
            className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {manageQuery ? (
          <div className="mt-3 space-y-2">
            {manageResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results</p>
            ) : (
              manageResults.map((f) => (
                <Link key={f.id} to={`/fixture/${f.id}`} className="flex items-center justify-between rounded-xl border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.buildingName} — Rm {f.roomNumber}</p>
                    <p className="text-xs text-muted-foreground">{f.brand} {f.model}</p>
                  </div>
                  <StatusBadge status={getFixtureStatus(f.lastMaintenanceDate)} />
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Building selector */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {manageCampusBuildings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setManageBuilding(b.id); setManageFloor(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    manageBuilding === b.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            {/* Floor tabs */}
            {manageBuildingObj && (
              <div className="flex gap-1.5 mt-3">
                {Array.from({ length: manageBuildingObj.floors }, (_, i) => i + 1).map((fl) => (
                  <button
                    key={fl}
                    onClick={() => setManageFloor(fl)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      manageFloor === fl ? 'bg-accent text-accent-foreground' : 'bg-secondary/60 text-muted-foreground'
                    }`}
                  >
                    F{fl}
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
                />
              </div>
            )}

            {!manageBuilding && (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Map className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Select a building to view floor plan</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Onboard mode
  return (
    <div className="px-4 pt-6">
      <button onClick={() => { setMode('choose'); setStep(1); }} className="text-xs text-accent font-medium mb-3 flex items-center gap-1">
        ← Back
      </button>
      <h1 className="text-xl font-bold text-foreground">Survey — Add Fixture</h1>

      {/* Step indicator */}
      <div className="mt-4 flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-accent' : 'bg-secondary'}`} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {step === 1 && 'Location'}
        {step === 2 && 'Photos'}
        {step === 3 && 'Confirm type'}
        {step === 4 && 'Rate & notes'}
        <span className="ml-2 opacity-70">({step}/4)</span>
      </p>

      {/* Step 1: Campus, Building, Floor, nearest room */}
      {step === 1 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">University / Campus</label>

            <div className="mt-2 space-y-2">
              {filteredCampuses.slice(0, 6).map((c) => {
                const active = selectedCampusId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCampusId(c.id); setSelectedBuildingId(''); }}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      active ? 'border-accent bg-accent/10' : 'bg-card hover:bg-secondary/30'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{c.school}</p>
                    <p className="text-[11px] text-muted-foreground">{c.name} • {c.address}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <University className="h-4 w-4" />
                <p className="text-sm font-semibold text-foreground">Create new university/campus</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="relative">
                  <input
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    onFocus={() => setCampusSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setCampusSuggestOpen(false), 120)}
                    placeholder="University name (e.g. University of Washington)"
                    className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
                  />

                  {campusSuggestOpen && (campusGeoLoading || campusGeoSuggestions.length > 0) && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                      {campusGeoLoading && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                      )}
                      {campusGeoSuggestions.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            // Keep creation flow: just prefill the form with a real-world suggestion.
                            setUniversityName(f.text);
                            setCampusName('');
                            setCampusAddress(f.place_name);
                            setCampusSuggestOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left transition-colors hover:bg-secondary/40"
                        >
                          <p className="text-sm font-semibold text-foreground">{f.text}</p>
                          <p className="text-[11px] text-muted-foreground">{f.place_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="Campus name (e.g. Seattle Campus)"
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
                />
                <input
                  value={campusAddress}
                  onChange={(e) => setCampusAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
                />
                <button
                  onClick={handleCreateCampus}
                  className="rounded-2xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
                >
                  Create campus
                </button>
              </div>
            </div>
          </div>

          {selectedCampusId && (
            <div>
              <label className="text-sm font-medium text-foreground">Building</label>
              <div className="mt-2 space-y-2">
                {filteredBuildings.slice(0, 6).map((b) => {
                  const active = selectedBuildingId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                        active ? 'border-accent bg-accent/10' : 'bg-card hover:bg-secondary/30'
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

          {selectedCampusId && (
            <div className="rounded-lg border bg-secondary/50 p-3">
              <p className="text-xs font-medium text-foreground mb-2">Or create new building</p>
              <div className="relative mb-2">
                <input
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  onFocus={() => setBuildingSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setBuildingSuggestOpen(false), 120)}
                  placeholder="Building name"
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
                />

                {buildingSuggestOpen && (buildingGeoLoading || buildingGeoSuggestions.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                    {buildingGeoLoading && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                    )}
                    {buildingGeoSuggestions.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewBuildingName(f.text);
                          if (!campusAddress.trim()) setCampusAddress(f.place_name);
                          setBuildingSuggestOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left transition-colors hover:bg-secondary/40"
                      >
                        <p className="text-sm font-semibold text-foreground">{f.text}</p>
                        <p className="text-[11px] text-muted-foreground">{f.place_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input value={newBuildingFloors} onChange={(e) => setNewBuildingFloors(e.target.value)} placeholder="Number of floors" type="number" className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground mb-2" />
              <button onClick={handleCreateBuilding} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                <Building2 className="inline h-3 w-3 mr-1" /> Create Building
              </button>
            </div>
          )}

          {selectedBuilding && (
            <div>
              <label className="text-sm font-medium text-foreground">📍 What floor are you on?</label>
              <select value={floor} onChange={(e) => setFloor(e.target.value)} className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground">
                <option value="">Select floor...</option>
                {Array.from({ length: selectedBuilding.floors }, (_, i) => <option key={i + 1} value={i + 1}>Floor {i + 1}</option>)}
              </select>
            </div>
          )}

          {selectedBuilding && floor && (
            <div>
              <label className="text-sm font-medium text-foreground">🚪 Room number (or nearest landmark)</label>
              <input
                value={nearestRoom}
                onChange={(e) => setNearestRoom(e.target.value)}
                placeholder="e.g. 205, or 'hallway near restroom'"
                className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tip: drinking water sources are often by the restroom. Confirm the exact location before taking photos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Photos + optional scan */}
      {step === 2 && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border bg-accent/5 p-3">
            <p className="text-sm font-semibold text-foreground">📸 What to photograph</p>
            <ul className="mt-1.5 text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li><strong>General photo:</strong> the whole fixture so it can be identified.</li>
              <li><strong>Model plate:</strong> the brand/model sticker — usually on the side, back, or under the basin.</li>
            </ul>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Note: some older fixtures don't have a model sticker. If so, skip the plate photo and fill the fields manually.
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
                  <img src={photo} alt="Fixture" className="h-24 w-full rounded-lg object-cover" />
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
                  <img src={platePhoto} alt="Model Plate" className="h-24 w-full rounded-lg object-cover" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => platePhotoInputRef.current?.click()} className="flex-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">Retake</button>
                    <button onClick={() => { setPlatePhoto(null); setScanned(false); setScanError(null); }} className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">✕</button>
                  </div>
                </>
              ) : (
                <button onClick={() => platePhotoInputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 py-3 text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs font-medium">Model plate</span>
                  <span className="text-[10px] text-muted-foreground">Brand/model sticker</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick fixture-type pick after taking photos */}
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">What type of fixture is this?</p>
            <p className="text-[11px] text-muted-foreground">You can change this on the next step. Tap <Info className="inline h-3 w-3 -mt-0.5" /> for a reference photo.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(fixtureCategoryMeta) as FixtureCategory[]).map((id) => {
                const active = category === id;
                return (
                  <div
                    key={id}
                    className={`relative rounded-lg border ${active ? 'border-accent bg-accent/10' : 'bg-card'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setCategory(id)}
                      className={`block w-full text-left px-2 py-2 pr-8 text-xs ${active ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {fixtureCategoryMeta[id].label}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCategoryRefHelp(id); }}
                      aria-label={`Reference image for ${fixtureCategoryMeta[id].label}`}
                      className="absolute right-1 top-1 rounded-full p-1.5 text-accent hover:bg-accent/15"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reference-image modal */}
          {categoryRefHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCategoryRefHelp(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{fixtureCategoryMeta[categoryRefHelp].label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{fixtureCategoryMeta[categoryRefHelp].examples.join(' • ')}</p>
                  </div>
                  <button onClick={() => setCategoryRefHelp(null)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <img
                  src={CATEGORY_REFERENCE_IMAGES[categoryRefHelp]}
                  alt={`${fixtureCategoryMeta[categoryRefHelp].label} reference`}
                  className="mt-3 w-full rounded-xl border object-cover"
                />
                <button
                  type="button"
                  onClick={() => { setCategory(categoryRefHelp); setCategoryRefHelp(null); }}
                  className="mt-3 w-full rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
                >
                  Pick this type
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Auto-scan label</p>
                  <p className="text-[11px] text-muted-foreground">Reads brand/model/serial from the plate photo</p>
                </div>
              </div>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50"
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
                <p className="font-semibold text-foreground">Model plate</p>
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
                      <button onClick={handleScan} disabled={scanning} className="rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background disabled:opacity-50">
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
                    ['Brand', scanResult.brand],
                    ['Model', scanResult.model],
                    ['Serial', scanResult.serialNumber],
                    ['Filter', scanResult.filterType],
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
                  <p className="text-xs font-semibold text-foreground">No model label visible</p>
                  <p className="text-[11px] text-muted-foreground">Skip the plate photo. Brand/Model stay editable below; we'll save a note explaining why.</p>
                </div>
              </label>
              {noLabel && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Reason <span className="text-status-urgent">*</span>
                    </label>
                    <select
                      value={noLabelReason}
                      onChange={(e) => setNoLabelReason(e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-xs text-foreground"
                    >
                      <option value="">Select a reason…</option>
                      {NO_LABEL_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {!noLabelReason && (
                      <p className="mt-1 text-[10px] text-status-urgent">Required when no plate photo is provided.</p>
                    )}
                  </div>
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
                { label: 'Brand', value: brand, setter: setBrand },
                { label: 'Model', value: model, setter: setModel },
                { label: 'Serial Number', value: serialNumber, setter: setSerialNumber },
                { label: 'Filter Type', value: filterType, setter: setFilterType },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={label === 'Serial Number' ? 'Leave blank if no label' : ''}
                    className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm fixture type (double-check) */}
      {step === 3 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Confirm fixture type</p>
              <p className="text-xs text-muted-foreground">
                {suggestedCategory ? `Suggested: ${fixtureCategoryMeta[suggestedCategory].label}` : 'Pick the best match.'}
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {scanned ? 'From analysis' : 'Manual'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(fixtureCategoryMeta) as FixtureCategory[]).map((id) => {
              const meta = fixtureCategoryMeta[id];
              const active = category === id;
              return (
                <div
                  key={id}
                  className={`relative rounded-2xl border p-3 transition-colors ${
                    active ? 'border-accent bg-accent/10' : 'bg-card hover:bg-secondary/20'
                  }`}
                >
                  {/* Help icon (separate hit target) */}
                  <button
                    type="button"
                    onClick={() => setCategoryHelp(id)}
                    className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    aria-label={`Help: ${meta.label}`}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>

                  {/* Selected indicator mirrors help placement for spatial consistency */}
                  {active && (
                    <div className="absolute left-2 top-2 rounded-full bg-accent/15 p-2 text-accent" aria-hidden="true">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setCategory(id)}
                    aria-pressed={active}
                    className="block w-full text-left"
                  >
                    <div className="pr-10 pt-6">
                      <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{meta.examples[0]}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {categoryHelp && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fixtureCategoryMeta[categoryHelp].label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Examples: {fixtureCategoryMeta[categoryHelp].examples.join(' • ')}
                  </p>
                  {fixtureCategoryMeta[categoryHelp].hints?.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Hint: {fixtureCategoryMeta[categoryHelp].hints?.join(' • ')}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => setCategoryHelp(null)}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {fixtureCategoryMeta[categoryHelp].examples.slice(0, 2).map((ex) => (
                  <div key={ex} className="overflow-hidden rounded-xl border bg-secondary/20">
                    <img
                      alt={ex}
                      className="h-28 w-full object-cover"
                      src={`https://placehold.co/600x400/111827/ffffff?text=${encodeURIComponent(ex)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Rate + observations (quick) */}
      {step === 4 && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquareWarning className="h-4 w-4" />
              <p className="text-sm">Optional: rate & note any issues</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Water Pressure</label>
            <StarRating value={pressure} onChange={setPressure} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Cleanliness</label>
            <StarRating value={cleanliness} onChange={setCleanliness} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Quick issues</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {['rust', 'low_flow', 'noisy', 'dirty', 'clogged_filter'].map((id) => {
                const active = issues.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => setIssues((prev) => (active ? prev.filter((x) => x !== id) : [...prev, id]))}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="e.g. rusted fixture, low pressure, needs wipe..."
              className="mt-1 w-full min-h-[90px] rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground"
            />
          </div>
        </div>
      )}

      {/* Step 5: Final location confirmation (required) */}
      {step === 5 && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-semibold text-foreground">⚠ Confirm exact location</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Verify everything below — once saved, this fixture is locked to this location.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Campus</span><span className="font-semibold text-foreground text-right">{selectedCampus ? `${selectedCampus.school} — ${selectedCampus.name}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span className="font-semibold text-foreground text-right">{selectedBuilding?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Floor</span><span className="font-semibold text-foreground">{floor || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Room / landmark</span><span className="font-semibold text-foreground text-right">{nearestRoom || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fixture type</span><span className="font-semibold text-foreground">{category ? fixtureCategoryMeta[category].label : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Brand / Model</span><span className="font-semibold text-foreground text-right">{(brand || '—')} {model && `· ${model}`}</span></div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Nearest fixture ID <span className="text-muted-foreground font-normal">(for reference)</span></label>
            <input
              value={nearestFixtureId}
              onChange={(e) => setNearestFixtureId(e.target.value)}
              placeholder="e.g. F-0123 — the closest already-tagged fixture"
              className="mt-1 w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground"
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

          <label className={`flex items-start gap-2 rounded-xl border p-3 ${step5Ready ? 'bg-card cursor-pointer' : 'bg-muted/30 cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              checked={locationConfirmed}
              disabled={!step5Ready}
              onChange={(e) => setLocationConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-foreground">
              I confirm the campus, building, floor, room and nearest fixture ID above are correct for this fixture.
            </span>
          </label>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="flex-1" />
        {step < 5 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed[step]} className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canProceed[5]} className="flex items-center gap-1 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" /> Save Fixture
          </button>
        )}
      </div>

      {/* Post-save: Are you done with this floor? */}
      {postSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => { setPostSaveOpen(false); navigate('/'); }}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-foreground">Fixture saved ✓</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Are you done collecting fixtures on Floor {floor}?
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  // Stay in onboard mode for another fixture on the same floor
                  setPhoto(null); setPlatePhoto(null); setBrand(''); setModel(''); setSerialNumber('');
                  setFilterType(''); setScanned(false); setScanError(null); setScanResult(null); setCategory(null); setSuggestedCategory(null);
                  setObservations(''); setIssues([]); setNearestRoom('');
                  setNoLabel(false); setNoLabelReason(''); setNearestFixtureId(''); setLocationConfirmed(false);
                  setStep(1);
                  setStep(1);
                  setPostSaveOpen(false);
                }}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                Add another on Floor {floor}
              </button>
              <button
                onClick={async () => {
                  if (selectedBuildingId && floor) {
                    await setFloorStatus(selectedBuildingId, parseInt(floor), 'Done');
                    toast.success(`Floor ${floor} marked as Done`);
                  }
                  setPostSaveOpen(false);
                  navigate('/campus');
                }}
                className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
              >
                Yes — mark Floor {floor} done
              </button>
              <button
                onClick={() => { setPostSaveOpen(false); navigate('/'); }}
                className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground"
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
