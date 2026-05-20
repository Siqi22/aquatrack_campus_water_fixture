import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { ImportAnalysis, ImportOptions, ImportResult } from '@/lib/importCSV';
import {
  parseCampusLabel,
  estimateBuildingFloors,
  resolveExistingFixtureId,
  buildExistingFixtureIndex,
} from '@/lib/importCSV';

export type FixtureStatus = 'Good' | 'Warning' | 'Urgent';
export type UserRole = 'Surveyor' | 'Facilities';
export type FloorStatus = 'NotStarted' | 'InProgress' | 'Done' | 'Restricted';

export type FixtureCategory =
  | 'BottleFiller'
  | 'WallFountain'
  | 'CombinationUnit'
  | 'FilteredTap'
  | 'Other';

export const fixtureCategoryMeta: Record<
  FixtureCategory,
  { label: string; examples: string[]; hints?: string[] }
> = {
  BottleFiller: {
    label: 'Bottle filler',
    examples: ['Metal Elkay EZH2O', 'Stainless bottle station', 'Sensor bottle filler'],
    hints: ['Often near restrooms'],
  },
  WallFountain: {
    label: 'Wall fountain',
    examples: ['Porcelain wall fountain', 'Metal wall fountain'],
    hints: ['Often near restrooms'],
  },
  CombinationUnit: {
    label: 'Combo unit',
    examples: ['Bottle filler + fountain', 'EZH2O combo'],
    hints: ['Often near restrooms'],
  },
  FilteredTap: {
    label: 'Filtered tap / sink',
    examples: ['Filtered kitchen tap', 'Filtered lab sink tap'],
  },
  Other: {
    label: 'Other',
    examples: ['Unknown type', 'Temporary setup'],
  },
};

export interface QualityRating {
  pressure: number;
  cleanliness: number;
}

export interface Fixture {
  id: string;
  campusId: string;
  buildingId: string;
  buildingName: string;
  floor: string;
  roomNumber: string;
  nearestRoom?: string;
  brand: string;
  model: string;
  serialNumber: string;
  photoURL: string;
  modelPlatePhotoURL: string;
  lastMaintenanceDate: string;
  filterType: string;
  installationDate?: string;
  category: FixtureCategory;
  qualityRating: QualityRating;
  observations?: string;
  issues?: string[];
  posX?: number;
  posY?: number;
  // Audit + no-label tracking
  noLabelReason?: string;
  noLabelReasonOther?: string;
  photosProvided?: string[];
  locationConfirmed?: boolean;
  savedByName?: string;
}

export interface Building {
  id: string;
  campusId: string;
  name: string;
  floors: number;
  collectionStartedAt?: string;
  collectionEndedAt?: string;
}

export interface Campus {
  id: string;
  name: string;
  school: string;
  address: string;
}

export interface BuildingFloorProgress {
  buildingId: string;
  floor: string;
  status: FloorStatus;
  restrictedReason?: string;
  startedAt?: string;
  endedAt?: string;
  notes?: string;
}

export function getFixtureStatus(lastMaintenanceDate: string): FixtureStatus {
  const last = new Date(lastMaintenanceDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 180) return 'Urgent';
  if (diffDays > 120) return 'Warning';
  return 'Good';
}

