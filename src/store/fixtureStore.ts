import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  ImportAnalysis,
  ImportOptions,
  ImportResult,
} from "@/lib/importCSV";
import {
  parseCampusLabel,
  estimateBuildingFloors,
  resolveExistingFixtureId,
  buildExistingFixtureIndex,
} from "@/lib/importCSV";
import { formatSupabaseError } from "@/lib/utils";
import { categoryFromSpreadsheetLabel } from "@/lib/importCSV";
import {
  buildImportMetadata,
  categoryFromOriginalLabel,
  parseOriginalFloorFromImportMetadata,
  resolveCategoryFromImportProvenance,
  splitImportFromObservations,
} from "@/lib/importMetadata";
import {
  compareFloorKeys,
  floorProgressKey,
  normalizeFloorKey,
} from "@/lib/floorUtils";

export type FixtureStatus = "Good" | "Warning" | "Urgent";
export type FloorStatus = "NotStarted" | "InProgress" | "Done" | "Restricted";

export type FixtureCategory =
  | "PorcelainFountain"
  | "MetalFountain"
  | "VendingMachine"
  | "BottleRefillStation"
  | "Other";

/** Display order for fountain type pickers */
export const FIXTURE_CATEGORIES: FixtureCategory[] = [
  "PorcelainFountain",
  "MetalFountain",
  "VendingMachine",
  "BottleRefillStation",
  "Other",
];

export const fixtureCategoryMeta: Record<
  FixtureCategory,
  { label: string; examples: string[]; hints?: string[] }
> = {
  PorcelainFountain: {
    label: "Porcelain fountain",
    examples: [
      "White ceramic basin",
      "Wall-hung porcelain",
      "Traditional drinking fountain",
    ],
    hints: ["Often near restrooms"],
  },
  MetalFountain: {
    label: "Metal fountain",
    examples: [
      "Stainless steel basin",
      "Elkay metal fountain",
      "ADA metal fountain",
    ],
    hints: ["Often near restrooms"],
  },
  VendingMachine: {
    label: "Vending machine",
    examples: ["Water bottle vending", "Filtered water kiosk"],
  },
  BottleRefillStation: {
    label: "Bottle refill station",
    examples: [
      "Elkay EZH2O bottle filler",
      "Gooseneck bottle station",
      "High bottle clearance",
    ],
    hints: ["May be standalone or combined with a fountain"],
  },
  Other: {
    label: "Other",
    examples: ["Unknown type", "Temporary setup", "Filtered tap only"],
  },
};

/** Maps original DB enum values (pre–category v2) to current fountain types. */
export const ORIGINAL_CATEGORY_MIGRATION: Record<string, FixtureCategory> = {
  BottleFiller: "BottleRefillStation",
  CombinationUnit: "BottleRefillStation",
  FilteredTap: "Other",
  Other: "Other",
  WallFountain: "Other",
};

const CATEGORY_LABEL_ALIASES: Record<string, FixtureCategory> = {
  "porcelain fountain": "PorcelainFountain",
  "metal fountain": "MetalFountain",
  "vending machine": "VendingMachine",
  "bottle refill station": "BottleRefillStation",
  "bottle filler": "BottleRefillStation",
  "bottle refill": "BottleRefillStation",
  "wall fountain": "Other",
  "combo unit": "BottleRefillStation",
  "combination unit": "BottleRefillStation",
  "filtered tap": "Other",
  "filtered tap / sink": "Other",
  "drinking fountain": "Other",
  "water fountain": "Other",
  other: "Other",
};

export function normalizeFixtureCategory(
  category: string | null | undefined,
): FixtureCategory {
  if (!category) return "Other";
  const trimmed = category.trim();
  if (trimmed in fixtureCategoryMeta) return trimmed as FixtureCategory;
  if (trimmed in ORIGINAL_CATEGORY_MIGRATION)
    return ORIGINAL_CATEGORY_MIGRATION[trimmed];

  const lower = trimmed.toLowerCase();
  if (lower in CATEGORY_LABEL_ALIASES) return CATEGORY_LABEL_ALIASES[lower];
  for (const id of FIXTURE_CATEGORIES) {
    if (fixtureCategoryMeta[id].label.toLowerCase() === lower) return id;
  }
  return "Other";
}

