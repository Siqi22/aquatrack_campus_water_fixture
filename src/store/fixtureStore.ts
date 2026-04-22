import { create } from 'zustand';

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
  floor: number;
  roomNumber: string;
  /**
   * Nearest room or landmark to the fixture.
   * Defaults to `roomNumber` for legacy data.
   */
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
  floor: number;
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

const mockCampuses: Campus[] = [
  { id: 'c1', name: 'Main Campus', school: 'State University', address: '123 University Ave' },
  { id: 'c2', name: 'North Campus', school: 'State University', address: '456 College Blvd' },
  { id: 'c3', name: 'Downtown Campus', school: 'City College', address: '789 Main St' },
];

const mockBuildings: Building[] = [
  { id: 'b1', campusId: 'c1', name: 'Engineering Hall', floors: 4 },
  { id: 'b2', campusId: 'c1', name: 'Science Center', floors: 3 },
  { id: 'b3', campusId: 'c2', name: 'Student Union', floors: 2 },
  { id: 'b4', campusId: 'c3', name: 'Arts Building', floors: 3 },
];

const mockFixtures: Fixture[] = [
  {
    id: 'f1',
    campusId: 'c1',
    buildingId: 'b1',
    buildingName: 'Engineering Hall',
    floor: 1,
    roomNumber: '101',
    nearestRoom: '101 (near restroom)',
    brand: 'Elkay',
    model: 'EZH2O',
    serialNumber: 'ELK-2024-001',
    photoURL: '',
    modelPlatePhotoURL: '',
    lastMaintenanceDate: '2025-11-01',
    filterType: 'WaterSentry Plus',
    installationDate: '2023-06-15',
    category: 'CombinationUnit',
    qualityRating: { pressure: 4, cleanliness: 5 },
    observations: 'Looks clean; mild splash',
    issues: [],
    posX: 20,
    posY: 30,
  },
  {
    id: 'f2',
    campusId: 'c1',
    buildingId: 'b1',
    buildingName: 'Engineering Hall',
    floor: 2,
    roomNumber: '205',
    nearestRoom: '205',
    brand: 'Elkay',
    model: 'LZS8WSLK',
    serialNumber: 'ELK-2024-002',
    photoURL: '',
    modelPlatePhotoURL: '',
    lastMaintenanceDate: '2026-03-15',
    filterType: 'WaterSentry Plus',
    installationDate: '2024-01-10',
    category: 'BottleFiller',
    qualityRating: { pressure: 3, cleanliness: 4 },
    observations: 'Low flow; slight rust on spout',
    issues: ['low_flow', 'rust'],
    posX: 65,
    posY: 45,
  },
  {
    id: 'f3',
    campusId: 'c1',
    buildingId: 'b2',
    buildingName: 'Science Center',
    floor: 1,
    roomNumber: '110',
    nearestRoom: '110 (by restroom)',
    brand: 'Halsey Taylor',
    model: 'HydroBoost',
    serialNumber: 'HT-2024-001',
    photoURL: '',
    modelPlatePhotoURL: '',
    lastMaintenanceDate: '2025-08-20',
    filterType: 'HydroBoost Filter',
    installationDate: '2022-09-01',
    category: 'WallFountain',
    qualityRating: { pressure: 2, cleanliness: 3 },
    observations: 'Noisy; needs wipe',
    issues: ['noisy'],
    posX: 40,
    posY: 60,
  },
  {
    id: 'f4',
    campusId: 'c2',
    buildingId: 'b3',
    buildingName: 'Student Union',
    floor: 1,
    roomNumber: '102',
    nearestRoom: '102',
    brand: 'Elkay',
    model: 'LZWSRK',
    serialNumber: 'ELK-2024-003',
    photoURL: '',
    modelPlatePhotoURL: '',
    lastMaintenanceDate: '2026-04-01',
    filterType: 'WaterSentry VII',
    installationDate: '2024-08-01',
    category: 'BottleFiller',
    qualityRating: { pressure: 5, cleanliness: 5 },
    observations: 'Great condition',
    issues: [],
    posX: 50,
    posY: 50,
  },
  {
    id: 'f5',
    campusId: 'c3',
    buildingId: 'b4',
    buildingName: 'Arts Building',
    floor: 3,
    roomNumber: '310',
    nearestRoom: '310',
    brand: 'Oasis',
    model: 'PWEBF',
    serialNumber: 'OAS-2024-001',
    photoURL: '',
    modelPlatePhotoURL: '',
    lastMaintenanceDate: '2025-06-01',
    filterType: 'Oasis Standard',
    installationDate: '2023-03-20',
    category: 'Other',
    qualityRating: { pressure: 4, cleanliness: 2 },
    observations: 'Needs cleaning',
    issues: ['dirty'],
    posX: 75,
    posY: 25,
  },
];