export function getDaysSinceMaintenance(lastMaintenanceDate: string): number {
  const last = new Date(lastMaintenanceDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// DB <-> domain mappers
// ============================================================
type CampusRow = Database['public']['Tables']['campuses']['Row'];
type BuildingRow = Database['public']['Tables']['buildings']['Row'];
type FixtureRow = Database['public']['Tables']['fixtures']['Row'];
type FloorProgressRow = Database['public']['Tables']['floor_progress']['Row'];

function mapCampus(r: CampusRow): Campus {
  return { id: r.id, name: r.name, school: r.school, address: r.address ?? '' };
}
function mapBuilding(r: BuildingRow): Building {
  return {
    id: r.id,
    campusId: r.campus_id,
    name: r.name,
    floors: r.floors ?? 1,
    collectionStartedAt: r.collection_started_at ?? undefined,
    collectionEndedAt: r.collection_ended_at ?? undefined,
  };
}
function mapFixture(r: FixtureRow, buildingName: string): Fixture {
  return {
    id: r.id,
    campusId: r.campus_id,
    buildingId: r.building_id,
    buildingName,
    floor: String(r.floor),
    roomNumber: r.room_number,
    nearestRoom: r.nearest_room ?? r.room_number,
    brand: r.brand ?? '',
    model: r.model ?? '',
    serialNumber: r.serial_number ?? '',
    photoURL: r.photo_url ?? '',
    modelPlatePhotoURL: r.model_plate_photo_url ?? '',
    lastMaintenanceDate: r.last_maintenance_date,
    filterType: r.filter_type ?? '',
    installationDate: r.installation_date ?? undefined,
    category: (r.category as FixtureCategory) ?? 'Other',
    qualityRating: { pressure: r.pressure_rating ?? 3, cleanliness: r.cleanliness_rating ?? 3 },
    observations: r.observations ?? undefined,
    issues: r.issues ?? undefined,
    posX: r.pos_x != null ? Number(r.pos_x) : undefined,
    posY: r.pos_y != null ? Number(r.pos_y) : undefined,
    noLabelReason: (r as { no_label_reason?: string | null }).no_label_reason ?? undefined,
    noLabelReasonOther: (r as { no_label_reason_other?: string | null }).no_label_reason_other ?? undefined,
    photosProvided: (r as { photos_provided?: string[] | null }).photos_provided ?? undefined,
    locationConfirmed: (r as { location_confirmed?: boolean | null }).location_confirmed ?? undefined,
    savedByName: (r as { saved_by_name?: string | null }).saved_by_name ?? undefined,
  };
}
function mapFloorProgress(r: FloorProgressRow): BuildingFloorProgress {
  return {
    buildingId: r.building_id,
    floor: String(r.floor),
    status: r.status as FloorStatus,
    restrictedReason: r.restricted_reason ?? undefined,
    startedAt: r.started_at ?? undefined,
    endedAt: r.ended_at ?? undefined,
    notes: r.notes ?? undefined,
  };
}

// ============================================================
// Store
// ============================================================
interface FixtureStore {
  loading: boolean;
  loaded: boolean;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  campuses: Campus[];
  buildings: Building[];
  fixtures: Fixture[];
  floorProgress: BuildingFloorProgress[];
  loadAll: () => Promise<void>;
  reset: () => void;
  addCampus: (campus: Omit<Campus, 'id'> & { id?: string }) => Promise<Campus | null>;
  addBuilding: (building: Omit<Building, 'id'> & { id?: string }) => Promise<Building | null>;
  addFixture: (fixture: Omit<Fixture, 'id'> & { id?: string }) => Promise<Fixture | null>;
  updateFixture: (fixture: Fixture) => Promise<void>;
  completeService: (fixtureId: string) => Promise<void>;
  setFloorStatus: (
    buildingId: string,
    floor: string,
    status: FloorStatus,
    opts?: { restrictedReason?: string },
  ) => Promise<void>;
  getFloorProgress: (buildingId: string, floor: string) => BuildingFloorProgress;
  getFloorsByBuilding: (buildingId: string) => BuildingFloorProgress[];
  searchFixtures: (query: string) => Fixture[];
  getFixturesByBuilding: (buildingId: string) => Fixture[];
  getFixturesByBuildingAndFloor: (buildingId: string, floor: string) => Fixture[];
  getBuildingsByCampus: (campusId: string) => Building[];
  getFixturesByCampus: (campusId: string) => Fixture[];
  getMaintenanceTasks: () => Fixture[];
  getFixtureById: (id: string) => Fixture | undefined;
  importFromAnalysis: (analysis: ImportAnalysis, options?: ImportOptions) => Promise<ImportResult>;
}

const ROLE_KEY = 'aquaTrack:userRole';

function loadRole(): UserRole {
  try {
    const v = localStorage.getItem(ROLE_KEY);
    return v === 'Facilities' ? 'Facilities' : 'Surveyor';
  } catch {
    return 'Surveyor';
  }
}

function saveRole(role: UserRole) {
  try { localStorage.setItem(ROLE_KEY, role); } catch { /* ignore */ }
}

export const useFixtureStore = create<FixtureStore>((set, get) => ({
  loading: false,
  loaded: false,
  userRole: loadRole(),
  campuses: [],
  buildings: [],
  fixtures: [],
  floorProgress: [],

  setUserRole: (role) => {
    saveRole(role);
    set({ userRole: role });
  },

  reset: () => set({ loaded: false, campuses: [], buildings: [], fixtures: [], floorProgress: [] }),

  loadAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [campusesRes, buildingsRes, fixturesRes, fpRes] = await Promise.all([
        supabase.from('campuses').select('*').order('created_at', { ascending: true }),
        supabase.from('buildings').select('*').order('created_at', { ascending: true }),
        supabase.from('fixtures').select('*').order('created_at', { ascending: true }),
        supabase.from('floor_progress').select('*'),
      ]);

      if (campusesRes.error) throw campusesRes.error;
      if (buildingsRes.error) throw buildingsRes.error;
      if (fixturesRes.error) throw fixturesRes.error;
      if (fpRes.error) throw fpRes.error;

      const campuses = (campusesRes.data ?? []).map(mapCampus);
      const buildings = (buildingsRes.data ?? []).map(mapBuilding);
      const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));
      const fixtures = (fixturesRes.data ?? []).map((r) => mapFixture(r, buildingNameById.get(r.building_id) ?? ''));
      const floorProgress = (fpRes.data ?? []).map(mapFloorProgress);

      // Auto-create floor_progress rows for missing (building, floor) combos so the UI has something to show.
      const existing = new Set(floorProgress.map((p) => `${p.buildingId}:${p.floor}`));
      const missing: { building_id: string; floor: string; status: FloorStatus }[] = [];
      for (const b of buildings) {
        for (let fl = 1; fl <= b.floors; fl++) {
          const key = String(fl);
          if (!existing.has(`${b.id}:${key}`)) missing.push({ building_id: b.id, floor: key, status: 'NotStarted' });
        }
      }
      if (missing.length) {
        const { data: inserted } = await supabase.from('floor_progress').insert(missing).select('*');
        if (inserted) floorProgress.push(...inserted.map(mapFloorProgress));
      }

      // First-run seed: if user has no campuses at all, seed a starter campus.
      if (campuses.length === 0) {
        const { data: seed } = await supabase
          .from('campuses')
          .insert({ name: 'Main Campus', school: 'My University', address: '' })
          .select('*')
          .single();
        if (seed) campuses.push(mapCampus(seed));
      }

      set({ campuses, buildings, fixtures, floorProgress, loaded: true });
    } catch (e) {
      console.error('loadAll failed', e);
    } finally {
      set({ loading: false });
    }
  },

  addCampus: async (campus) => {
    const { data, error } = await supabase
      .from('campuses')
      .insert({ name: campus.name, school: campus.school, address: campus.address })
      .select('*')
      .single();
    if (error || !data) { console.error(error); return null; }
    const next = mapCampus(data);
    set((s) => ({ campuses: [...s.campuses, next] }));
    return next;
  },

  addBuilding: async (building) => {
    const { data, error } = await supabase
      .from('buildings')
      .insert({ campus_id: building.campusId, name: building.name, floors: building.floors })
      .select('*')
      .single();
    if (error || !data) { console.error(error); return null; }
    const next = mapBuilding(data);
    // Seed floor_progress for this building.
    const fpRows = Array.from({ length: next.floors }, (_, i) => ({
      building_id: next.id, floor: String(i + 1), status: 'NotStarted' as FloorStatus,
    }));
    const { data: fpInserted } = await supabase.from('floor_progress').insert(fpRows).select('*');
    set((s) => ({
      buildings: [...s.buildings, next],
      floorProgress: [...s.floorProgress, ...(fpInserted ?? []).map(mapFloorProgress)],
    }));
    return next;
  },

  addFixture: async (f) => {
    const floorKey = String(f.floor).trim();
    const existingFp = get().floorProgress.find((p) => p.buildingId === f.buildingId && p.floor === floorKey);
    if (!existingFp) {
      const { data: inserted } = await supabase
        .from('floor_progress')
        .insert({ building_id: f.buildingId, floor: floorKey, status: 'NotStarted' })
        .select('*')
        .maybeSingle();
      if (inserted) {
        set((s) => ({ floorProgress: [...s.floorProgress, mapFloorProgress(inserted)] }));
      }
    }

    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp?.user?.id ?? null;
    let savedByName: string | null = f.savedByName ?? null;
    if (!savedByName && userId) {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle();
      savedByName = profile?.display_name ?? userResp?.user?.email ?? null;
    }
    const { data, error } = await supabase
      .from('fixtures')
      .insert({
        campus_id: f.campusId,
        building_id: f.buildingId,
        floor: floorKey,
        room_number: f.roomNumber,
        nearest_room: f.nearestRoom ?? f.roomNumber,
        brand: f.brand,
        model: f.model,
        serial_number: f.serialNumber,
        filter_type: f.filterType,
        category: f.category,
        pressure_rating: f.qualityRating.pressure,
        cleanliness_rating: f.qualityRating.cleanliness,
        observations: f.observations ?? null,
        issues: f.issues ?? null,
        photo_url: f.photoURL || null,
        model_plate_photo_url: f.modelPlatePhotoURL || null,
        installation_date: f.installationDate ?? null,
        last_maintenance_date: f.lastMaintenanceDate,
        created_by: userId,
        no_label_reason: f.noLabelReason ?? null,
        no_label_reason_other: f.noLabelReasonOther ?? null,
        photos_provided: f.photosProvided ?? null,
        location_confirmed: f.locationConfirmed ?? false,
        saved_by_name: savedByName,
      } as never)
      .select('*')
      .single();
    if (error || !data) { console.error(error); return null; }
    const buildingName = get().buildings.find((b) => b.id === data.building_id)?.name ?? f.buildingName;
    const next = mapFixture(data, buildingName);

    // Auto-advance floor status NotStarted -> InProgress
    const fp = get().floorProgress.find((p) => p.buildingId === f.buildingId && p.floor === floorKey);
    if (fp && fp.status === 'NotStarted') {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('floor_progress')
        .update({ status: 'InProgress', started_at: today })
        .eq('building_id', f.buildingId)
        .eq('floor', floorKey);
      set((s) => ({
        floorProgress: s.floorProgress.map((p) =>
          p.buildingId === f.buildingId && p.floor === floorKey ? { ...p, status: 'InProgress', startedAt: today } : p,
        ),
      }));
    }

    set((s) => ({ fixtures: [...s.fixtures, next] }));
    return next;
  },

  updateFixture: async (f) => {
    const { error } = await supabase.from('fixtures').update({
      room_number: f.roomNumber,
      nearest_room: f.nearestRoom ?? f.roomNumber,
      brand: f.brand,
      model: f.model,
      serial_number: f.serialNumber,
      filter_type: f.filterType,
      category: f.category,
      pressure_rating: f.qualityRating.pressure,
      cleanliness_rating: f.qualityRating.cleanliness,
      observations: f.observations ?? null,
      issues: f.issues ?? null,
      photo_url: f.photoURL || null,
      model_plate_photo_url: f.modelPlatePhotoURL || null,
    }).eq('id', f.id);
    if (error) { console.error(error); return; }
    set((s) => ({ fixtures: s.fixtures.map((x) => (x.id === f.id ? f : x)) }));
  },

  completeService: async (fixtureId) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('fixtures').update({ last_maintenance_date: today }).eq('id', fixtureId);
    if (error) { console.error(error); return; }
    set((s) => ({
      fixtures: s.fixtures.map((f) => (f.id === fixtureId ? { ...f, lastMaintenanceDate: today } : f)),
    }));
  },

  setFloorStatus: async (buildingId, floor, status, opts) => {
    const today = new Date().toISOString().slice(0, 10);
    const patch: Database['public']['Tables']['floor_progress']['Update'] = {
      status,
      restricted_reason: status === 'Restricted' ? (opts?.restrictedReason ?? null) : null,
      started_at: status !== 'NotStarted' ? today : null,
      ended_at: status === 'Done' || status === 'Restricted' ? today : null,
    };
    const { error } = await supabase.from('floor_progress').update(patch).eq('building_id', buildingId).eq('floor', floor);
    if (error) { console.error(error); return; }
    set((s) => ({
      floorProgress: s.floorProgress.map((p) =>
        p.buildingId === buildingId && p.floor === floor
          ? { ...p, status, restrictedReason: patch.restricted_reason ?? undefined, startedAt: patch.started_at ?? undefined, endedAt: patch.ended_at ?? undefined }
          : p,
      ),
    }));
  },

  getFloorProgress: (buildingId, floor) => {
    const key = String(floor).trim();
    return get().floorProgress.find((p) => p.buildingId === buildingId && p.floor === key) ?? {
      buildingId, floor: key, status: 'NotStarted',
    };
  },
  getFloorsByBuilding: (buildingId) =>
    get().floorProgress
      .filter((p) => p.buildingId === buildingId)
      .sort((a, c) => a.floor.localeCompare(c.floor, undefined, { numeric: true })),
  searchFixtures: (query) => {
    const q = query.toLowerCase();
    return get().fixtures.filter(
      (f) =>
        f.roomNumber.toLowerCase().includes(q) ||
        (f.nearestRoom ?? '').toLowerCase().includes(q) ||
        f.model.toLowerCase().includes(q) ||
        f.brand.toLowerCase().includes(q) ||
        f.buildingName.toLowerCase().includes(q),
    );
  },
  getFixturesByBuilding: (buildingId) => get().fixtures.filter((f) => f.buildingId === buildingId),
  getFixturesByBuildingAndFloor: (buildingId, floor) =>
    get().fixtures.filter((f) => f.buildingId === buildingId && f.floor === floor),
  getBuildingsByCampus: (campusId) => get().buildings.filter((b) => b.campusId === campusId),
  getFixturesByCampus: (campusId) => get().fixtures.filter((f) => f.campusId === campusId),
  getMaintenanceTasks: () => get().fixtures.filter((f) => getDaysSinceMaintenance(f.lastMaintenanceDate) > 150),
  getFixtureById: (id) => get().fixtures.find((f) => f.id === id),

  importFromAnalysis: async (analysis, options) => {
    const mode = options?.mode ?? 'skip_duplicates';
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp?.user?.id ?? null;

    let campusesCreated = 0;
    let buildingsCreated = 0;
    let fixturesUpdated = 0;
    let fixturesSkippedDuplicates = 0;

    const index = buildExistingFixtureIndex(get().fixtures, get().campuses);

    const campusKey = (label: string) => label.trim().toLowerCase();
    const buildingKey = (campusLabel: string, buildingName: string) =>
      `${campusKey(campusLabel)}::${buildingName.trim().toLowerCase()}`;

    const campusIdByLabel = new Map<string, string>();
    const buildingIdByKey = new Map<string, string>();

    for (const label of analysis.campusLabels) {
      const parsed = parseCampusLabel(label);
      const existing = get().campuses.find(
        (c) =>
          c.name.toLowerCase() === parsed.name.toLowerCase() &&
          c.school.toLowerCase() === parsed.school.toLowerCase(),
      );
      if (existing) {
        campusIdByLabel.set(campusKey(label), existing.id);
        continue;
      }
      const created = await get().addCampus({ name: parsed.name, school: parsed.school, address: '' });
      if (created) {
        campusesCreated++;
        campusIdByLabel.set(campusKey(label), created.id);
      }
    }

    const buildingNames = new Map<string, { campusLabel: string; buildingName: string }>();
    for (const f of analysis.fixtures) {
      buildingNames.set(buildingKey(f.campusLabel, f.buildingName), {
        campusLabel: f.campusLabel,
        buildingName: f.buildingName,
      });
    }
    for (const l of analysis.floorLocks) {
      buildingNames.set(buildingKey(l.campusLabel, l.buildingName), {
        campusLabel: l.campusLabel,
        buildingName: l.buildingName,
      });
    }

    for (const [key, { campusLabel, buildingName }] of buildingNames) {
      const campusId = campusIdByLabel.get(campusKey(campusLabel));
      if (!campusId) continue;

      const existing = get().buildings.find(
        (b) => b.campusId === campusId && b.name.toLowerCase() === buildingName.toLowerCase(),
      );
      if (existing) {
        buildingIdByKey.set(key, existing.id);
        continue;
      }

      const floorCount = estimateBuildingFloors(analysis.fixtures, analysis.floorLocks, campusLabel, buildingName);
      const created = await get().addBuilding({ campusId, name: buildingName, floors: floorCount });
      if (created) {
        buildingsCreated++;
        buildingIdByKey.set(key, created.id);
      }
    }

    const existingFp = new Set(get().floorProgress.map((p) => `${p.buildingId}:${p.floor}`));
    const fpToInsert: { building_id: string; floor: string; status: FloorStatus }[] = [];

    const registerFloor = (campusLabel: string, buildingName: string, floor: string) => {
      const bId = buildingIdByKey.get(buildingKey(campusLabel, buildingName));
      if (!bId) return;
      const fpKey = `${bId}:${floor}`;
      if (existingFp.has(fpKey)) return;
      existingFp.add(fpKey);
      fpToInsert.push({ building_id: bId, floor, status: 'NotStarted' });
    };

    for (const f of analysis.fixtures) registerFloor(f.campusLabel, f.buildingName, f.floor);
    for (const l of analysis.floorLocks) registerFloor(l.campusLabel, l.buildingName, l.floor);

    if (fpToInsert.length) {
      await supabase.from('floor_progress').insert(fpToInsert);
    }

    type FixtureInsert = Database['public']['Tables']['fixtures']['Insert'];
    const rows: FixtureInsert[] = [];
    const updates: Array<{ id: string; patch: Database['public']['Tables']['fixtures']['Update'] }> = [];

    for (const f of analysis.fixtures) {
      const campusId = campusIdByLabel.get(campusKey(f.campusLabel));
      const buildingId = buildingIdByKey.get(buildingKey(f.campusLabel, f.buildingName));
      if (!campusId || !buildingId) continue;

      const existingId = resolveExistingFixtureId(f, index);
      const patch = {
        floor: f.floor,
        room_number: f.nearestRoom,
        nearest_room: f.nearestRoom,
        brand: f.brand || null,
        model: f.model || null,
        serial_number: f.serialNumber || null,
        filter_type: f.filterType || null,
        category: f.category,
        pressure_rating: f.pressure,
        cleanliness_rating: f.cleanliness,
        observations: f.observations ?? null,
        issues: f.issues ?? null,
        last_maintenance_date: f.lastMaintenanceDate,
        installation_date: f.installationDate ?? null,
        location_confirmed: true,
      };

      if (existingId) {
        if (mode === 'skip_duplicates') {
          fixturesSkippedDuplicates++;
          continue;
        }
        if (mode === 'update_existing') {
          updates.push({ id: existingId, patch });
          continue;
        }
      }

      rows.push({
        campus_id: campusId,
        building_id: buildingId,
        ...patch,
        created_by: userId,
        photos_provided: [],
      });
    }

    for (const { id, patch } of updates) {
      const { error } = await supabase.from('fixtures').update(patch).eq('id', id);
      if (error) throw error;
      fixturesUpdated++;
    }

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('fixtures').insert(batch);
      if (error) throw error;
    }

    const lockMap = new Map<string, { buildingId: string; floor: string; reason: string }>();
    for (const l of analysis.floorLocks) {
      const buildingId = buildingIdByKey.get(buildingKey(l.campusLabel, l.buildingName));
      if (!buildingId) continue;
      lockMap.set(`${buildingId}:${l.floor}`, {
        buildingId,
        floor: l.floor,
        reason: l.reason,
      });
    }

    let floorsLocked = 0;
    for (const lock of lockMap.values()) {
      await get().setFloorStatus(lock.buildingId, lock.floor, 'Restricted', {
        restrictedReason: lock.reason,
      });
      floorsLocked++;
    }

    await get().loadAll();

    return {
      campusesCreated,
      buildingsCreated,
      fixturesImported: rows.length,
      fixturesUpdated,
      fixturesSkippedDuplicates,
      floorsLocked,
      skipped: analysis.skipped.length,
    };
  },
}));