export function getFixtureCategoryLabel(category: string): string {
  return fixtureCategoryMeta[normalizeFixtureCategory(category)].label;
}

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
  createdBy?: string;
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
  const diffDays = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays > 180) return "Urgent";
  if (diffDays > 120) return "Warning";
  return "Good";
}

export function getDaysSinceMaintenance(lastMaintenanceDate: string): number {
  const last = new Date(lastMaintenanceDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// DB <-> domain mappers
// ============================================================
type CampusRow = Database["public"]["Tables"]["campuses"]["Row"];
type BuildingRow = Database["public"]["Tables"]["buildings"]["Row"];
type FixtureRow = Database["public"]["Tables"]["fixtures"]["Row"];
type FloorProgressRow = Database["public"]["Tables"]["floor_progress"]["Row"];

function mapCampus(r: CampusRow): Campus {
  return { id: r.id, name: r.name, school: r.school, address: r.address ?? "" };
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
    roomNumber: r.nearest_room,
    nearestRoom: r.nearest_room,
    brand: r.brand ?? "",
    model: r.model ?? "",
    serialNumber: r.serial_number ?? "",
    photoURL: r.photo_url ?? "",
    modelPlatePhotoURL: r.model_plate_photo_url ?? "",
    lastMaintenanceDate: r.last_maintenance_date,
    filterType: r.filter_type ?? "",
    installationDate: r.installation_date ?? undefined,
    // Survey / edit saves the picker choice to fixtures.category — that column is authoritative.
    category: normalizeFixtureCategory(r.category),
    qualityRating: {
      pressure: r.pressure_rating ?? 3,
      cleanliness: r.cleanliness_rating ?? 3,
    },
    observations: r.observations ?? undefined,
    issues: r.issues ?? undefined,
    posX: r.pos_x != null ? Number(r.pos_x) : undefined,
    posY: r.pos_y != null ? Number(r.pos_y) : undefined,
    noLabelReason:
      (r as { no_label_reason?: string | null }).no_label_reason ?? undefined,
    noLabelReasonOther:
      (r as { no_label_reason_other?: string | null }).no_label_reason_other ??
      undefined,
    photosProvided:
      (r as { photos_provided?: string[] | null }).photos_provided ?? undefined,
    locationConfirmed:
      (r as { location_confirmed?: boolean | null }).location_confirmed ??
      undefined,
    savedByName:
      (r as { saved_by_name?: string | null }).saved_by_name ?? undefined,
    createdBy: r.created_by ?? undefined,
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

function findFloorProgressRow(
  floorProgress: BuildingFloorProgress[],
  buildingId: string,
  floor: string,
): BuildingFloorProgress | undefined {
  const key = normalizeFloorKey(floor);
  return floorProgress.find(
    (p) => p.buildingId === buildingId && normalizeFloorKey(p.floor) === key,
  );
}

function effectiveFloorStatus(
  status: FloorStatus,
  fixtureCount: number,
): FloorStatus {
  if (status === "Done" || status === "Restricted") return status;
  if (fixtureCount > 0 && status === "NotStarted") return "InProgress";
  return status;
}

function countFixturesOnFloor(
  fixtures: Fixture[],
  buildingId: string,
  floor: string,
): number {
  const key = normalizeFloorKey(floor);
  return fixtures.filter(
    (f) => f.buildingId === buildingId && normalizeFloorKey(f.floor) === key,
  ).length;
}

async function syncFloorProgressWithFixtures(
  fixtures: Fixture[],
  floorProgress: BuildingFloorProgress[],
): Promise<BuildingFloorProgress[]> {
  const today = new Date().toISOString().slice(0, 10);
  const fixtureCountByKey = new Map<string, number>();

  for (const fixture of fixtures) {
    const key = floorProgressKey(fixture.buildingId, fixture.floor);
    fixtureCountByKey.set(key, (fixtureCountByKey.get(key) ?? 0) + 1);
  }

  const inserts: Database["public"]["Tables"]["floor_progress"]["Insert"][] =
    [];
  const updates: Array<{ buildingId: string; dbFloor: string }> = [];

  for (const [key, count] of fixtureCountByKey) {
    if (count === 0) continue;
    const colon = key.indexOf(":");
    const buildingId = key.slice(0, colon);
    const floor = key.slice(colon + 1);
    const existing = findFloorProgressRow(floorProgress, buildingId, floor);
    if (!existing) {
      inserts.push({
        building_id: buildingId,
        floor,
        status: "InProgress",
        started_at: today,
      });
    } else if (existing.status === "NotStarted") {
      updates.push({ buildingId, dbFloor: existing.floor });
    }
  }

  let next = [...floorProgress];

  if (inserts.length) {
    const { data, error } = await supabase
      .from("floor_progress")
      .insert(inserts)
      .select("*");
    if (error)
      console.error("syncFloorProgressWithFixtures insert failed", error);
    else if (data) next.push(...data.map(mapFloorProgress));
  }

  for (const { buildingId, dbFloor } of updates) {
    const { error } = await supabase
      .from("floor_progress")
      .update({ status: "InProgress", started_at: today })
      .eq("building_id", buildingId)
      .eq("floor", dbFloor);
    if (error) {
      console.error("syncFloorProgressWithFixtures update failed", error);
      continue;
    }
    next = next.map((p) =>
      p.buildingId === buildingId && p.floor === dbFloor
        ? { ...p, status: "InProgress", startedAt: today }
        : p,
    );
  }

  return next;
}

// ============================================================
// Store
// ============================================================
interface FixtureStore {
  loading: boolean;
  loaded: boolean;
  campuses: Campus[];
  buildings: Building[];
  fixtures: Fixture[];
  floorProgress: BuildingFloorProgress[];
  loadAll: () => Promise<void>;
  reset: () => void;
  addCampus: (
    campus: Omit<Campus, "id"> & { id?: string },
  ) => Promise<Campus | null>;
  addBuilding: (
    building: Omit<Building, "id"> & { id?: string },
  ) => Promise<Building | null>;
  addFixture: (
    fixture: Omit<Fixture, "id"> & { id?: string },
  ) => Promise<Fixture | null>;
  updateFixture: (fixture: Fixture) => Promise<void>;
  completeService: (fixtureId: string) => Promise<void>;
  setFloorStatus: (
    buildingId: string,
    floor: string,
    status: FloorStatus,
    opts?: { restrictedReason?: string },
  ) => Promise<void>;
  getFloorProgress: (
    buildingId: string,
    floor: string,
  ) => BuildingFloorProgress;
  getFloorsByBuilding: (buildingId: string) => BuildingFloorProgress[];
  searchFixtures: (query: string) => Fixture[];
  getFixturesByBuilding: (buildingId: string) => Fixture[];
  getFixturesByBuildingAndFloor: (
    buildingId: string,
    floor: string,
  ) => Fixture[];
  getBuildingsByCampus: (campusId: string) => Building[];
  getFixturesByCampus: (campusId: string) => Fixture[];
  getMaintenanceTasks: () => Fixture[];
  getFixtureById: (id: string) => Fixture | undefined;
  importFromAnalysis: (
    analysis: ImportAnalysis,
    options?: ImportOptions,
  ) => Promise<ImportResult>;
}

export const useFixtureStore = create<FixtureStore>((set, get) => ({
  loading: false,
  loaded: false,
  campuses: [],
  buildings: [],
  fixtures: [],
  floorProgress: [],

  reset: () =>
    set({
      loaded: false,
      campuses: [],
      buildings: [],
      fixtures: [],
      floorProgress: [],
    }),

  loadAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id ?? null;

      const [campusesRes, buildingsRes, fixturesRes, fpRes] = await Promise.all([
          supabase
            .from("campuses")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase
            .from("buildings")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase
            .from("fixtures")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase.from("floor_progress").select("*"),
        ]);

      if (campusesRes.error) throw campusesRes.error;
      if (buildingsRes.error) throw buildingsRes.error;
      if (fixturesRes.error) throw fixturesRes.error;
      if (fpRes.error) throw fpRes.error;

      const campuses = (campusesRes.data ?? []).map(mapCampus);
      const buildings = (buildingsRes.data ?? []).map(mapBuilding);
      const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));

      const fixtureRows = fixturesRes.data ?? [];
      await Promise.all(
        fixtureRows.map(async (row) => {
          const rowExt = row as FixtureRow & {
            import_metadata?: string | null;
          };
          let importMeta = rowExt.import_metadata?.trim() || "";

          const split = splitImportFromObservations(row.observations);
          if (!importMeta && split.importMetadata)
            importMeta = split.importMetadata;

          // Only imported rows (import_metadata) get category/floor backfill — not field-survey entries.
          const fromOriginal = importMeta
            ? resolveCategoryFromImportProvenance(importMeta, row.observations)
            : undefined;
          const normalized =
            fromOriginal ?? normalizeFixtureCategory(row.category);

          const originalFloor = importMeta
            ? parseOriginalFloorFromImportMetadata(importMeta)
            : undefined;
          const storedFloor = String(row.floor).trim();
          const patch: Database["public"]["Tables"]["fixtures"]["Update"] = {};

          if (split.importMetadata && !rowExt.import_metadata?.trim()) {
            patch.import_metadata = split.importMetadata;
            patch.observations = split.observations ?? null;
          }
          if (importMeta && row.category !== normalized)
            patch.category = normalized;
          if (importMeta && originalFloor && originalFloor !== storedFloor)
            patch.floor = originalFloor;

          if (Object.keys(patch).length) {
            const { error } = await supabase
              .from("fixtures")
              .update(patch)
              .eq("id", row.id);
            if (!error) {
              if (patch.import_metadata)
                rowExt.import_metadata = patch.import_metadata as string;
              if (patch.observations !== undefined)
                row.observations = patch.observations ?? null;
              if (patch.category) row.category = patch.category;
              if (patch.floor) row.floor = patch.floor;
            }
          }
        }),
      );

      const fixtures = fixtureRows.map((r) =>
        mapFixture(r, buildingNameById.get(r.building_id) ?? ""),
      );
      let floorProgress = (fpRes.data ?? []).map(mapFloorProgress);

      // Auto-create floor_progress rows for missing (building, floor) combos so the UI has something to show.
      const existing = new Set(
        floorProgress.map((p) => floorProgressKey(p.buildingId, p.floor)),
      );
      const missing: {
        building_id: string;
        floor: string;
        status: FloorStatus;
      }[] = [];
      for (const b of buildings) {
        for (let fl = 1; fl <= b.floors; fl++) {
          const key = floorProgressKey(b.id, String(fl));
          if (!existing.has(key)) {
            missing.push({
              building_id: b.id,
              floor: String(fl),
              status: "NotStarted",
            });
            existing.add(key);
          }
        }
      }
      for (const f of fixtures) {
        const key = floorProgressKey(f.buildingId, f.floor);
        if (!existing.has(key)) {
          missing.push({
            building_id: f.buildingId,
            floor: normalizeFloorKey(f.floor),
            status: "NotStarted",
          });
          existing.add(key);
        }
      }
      if (missing.length) {
        const { data: inserted } = await supabase
          .from("floor_progress")
          .insert(missing)
          .select("*");
        if (inserted) floorProgress.push(...inserted.map(mapFloorProgress));
      }

      floorProgress = await syncFloorProgressWithFixtures(
        fixtures,
        floorProgress,
      );

      // First-run seed: if user has no campuses at all, seed a starter campus.
      if (campuses.length === 0 && userId) {
        const { data: seed } = await supabase
          .from("campuses")
          .insert({
            name: "Main Campus",
            school: "My University",
            address: "",
            created_by: userId,
          })
          .select("*")
          .single();
        if (seed) campuses.push(mapCampus(seed));
      }

      set({
        campuses,
        buildings,
        fixtures,
        floorProgress,
        loaded: true,
      });
    } catch (e) {
      console.error("loadAll failed", e);
    } finally {
      set({ loading: false });
    }
  },

  addCampus: async (campus) => {
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp?.user?.id ?? null;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("campuses")
      .insert({
        name: campus.name,
        school: campus.school,
        address: campus.address,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error(error);
      return null;
    }
    const next = mapCampus(data);
    set((s) => ({ campuses: [...s.campuses, next] }));
    return next;
  },

  addBuilding: async (building) => {
    const { data, error } = await supabase
      .from("buildings")
      .insert({
        campus_id: building.campusId,
        name: building.name,
        floors: building.floors,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error(error);
      return null;
    }
    const next = mapBuilding(data);
    // Seed floor_progress for this building.
    const fpRows = Array.from({ length: next.floors }, (_, i) => ({
      building_id: next.id,
      floor: String(i + 1),
      status: "NotStarted" as FloorStatus,
    }));
    const { data: fpInserted } = await supabase
      .from("floor_progress")
      .insert(fpRows)
      .select("*");
    set((s) => ({
      buildings: [...s.buildings, next],
      floorProgress: [
        ...s.floorProgress,
        ...(fpInserted ?? []).map(mapFloorProgress),
      ],
    }));
    return next;
  },

  addFixture: async (f) => {
    const floorKey = normalizeFloorKey(f.floor);
    const existingFp = findFloorProgressRow(
      get().floorProgress,
      f.buildingId,
      floorKey,
    );
    if (!existingFp) {
      const { data: inserted } = await supabase
        .from("floor_progress")
        .insert({
          building_id: f.buildingId,
          floor: floorKey,
          status: "NotStarted",
        })
        .select("*")
        .maybeSingle();
      if (inserted) {
        set((s) => ({
          floorProgress: [...s.floorProgress, mapFloorProgress(inserted)],
        }));
      }
    }

    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp?.user?.id ?? null;
    let savedByName: string | null = f.savedByName ?? null;
    if (!savedByName && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      savedByName = profile?.display_name ?? userResp?.user?.email ?? null;
    }
    const { data, error } = await supabase
      .from("fixtures")
      .insert({
        campus_id: f.campusId,
        building_id: f.buildingId,
        floor: floorKey,
        nearest_room: (f.nearestRoom ?? f.roomNumber).trim(),
        brand: f.brand,
        model: f.model,
        serial_number: f.serialNumber,
        filter_type: f.filterType,
        // Fixture type from Add Asset step 2/3 picker (PorcelainFountain, MetalFountain, …)
        category: normalizeFixtureCategory(f.category),
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
      .select("*")
      .single();
    if (error || !data) {
      console.error("addFixture failed", error);
      throw new Error(formatSupabaseError(error));
    }
    const buildingName =
      get().buildings.find((b) => b.id === data.building_id)?.name ??
      f.buildingName;
    const next = mapFixture(data, buildingName);

    // Auto-advance floor status NotStarted -> InProgress
    const fp = findFloorProgressRow(
      get().floorProgress,
      f.buildingId,
      floorKey,
    );
    if (fp && fp.status === "NotStarted") {
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from("floor_progress")
        .update({ status: "InProgress", started_at: today })
        .eq("building_id", f.buildingId)
        .eq("floor", fp.floor);
      set((s) => ({
        floorProgress: s.floorProgress.map((p) =>
          p.buildingId === f.buildingId && p.floor === fp.floor
            ? { ...p, status: "InProgress", startedAt: today }
            : p,
        ),
      }));
    }

    set((s) => ({ fixtures: [...s.fixtures, next] }));
    return next;
  },

  updateFixture: async (f) => {
    const buildingName =
      get().buildings.find((b) => b.id === f.buildingId)?.name ??
      f.buildingName;
    const floorKey = normalizeFloorKey(f.floor);
    const room = (f.nearestRoom ?? f.roomNumber).trim();
    const { error } = await supabase
      .from("fixtures")
      .update({
        campus_id: f.campusId,
        building_id: f.buildingId,
        floor: floorKey,
        nearest_room: room,
        brand: f.brand || null,
        model: f.model || null,
        serial_number: f.serialNumber || null,
        filter_type: f.filterType || null,
        category: normalizeFixtureCategory(f.category),
        pressure_rating: f.qualityRating.pressure,
        cleanliness_rating: f.qualityRating.cleanliness,
        observations: f.observations ?? null,
        issues: f.issues?.length ? f.issues : null,
        photo_url: f.photoURL || null,
        model_plate_photo_url: f.modelPlatePhotoURL || null,
        installation_date: f.installationDate ?? null,
        no_label_reason: f.noLabelReason ?? null,
        no_label_reason_other: f.noLabelReasonOther ?? null,
        photos_provided: f.photosProvided?.length ? f.photosProvided : null,
        location_confirmed: f.locationConfirmed ?? false,
      })
      .eq("id", f.id);
    if (error) {
      console.error(error);
      throw new Error(formatSupabaseError(error));
    }
    const updated: Fixture = {
      ...f,
      buildingName,
      floor: floorKey,
      roomNumber: room,
      nearestRoom: room,
    };
    set((s) => ({
      fixtures: s.fixtures.map((x) => (x.id === f.id ? updated : x)),
    }));
  },

  completeService: async (fixtureId) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("fixtures")
      .update({ last_maintenance_date: today })
      .eq("id", fixtureId);
    if (error) {
      console.error(error);
      return;
    }
    set((s) => ({
      fixtures: s.fixtures.map((f) =>
        f.id === fixtureId ? { ...f, lastMaintenanceDate: today } : f,
      ),
    }));
  },

  setFloorStatus: async (buildingId, floor, status, opts) => {
    const existing = findFloorProgressRow(
      get().floorProgress,
      buildingId,
      floor,
    );
    const dbFloor = existing?.floor ?? normalizeFloorKey(floor);
    const today = new Date().toISOString().slice(0, 10);
    const patch: Database["public"]["Tables"]["floor_progress"]["Update"] = {
      status,
      restricted_reason:
        status === "Restricted" ? (opts?.restrictedReason ?? null) : null,
      started_at: status !== "NotStarted" ? today : null,
      ended_at: status === "Done" || status === "Restricted" ? today : null,
    };

    if (existing) {
      const { error } = await supabase
        .from("floor_progress")
        .update(patch)
        .eq("building_id", buildingId)
        .eq("floor", dbFloor);
      if (error) {
        console.error(error);
        throw new Error(formatSupabaseError(error));
      }
      set((s) => ({
        floorProgress: s.floorProgress.map((p) =>
          p.buildingId === buildingId &&
          normalizeFloorKey(p.floor) === normalizeFloorKey(dbFloor)
            ? {
                ...p,
                status,
                restrictedReason: patch.restricted_reason ?? undefined,
                startedAt: patch.started_at ?? undefined,
                endedAt: patch.ended_at ?? undefined,
              }
            : p,
        ),
      }));
      return;
    }

    const { data, error } = await supabase
      .from("floor_progress")
      .insert({
        building_id: buildingId,
        floor: dbFloor,
        status,
        restricted_reason: patch.restricted_reason ?? null,
        started_at: patch.started_at ?? null,
        ended_at: patch.ended_at ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error(error);
      throw new Error(formatSupabaseError(error));
    }
    set((s) => ({
      floorProgress: [...s.floorProgress, mapFloorProgress(data)],
    }));
  },

  getFloorProgress: (buildingId, floor) => {
    const key = normalizeFloorKey(floor);
    const stored = findFloorProgressRow(
      get().floorProgress,
      buildingId,
      key,
    ) ?? {
      buildingId,
      floor: key,
      status: "NotStarted" as FloorStatus,
    };
    const fixtureCount = countFixturesOnFloor(get().fixtures, buildingId, key);
    return {
      ...stored,
      floor: key,
      status: effectiveFloorStatus(stored.status, fixtureCount),
    };
  },
  getFloorsByBuilding: (buildingId) => {
    const { fixtures, floorProgress } = get();
    const buildingFixtures = fixtures.filter(
      (f) => f.buildingId === buildingId,
    );
    const buildingProgress = floorProgress.filter(
      (p) => p.buildingId === buildingId,
    );
    const floorMap = new Map<string, BuildingFloorProgress>();

    for (const progress of buildingProgress) {
      const key = normalizeFloorKey(progress.floor);
      floorMap.set(key, { ...progress, floor: key });
    }

    for (const fixture of buildingFixtures) {
      const key = normalizeFloorKey(fixture.floor);
      if (!floorMap.has(key)) {
        floorMap.set(key, { buildingId, floor: key, status: "InProgress" });
      }
    }

    return Array.from(floorMap.values())
      .map((progress) => ({
        ...progress,
        status: effectiveFloorStatus(
          progress.status,
          countFixturesOnFloor(buildingFixtures, buildingId, progress.floor),
        ),
      }))
      .sort((a, b) => compareFloorKeys(a.floor, b.floor));
  },
  searchFixtures: (query) => {
    const q = query.toLowerCase();
    return get().fixtures.filter(
      (f) =>
        f.roomNumber.toLowerCase().includes(q) ||
        (f.nearestRoom ?? "").toLowerCase().includes(q) ||
        f.model.toLowerCase().includes(q) ||
        f.brand.toLowerCase().includes(q) ||
        f.buildingName.toLowerCase().includes(q),
    );
  },
  getFixturesByBuilding: (buildingId) =>
    get().fixtures.filter((f) => f.buildingId === buildingId),
  getFixturesByBuildingAndFloor: (buildingId, floor) => {
    const key = normalizeFloorKey(floor);
    return get().fixtures.filter(
      (f) => f.buildingId === buildingId && normalizeFloorKey(f.floor) === key,
    );
  },
  getBuildingsByCampus: (campusId) =>
    get().buildings.filter((b) => b.campusId === campusId),
  getFixturesByCampus: (campusId) =>
    get().fixtures.filter((f) => f.campusId === campusId),
  getMaintenanceTasks: () =>
    get().fixtures.filter(
      (f) => getDaysSinceMaintenance(f.lastMaintenanceDate) > 150,
    ),
  getFixtureById: (id) => get().fixtures.find((f) => f.id === id),

  importFromAnalysis: async (analysis, options) => {
    const mode = options?.mode ?? "skip_duplicates";
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
      const created = await get().addCampus({
        name: parsed.name,
        school: parsed.school,
        address: "",
      });
      if (created) {
        campusesCreated++;
        campusIdByLabel.set(campusKey(label), created.id);
      }
    }

    const buildingNames = new Map<
      string,
      { campusLabel: string; buildingName: string }
    >();
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
        (b) =>
          b.campusId === campusId &&
          b.name.toLowerCase() === buildingName.toLowerCase(),
      );
      if (existing) {
        buildingIdByKey.set(key, existing.id);
        continue;
      }

      const floorCount = estimateBuildingFloors(
        analysis.fixtures,
        analysis.floorLocks,
        campusLabel,
        buildingName,
      );
      const created = await get().addBuilding({
        campusId,
        name: buildingName,
        floors: floorCount,
      });
      if (created) {
        buildingsCreated++;
        buildingIdByKey.set(key, created.id);
      }
    }

    const existingFp = new Set(
      get().floorProgress.map((p) => floorProgressKey(p.buildingId, p.floor)),
    );
    const fpToInsert: {
      building_id: string;
      floor: string;
      status: FloorStatus;
    }[] = [];

    const registerFloor = (
      campusLabel: string,
      buildingName: string,
      floor: string,
    ) => {
      const bId = buildingIdByKey.get(buildingKey(campusLabel, buildingName));
      if (!bId) return;
      const floorKey = normalizeFloorKey(floor);
      const fpKey = floorProgressKey(bId, floorKey);
      if (existingFp.has(fpKey)) return;
      existingFp.add(fpKey);
      fpToInsert.push({
        building_id: bId,
        floor: floorKey,
        status: "NotStarted",
      });
    };

    for (const f of analysis.fixtures)
      registerFloor(f.campusLabel, f.buildingName, f.floor);
    for (const l of analysis.floorLocks)
      registerFloor(l.campusLabel, l.buildingName, l.floor);

    if (fpToInsert.length) {
      await supabase.from("floor_progress").insert(fpToInsert);
    }

    type FixtureInsert = Database["public"]["Tables"]["fixtures"]["Insert"];
    const rows: FixtureInsert[] = [];
    const updates: Array<{
      id: string;
      patch: Database["public"]["Tables"]["fixtures"]["Update"];
    }> = [];

    for (const f of analysis.fixtures) {
      const campusId = campusIdByLabel.get(campusKey(f.campusLabel));
      const buildingId = buildingIdByKey.get(
        buildingKey(f.campusLabel, f.buildingName),
      );
      if (!campusId || !buildingId) continue;

      const existingId = resolveExistingFixtureId(f, index);
      const photoURL = f.photoURL?.trim() || null;
      const modelPlatePhotoURL = f.modelPlatePhotoURL?.trim() || null;
      const photosProvided = [photoURL, modelPlatePhotoURL].filter(
        Boolean,
      ) as string[];

      const categoryFromOriginal =
        categoryFromSpreadsheetLabel(f.categoryLabel) ??
        categoryFromOriginalLabel(f.categoryLabel) ??
        normalizeFixtureCategory(f.category);
      const importMetadata = buildImportMetadata({
        originalFloorLabel: f.floor,
        originalCategory: f.categoryLabel,
      });

      const patch = {
        floor: normalizeFloorKey(f.floor),
        nearest_room: f.nearestRoom.trim(),
        brand: f.brand || null,
        model: f.model || null,
        serial_number: f.serialNumber || null,
        filter_type: f.filterType || null,
        category: categoryFromOriginal,
        import_metadata: importMetadata,
        pressure_rating: f.pressure,
        cleanliness_rating: f.cleanliness,
        observations: f.observations ?? null,
        issues: f.issues ?? null,
        last_maintenance_date: f.lastMaintenanceDate,
        installation_date: f.installationDate ?? null,
        location_confirmed: true,
        photo_url: photoURL,
        model_plate_photo_url: modelPlatePhotoURL,
        photos_provided: photosProvided.length ? photosProvided : [],
      };

      if (existingId) {
        if (mode === "skip_duplicates") {
          fixturesSkippedDuplicates++;
          continue;
        }
        if (mode === "update_existing") {
          updates.push({ id: existingId, patch });
          continue;
        }
      }

      rows.push({
        campus_id: campusId,
        building_id: buildingId,
        ...patch,
        created_by: userId,
      });
    }

    for (const { id, patch } of updates) {
      const { error } = await supabase
        .from("fixtures")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      fixturesUpdated++;
    }

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("fixtures").insert(batch);
      if (error) throw error;
    }

    const lockMap = new Map<
      string,
      { buildingId: string; floor: string; reason: string }
    >();
    for (const l of analysis.floorLocks) {
      const buildingId = buildingIdByKey.get(
        buildingKey(l.campusLabel, l.buildingName),
      );
      if (!buildingId) continue;
      lockMap.set(`${buildingId}:${l.floor}`, {
        buildingId,
        floor: l.floor,
        reason: l.reason,
      });
    }

    let floorsLocked = 0;
    for (const lock of lockMap.values()) {
      await get().setFloorStatus(lock.buildingId, lock.floor, "Restricted", {
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