interface FixtureStore {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  campuses: Campus[];
  buildings: Building[];
  fixtures: Fixture[];
  floorProgress: BuildingFloorProgress[];
  addCampus: (campus: Campus) => void;
  addBuilding: (building: Building) => void;
  addFixture: (fixture: Fixture) => void;
  updateFixture: (fixture: Fixture) => void;
  completeService: (fixtureId: string) => void;
  setFloorStatus: (buildingId: string, floor: number, status: FloorStatus, opts?: { restrictedReason?: string }) => void;
  getFloorProgress: (buildingId: string, floor: number) => BuildingFloorProgress;
  getFloorsByBuilding: (buildingId: string) => BuildingFloorProgress[];
  searchFixtures: (query: string) => Fixture[];
  getFixturesByBuilding: (buildingId: string) => Fixture[];
  getFixturesByBuildingAndFloor: (buildingId: string, floor: number) => Fixture[];
  getBuildingsByCampus: (campusId: string) => Building[];
  getFixturesByCampus: (campusId: string) => Fixture[];
  getMaintenanceTasks: () => Fixture[];
  getFixtureById: (id: string) => Fixture | undefined;
}

const STORAGE_KEY = 'aquaTrack:fixtureStore:v1';

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type PersistedState = Pick<
  FixtureStore,
  'userRole' | 'campuses' | 'buildings' | 'fixtures' | 'floorProgress'
>;

function normalizeCategory(input: unknown): FixtureCategory {
  if (
    input === 'BottleFiller' ||
    input === 'WallFountain' ||
    input === 'CombinationUnit' ||
    input === 'FilteredTap' ||
    input === 'Other'
  ) {
    return input;
  }
  // Legacy values from earlier demo builds.
  if (input === 'Public' || input === 'Private') return 'BottleFiller';
  return 'Other';
}

