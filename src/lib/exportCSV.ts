import {
  Fixture,
  getFixtureStatus,
  getFixtureCategoryLabel,
} from "@/store/fixtureStore";
import { FIELD_LABELS } from "@/lib/fieldLabels";

export type ExportColumnKey =
  | "id"
  | "campus"
  | "building"
  | "floor"
  | "room"
  | "nearestRoom"
  | "category"
  | "brand"
  | "model"
  | "serialNumber"
  | "filterType"
  | "lastMaintenance"
  | "installationDate"
  | "status"
  | "pressure"
  | "cleanliness"
  | "observations"
  | "issues";

export interface ExportColumn {
  key: ExportColumnKey;
  label: string;
  get: (f: Fixture, opts: { campusName?: string }) => string | number;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "id", label: "ID", get: (f) => f.id },
  { key: "campus", label: "Campus", get: (_f, o) => o.campusName ?? "" },
  { key: "building", label: "Building", get: (f) => f.buildingName },
  { key: "floor", label: "Floor", get: (f) => f.floor },
  { key: "room", label: "Room", get: (f) => f.roomNumber },
  {
    key: "nearestRoom",
    label: "Nearest Room",
    get: (f) => f.nearestRoom ?? "",
  },
  {
    key: "category",
    label: "Fountain type",
    get: (f) => getFixtureCategoryLabel(f.category),
  },
  { key: "brand", label: FIELD_LABELS.companyName, get: (f) => f.brand },
  { key: "model", label: FIELD_LABELS.model, get: (f) => f.model },
  {
    key: "serialNumber",
    label: FIELD_LABELS.serialNumber,
    get: (f) => f.serialNumber,
  },
  {
    key: "filterType",
    label: FIELD_LABELS.productNumber,
    get: (f) => f.filterType,
  },
  {
    key: "lastMaintenance",
    label: "Last Maintenance",
    get: (f) => f.lastMaintenanceDate,
  },
  {
    key: "installationDate",
    label: "Installation Date",
    get: (f) => f.installationDate ?? "",
  },
  {
    key: "status",
    label: "Status",
    get: (f) => getFixtureStatus(f.lastMaintenanceDate),
  },
  { key: "pressure", label: "Pressure", get: (f) => f.qualityRating.pressure },
  {
    key: "cleanliness",
    label: "Cleanliness",
    get: (f) => f.qualityRating.cleanliness,
  },
  {
    key: "observations",
    label: "Observations",
    get: (f) => f.observations ?? "",
  },
  { key: "issues", label: "Issues", get: (f) => (f.issues ?? []).join("; ") },
];

export const DEFAULT_EXPORT_KEYS: ExportColumnKey[] = [
  "id",
  "campus",
  "building",
  "floor",
  "room",
  "brand",
  "model",
  "serialNumber",
  "filterType",
  "lastMaintenance",
  "status",
];

export interface ExportTemplate {
  id: string;
  label: string;
  description: string;
  keys: ExportColumnKey[];
}

export const EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: "default",
    label: "Default",
    description: "Core ID and maintenance fields",
    keys: DEFAULT_EXPORT_KEYS,
  },
  {
    id: "maintenance",
    label: "Maintenance Only",
    description: "Location, filter type, service status",
    keys: [
      "id",
      "campus",
      "building",
      "floor",
      "room",
      "filterType",
      "lastMaintenance",
      "status",
      "issues",
    ],
  },
  {
    id: "asset-register",
    label: "Asset Register",
    description: "Brand, model, serial, install date",
    keys: [
      "id",
      "campus",
      "building",
      "floor",
      "room",
      "category",
      "brand",
      "model",
      "serialNumber",
      "filterType",
      "installationDate",
      "lastMaintenance",
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Location, status, notes for audit",
    keys: [
      "id",
      "campus",
      "building",
      "floor",
      "room",
      "category",
      "brand",
      "model",
      "serialNumber",
      "lastMaintenance",
      "status",
      "observations",
      "issues",
    ],
  },
  {
    id: "all",
    label: "All Columns",
    description: "Full export",
    keys: EXPORT_COLUMNS.map((c) => c.key),
  },
];

function escapeCSV(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCSV(
  fixtures: Fixture[],
  keys: ExportColumnKey[] = DEFAULT_EXPORT_KEYS,
  campusNameById: Record<string, string> = {},
  filename?: string,
) {
  const cols = EXPORT_COLUMNS.filter((c) => keys.includes(c.key));
  const headers = cols.map((c) => c.label);
  const rows = fixtures.map((f) =>
    cols.map((c) =>
      escapeCSV(c.get(f, { campusName: campusNameById[f.campusId] })),
    ),
  );
  const csv = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename || `fixtures_export_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
