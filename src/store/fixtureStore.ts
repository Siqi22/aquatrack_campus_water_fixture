import { create } from 'zustand';

export type FixtureStatus = 'Good' | 'Warning' | 'Urgent';

export interface Fixture {
  id: string;
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
}

export interface Building {
  id: string;
  name: string;
  floors: number;
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

const mockBuildings: Building[] = [
  { id: 'b1', name: 'Engineering Hall', floors: 4 },
  { id: 'b2', name: 'Science Center', floors: 3 },
  { id: 'b3', name: 'Student Union', floors: 2 },
];

const mockFixtures: Fixture[] = [
  { id: 'f1', buildingId: 'b1', buildingName: 'Engineering Hall', floor: 1, roomNumber: '101', brand: 'Elkay', model: 'EZH2O', serialNumber: 'ELK-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-11-01', filterType: 'WaterSentry Plus', installationDate: '2023-06-15' },
  { id: 'f2', buildingId: 'b1', buildingName: 'Engineering Hall', floor: 2, roomNumber: '205', brand: 'Elkay', model: 'LZS8WSLK', serialNumber: 'ELK-2024-002', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2026-03-15', filterType: 'WaterSentry Plus', installationDate: '2024-01-10' },
  { id: 'f3', buildingId: 'b2', buildingName: 'Science Center', floor: 1, roomNumber: '110', brand: 'Halsey Taylor', model: '?"HydroBoost', serialNumber: 'HT-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-08-20', filterType: 'HydroBoost Filter', installationDate: '2022-09-01' },
  { id: 'f4', buildingId: 'b2', buildingName: 'Science Center', floor: 3, roomNumber: '310', brand: 'Oasis', model: 'PWEBF', serialNumber: 'OAS-2024-001', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2025-06-01', filterType: 'Oasis Standard', installationDate: '2023-03-20' },
  { id: 'f5', buildingId: 'b3', buildingName: 'Student Union', floor: 1, roomNumber: '102', brand: 'Elkay', model: 'LZWSRK', serialNumber: 'ELK-2024-003', photoURL: '', modelPlatePhotoURL: '', lastMaintenanceDate: '2026-04-01', filterType: 'WaterSentry VII', installationDate: '2024-08-01' },
];

interface FixtureStore {
  buildings: Building[];
  fixtures: Fixture[];
  addBuilding: (building: Building) => void;
  addFixture: (fixture: Fixture) => void;
  completeService: (fixtureId: string) => void;
  searchFixtures: (query: string) => Fixture[];
  getFixturesByBuilding: (buildingId: string) => Fixture[];
  getFixturesByBuildingAndFloor: (buildingId: string, floor: number) => Fixture[];
  getMaintenanceTasks: () => Fixture[];
}

export const useFixtureStore = create<FixtureStore>((set, get) => ({
  buildings: mockBuildings,
  fixtures: mockFixtures,
  addBuilding: (building) => set((s) => ({ buildings: [...s.buildings, building] })),
  addFixture: (fixture) => set((s) => ({ fixtures: [...s.fixtures, fixture] })),
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
  getMaintenanceTasks: () => get().fixtures.filter((f) => getDaysSinceMaintenance(f.lastMaintenanceDate) > 150),
}));