type PersistedStateRaw = Partial<{
  userRole: unknown;
  campuses: unknown;
  buildings: unknown;
  fixtures: unknown;
  floorProgress: unknown;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function migrateFixtures(fixtures: unknown[]): Fixture[] {
  return fixtures
    .filter(isRecord)
    .map((f) => {
      const base = f as unknown as Fixture;
      const nearestRoom =
        (typeof f.nearestRoom === 'string' && f.nearestRoom.length > 0
          ? f.nearestRoom
          : typeof f.roomNumber === 'string'
            ? f.roomNumber
            : '') || undefined;

      return {
        ...base,
        category: normalizeCategory(f.category),
        nearestRoom,
        installationDate: typeof (f as Record<string, unknown>).installationDate === 'string' ? (f as Record<string, unknown>).installationDate as string : undefined,
        observations: typeof f.observations === 'string' ? f.observations : undefined,
        issues: Array.isArray(f.issues) ? (f.issues.filter((x): x is string => typeof x === 'string') as string[]) : undefined,
      };
    });
}

function ensureFloorProgress(buildings: Building[], fixtures: Fixture[], existing: BuildingFloorProgress[] | undefined) {
  const mapKey = (bId: string, fl: number) => `${bId}:${fl}`;
  const existingMap = new Map<string, BuildingFloorProgress>();
  (existing ?? []).forEach((p) => existingMap.set(mapKey(p.buildingId, p.floor), p));

  const byBuildingFloorCount = new Map<string, number>();
  fixtures.forEach((f) => {
    const k = mapKey(f.buildingId, f.floor);
    byBuildingFloorCount.set(k, (byBuildingFloorCount.get(k) ?? 0) + 1);
  });

  const progress: BuildingFloorProgress[] = [];
  for (const b of buildings) {
    for (let fl = 1; fl <= b.floors; fl++) {
      const k = mapKey(b.id, fl);
      const existingProgress = existingMap.get(k);
      if (existingProgress) {
        progress.push(existingProgress);
        continue;
      }
      const fixtureCount = byBuildingFloorCount.get(k) ?? 0;
      progress.push({
        buildingId: b.id,
        floor: fl,
        status: fixtureCount > 0 ? 'InProgress' : 'NotStarted',
        startedAt: fixtureCount > 0 ? new Date().toISOString().split('T')[0] : undefined,
      });
    }
  }
  return progress;
}

function deriveBuildingCollection(buildings: Building[], floorProgress: BuildingFloorProgress[]) {
  const floorByBuilding = new Map<string, BuildingFloorProgress[]>();
  for (const fp of floorProgress) {
    const arr = floorByBuilding.get(fp.buildingId) ?? [];
    arr.push(fp);
    floorByBuilding.set(fp.buildingId, arr);
  }

  return buildings.map((b) => {
    const floors = (floorByBuilding.get(b.id) ?? []).slice().sort((a, c) => a.floor - c.floor);
    const started = floors.find((f) => f.status !== 'NotStarted')?.startedAt;
    const doneCount = floors.filter((f) => f.status === 'Done' || f.status === 'Restricted').length;
    const allDone = floors.length > 0 && doneCount === floors.length;
    const ended = allDone ? (floors.map((f) => f.endedAt).filter(Boolean).sort().at(-1) ?? new Date().toISOString().split('T')[0]) : undefined;
    return { ...b, collectionStartedAt: b.collectionStartedAt ?? started, collectionEndedAt: b.collectionEndedAt ?? ended };
  });
}

function loadInitialState(): PersistedState {
  const persisted = safeParseJSON<PersistedStateRaw>(localStorage.getItem(STORAGE_KEY));
  if (!persisted) {
    const fp = ensureFloorProgress(mockBuildings, mockFixtures, []);
    return {
      userRole: 'Surveyor',
      campuses: mockCampuses,
      buildings: deriveBuildingCollection(mockBuildings, fp),
      fixtures: mockFixtures,
      floorProgress: fp,
    };
  }

  const fixturesRaw = Array.isArray(persisted.fixtures) ? persisted.fixtures : [];
  const fixtures = migrateFixtures(fixturesRaw);

  const buildingsRaw = Array.isArray(persisted.buildings) ? (persisted.buildings.filter(isRecord) as unknown as Building[]) : [];
  const buildings = buildingsRaw.length ? buildingsRaw : mockBuildings;

  const campusesRaw = Array.isArray(persisted.campuses) ? (persisted.campuses.filter(isRecord) as unknown as Campus[]) : [];
  const campuses = campusesRaw.length ? campusesRaw : mockCampuses;

  const role: UserRole = persisted.userRole === 'Facilities' ? 'Facilities' : 'Surveyor';

  const floorProgressRaw = Array.isArray(persisted.floorProgress) ? (persisted.floorProgress.filter(isRecord) as unknown as BuildingFloorProgress[]) : [];
  const floorProgress = ensureFloorProgress(buildings, fixtures, floorProgressRaw);
  return {
    userRole: role,
    campuses,
    buildings: deriveBuildingCollection(buildings, floorProgress),
    fixtures,
    floorProgress,
  };
}

function persistState(next: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode errors
  }
}

