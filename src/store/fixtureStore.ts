import { create } from 'zustand';

export type FixtureStatus = 'Good' | 'Warning' | 'Urgent';
export type FixtureCategory = 'Public' | 'Private';

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
  brand: string;
  model: string;
  serialNumber: string;
  photoURL: string;
  modelPlatePhotoURL: string;
  lastMaintenanceDate: string;
  filterType: string;
  installationDate: string;
  category: FixtureCategory;
  qualityRating: QualityRating;
  posX?: number;
  posY?: number;
}

export interface Building {
  id: string;
  campusId: string;
  name: string;
  floors: number;
}

export interface Campus {
  id: string;
  name: string;
  school: string;
  address: string;
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
  { id: 'f1', campusId: 'c1', buildingId: 'b1', buildingName: 'Engineering Hall', floor: 1, roomNumber: '101', brand: 'Elkay', model: 'EZH2O', serialNumber: 'ELK-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-11-01', filterType: 'WaterSentry Plus', installationDate: '2023-06-15', category: 'Public', qualityRating: { pressure: 4, cleanliness: 5 }, posX: 20, posY: 30 },
  { id: 'f2', campusId: 'c1', buildingId: 'b1', buildingName: 'Engineering Hall', floor: 2, roomNumber: '205', brand: 'Elkay', model: 'LZS8WSLK', serialNumber: 'ELK-2024-002', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2026-03-15', filterType: 'WaterSentry Plus', installationDate: '2024-01-10', category: 'Public', qualityRating: { pressure: 3, cleanliness: 4 }, posX: 65, posY: 45 },
  { id: 'f3', campusId: 'c1', buildingId: 'b2', buildingName: 'Science Center', floor: 1, roomNumber: '110', brand: 'Halsey Taylor', model: 'HydroBoost', serialNumber: 'HT-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-08-20', filterType: 'HydroBoost Filter', installationDate: '2022-09-01', category: 'Public', qualityRating: { pressure: 2, cleanliness: 3 }, posX: 40, posY: 60 },
  { id: 'f4', campusId: 'c2', buildingId: 'b3', buildingName: 'Student Union', floor: 1, roomNumber: '102', brand: 'Elkay', model: 'LZWSRK', serialNumber: 'ELK-2024-003', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2026-04-01', filterType: 'WaterSentry VII', installationDate: '2024-08-01', category: 'Public', qualityRating: { pressure: 5, cleanliness: 5 }, posX: 50, posY: 50 },
  { id: 'f5', campusId: 'c3', buildingId: 'b4', buildingName: 'Arts Building', floor: 3, roomNumber: '310', brand: 'Oasis', model: 'PWEBF', serialNumber: 'OAS-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-06-01', filterType: 'Oasis Standard', installationDate: '2023-03-20', category: 'Private', qualityRating: { pressure: 4, cleanliness: 2 }, posX: 75, posY: 25 },
];

interface FixtureStore {
  campuses: Campus[];
  buildings: Building[];
  fixtures: Fixture[];
  addCampus: (campus: Campus) => void;
  addBuilding: (building: Building) => void;
  addFixture: (fixture: Fixture) => void;
  updateFixture: (fixture: Fixture) => void;
  completeService: (fixtureId: string) => void;
  searchFixtures: (query: string) => Fixture[];
  getFixturesByBuilding: (buildingId: string) => Fixture[];
  getFixturesByBuildingAndFloor: (buildingId: string, floor: number) => Fixture[];
  getBuildingsByCampus: (campusId: string) => Building[];
  getFixturesByCampus: (campusId: string) => Fixture[];
  getMaintenanceTasks: () => Fixture[];
  getFixtureById: (id: string) => Fixture | undefined;
}

export const useFixtureStore = create<FixtureStore>((set, get) => ({
  campuses: mockCampuses,
  buildings: mockBuildings,
  fixtures: mockFixtures,
  addCampus: (campus) => set((s) => ({ campuses: [...s.campuses, campus] })),
  addBuilding: (building) => set((s) => ({ buildings: [...s.buildings, building] })),
  addFixture: (fixture) => set((s) => ({ fixtures: [...s.fixtures, fixture] })),
  updateFixture: (fixture) =>
    set((s) => ({
      fixtures: s.fixtures.map((f) => (f.id === fixture.id ? fixture : f)),
    })),
  completeService: (fixtureId) =>
    set((s) => ({
      fixtures: s.fixtures.map((f) =>
        f.id === fixtureId ? { ...f, lastMaintenanceDate: new Date().toISOString().split('T')[0] } : f
      ),
    })),
  searchFixtures: (query) => {
    const q = query.toLowerCase();
    return get().fixtures.filter(
      (f) =>
        f.roomNumber.toLowerCase().includes(q) ||
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
}));