export const useFixtureStore = create<FixtureStore>((set, get) => {
  const initial = loadInitialState();

  const persist = (partial?: Partial<PersistedState>) => {
    const s = get();
    const next: PersistedState = {
      userRole: partial?.userRole ?? s.userRole,
      campuses: partial?.campuses ?? s.campuses,
      buildings: partial?.buildings ?? s.buildings,
      fixtures: partial?.fixtures ?? s.fixtures,
      floorProgress: partial?.floorProgress ?? s.floorProgress,
    };
    persistState(next);
  };

  const getFloorProgress = (buildingId: string, floor: number): BuildingFloorProgress => {
    const b = get().buildings.find((x) => x.id === buildingId);
    const maxFloors = b?.floors ?? floor;
    const normalizedFloor = Math.max(1, Math.min(maxFloors, floor));
    return (
      get().floorProgress.find((p) => p.buildingId === buildingId && p.floor === normalizedFloor) ?? {
        buildingId,
        floor: normalizedFloor,
        status: 'NotStarted',
      }
    );
  };

  return {
    userRole: initial.userRole,
    setUserRole: (role) => {
      set({ userRole: role });
      persist({ userRole: role });
    },
    campuses: initial.campuses,
    buildings: initial.buildings,
    fixtures: initial.fixtures,
    floorProgress: initial.floorProgress,

    addCampus: (campus) =>
      set((s) => {
        const campuses = [...s.campuses, campus];
        queueMicrotask(() => persist({ campuses }));
        return { campuses };
      }),
    addBuilding: (building) =>
      set((s) => {
        const buildings = [...s.buildings, building];
        const floorProgress = ensureFloorProgress(buildings, s.fixtures, s.floorProgress);
        const updatedBuildings = deriveBuildingCollection(buildings, floorProgress);
        queueMicrotask(() => persist({ buildings: updatedBuildings, floorProgress }));
        return { buildings: updatedBuildings, floorProgress };
      }),
    addFixture: (fixture) =>
      set((s) => {
        const fixtures = [...s.fixtures, { ...fixture, nearestRoom: fixture.nearestRoom ?? fixture.roomNumber }];
        // If the floor was NotStarted, automatically move to InProgress when first fixture is recorded.
        const floorProgress = ensureFloorProgress(s.buildings, fixtures, s.floorProgress).map((p) => {
          if (p.buildingId !== fixture.buildingId || p.floor !== fixture.floor) return p;
          if (p.status !== 'NotStarted') return p;
          const now = new Date().toISOString().split('T')[0];
          return { ...p, status: 'InProgress' as FloorStatus, startedAt: p.startedAt ?? now };
        });
        const buildings = deriveBuildingCollection(s.buildings, floorProgress);
        queueMicrotask(() => persist({ fixtures, buildings, floorProgress }));
        return { fixtures, buildings, floorProgress };
      }),
    updateFixture: (fixture) =>
      set((s) => {
        const fixtures = s.fixtures.map((f) => (f.id === fixture.id ? { ...fixture, nearestRoom: fixture.nearestRoom ?? fixture.roomNumber } : f));
        queueMicrotask(() => persist({ fixtures }));
        return { fixtures };
      }),
    completeService: (fixtureId) =>
      set((s) => {
        const fixtures = s.fixtures.map((f) =>
          f.id === fixtureId ? { ...f, lastMaintenanceDate: new Date().toISOString().split('T')[0] } : f
        );
        queueMicrotask(() => persist({ fixtures }));
        return { fixtures };
      }),

    setFloorStatus: (buildingId, floor, status, opts) =>
      set((s) => {
        const floorProgress = s.floorProgress.map((p) => {
          if (p.buildingId !== buildingId || p.floor !== floor) return p;
          const now = new Date().toISOString().split('T')[0];
          return {
            ...p,
            status,
            restrictedReason: status === 'Restricted' ? opts?.restrictedReason ?? p.restrictedReason : undefined,
            startedAt: p.startedAt ?? (status !== 'NotStarted' ? now : undefined),
            endedAt: status === 'Done' || status === 'Restricted' ? now : undefined,
          };
        });
        const buildings = deriveBuildingCollection(s.buildings, floorProgress);
        queueMicrotask(() => persist({ floorProgress, buildings }));
        return { floorProgress, buildings };
      }),
    getFloorProgress,
    getFloorsByBuilding: (buildingId) => {
      const floors = get().floorProgress.filter((p) => p.buildingId === buildingId).sort((a, c) => a.floor - c.floor);
      return floors;
    },

    searchFixtures: (query) => {
      const q = query.toLowerCase();
      return get().fixtures.filter(
        (f) =>
          f.roomNumber.toLowerCase().includes(q) ||
          (f.nearestRoom ?? '').toLowerCase().includes(q) ||
          f.model.toLowerCase().includes(q) ||
          f.brand.toLowerCase().includes(q) ||
          f.buildingName.toLowerCase().includes(q)
      );
    },
    getFixturesByBuilding: (buildingId) => get().fixtures.filter((f) => f.buildingId === buildingId),
    getFixturesByBuildingAndFloor: (buildingId, floor) =>
      get().fixtures.filter((f) => f.buildingId === buildingId && f.floor === floor),
    getBuildingsByCampus: (campusId) => get().buildings.filter((b) => b.campusId === campusId),
    getFixturesByCampus: (campusId) => get().fixtures.filter((f) => f.campusId === campusId),
    getMaintenanceTasks: () => get().fixtures.filter((f) => getDaysSinceMaintenance(f.lastMaintenanceDate) > 150),
    getFixtureById: (id) => get().fixtures.find((f) => f.id === id),
  };
});
